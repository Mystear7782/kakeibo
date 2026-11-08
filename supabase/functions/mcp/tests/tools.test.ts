// deno-lint-ignore-file no-explicit-any -- ツールの結果(JSON)を緩い型で扱うテストコードのため
// ツール本体のテスト。メモリ上のクライアント(fake-client.ts)で動かすため、RLS・制約・トリガーは
// 検証しない。それらは本番に適用したマイグレーションと、実際のClaude経由の確認で担保する。
import { beforeEach, describe, expect, it } from 'vitest'
import type { ToolResult } from '../lib/result.ts'
import { listCategories, saveCategory } from '../tools/categories.ts'
import { deleteFixedCost, listFixedCosts, saveFixedCost } from '../tools/fixed-costs.ts'
import { registerTools } from '../tools/register.ts'
import { getCashflowSummary, getMonthSchedule, getSubscriptionSummary } from '../tools/reports.ts'
import {
  deleteTransaction,
  listTransactions,
  logTransaction,
  logTransactionSchema,
  updateTransaction,
} from '../tools/transactions.ts'
import { FakeDb } from './fake-client.ts'

const json = (r: ToolResult): any => {
  if (r.isError) throw new Error(`ツールがエラーを返しました: ${r.content[0].text}`)
  return JSON.parse(r.content[0].text)
}
const errText = (r: ToolResult): string => {
  if (!r.isError) throw new Error(`エラーのはずが成功しました: ${r.content[0].text}`)
  return r.content[0].text
}

let db: FakeDb
let sb: ReturnType<FakeDb['client']>
let cat: Record<string, any>

beforeEach(() => {
  db = new FakeDb()
  sb = db.client()
  cat = {
    food: db.category('expense', '食費'),
    other: db.category('expense', 'その他'),
    transit: db.category('expense', '交通費'),
    salary: db.category('income', '給与'),
    invest: db.category('transfer', '投資'),
    housing: db.category('fixed', '住居'),
    subs: db.category('fixed', 'サブスク'),
    fixedOther: db.category('fixed', 'その他'),
  }
})

const expense = (over: Record<string, unknown> = {}) => ({
  type: 'expense' as const,
  date: '2026-11-03',
  amount: 1280,
  category: '食費',
  payment_method: 'qr' as const,
  memo: 'スーパー',
  ...over,
})

describe('ツールの登録', () => {
  it('12個のツールが、仕様どおりの注釈で登録される', () => {
    const tools: Record<string, any> = {}
    registerTools({ registerTool: (name: string, config: any) => (tools[name] = config) } as any, sb)

    expect(Object.keys(tools).sort()).toEqual([
      'delete_fixed_cost', 'delete_transaction', 'get_cashflow_summary', 'get_month_schedule',
      'get_subscription_summary', 'list_categories', 'list_fixed_costs', 'list_transactions',
      'log_transaction', 'save_category', 'save_fixed_cost', 'update_transaction',
    ])
    for (const n of ['list_transactions', 'list_fixed_costs', 'list_categories', 'get_month_schedule', 'get_cashflow_summary', 'get_subscription_summary']) {
      expect(tools[n].annotations.readOnlyHint, `${n} は readOnlyHint`).toBe(true)
    }
    for (const n of ['update_transaction', 'delete_transaction', 'delete_fixed_cost']) {
      expect(tools[n].annotations.destructiveHint, `${n} は destructiveHint`).toBe(true)
      expect(tools[n].description, `${n} は実行前の確認を促す`).toContain('確認')
    }
    for (const n of ['log_transaction', 'save_fixed_cost', 'save_category']) {
      expect(tools[n].annotations.readOnlyHint).toBe(false)
      expect(tools[n].annotations.destructiveHint).toBe(false)
    }
  })
})

describe('入力スキーマ', () => {
  it('金額は円の正の整数だけ', () => {
    for (const amount of [0, -100, 12.5, 1_000_000_000]) {
      expect(logTransactionSchema.safeParse(expense({ amount })).success, `amount=${amount}`).toBe(false)
    }
    expect(logTransactionSchema.safeParse(expense({ amount: 1 })).success).toBe(true)
  })

  it('実在しない日付や形式違いは拒否する', () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026/11/03', '11/3', '']) {
      expect(logTransactionSchema.safeParse(expense({ date })).success, `date=${date}`).toBe(false)
    }
  })

  it('種別と支払方法は決められた値だけ', () => {
    expect(logTransactionSchema.safeParse(expense({ type: 'refund' })).success).toBe(false)
    expect(logTransactionSchema.safeParse(expense({ payment_method: 'paypay' })).success).toBe(false)
  })
})

describe('log_transaction', () => {
  it('費目名から明細を1件登録し、金額は整数で返る', async () => {
    const r = json(await logTransaction(sb, expense()))
    expect(r.row).toMatchObject({
      type: 'expense', date: '2026-11-03', amount: 1280, category: '食費',
      payment_method: 'qr', memo: 'スーパー', source: 'mcp', is_estimated: false,
    })
    expect(Number.isInteger(r.row.amount)).toBe(true)
    expect(db.tables.transactions).toHaveLength(1)
    expect(r.row).not.toHaveProperty('user_id')
  })

  it('同名の費目が複数の種類にあるときは、種別に合う方を選ぶ', async () => {
    const r = json(await logTransaction(sb, expense({ category: 'その他' })))
    expect(r.row.category_id).toBe(cat.other.id)
  })

  it('支出は固定費の費目も使える', async () => {
    const r = json(await logTransaction(sb, expense({ category: '住居', payment_method: 'bank' })))
    expect(r.row.category_id).toBe(cat.housing.id)
  })

  it('費目のidでも指定できる', async () => {
    const r = json(await logTransaction(sb, expense({ category: cat.transit.id })))
    expect(r.row.category).toBe('交通費')
  })

  it('種別に合わない費目はエラーで、使える費目を案内する', async () => {
    const msg = errText(await logTransaction(sb, expense({ category: '給与' })))
    expect(msg).toContain('見つかりません')
    expect(msg).toContain('食費')
    expect(db.tables.transactions).toHaveLength(0)
  })

  it('種別に合わない支払方法はエラー（収入にカードは使えない）', async () => {
    const msg = errText(await logTransaction(sb, expense({ type: 'income', category: '給与', payment_method: 'card' })))
    expect(msg).toContain('支払方法')
    expect(db.tables.transactions).toHaveLength(0)
  })

  it('非表示の費目には登録できない', async () => {
    cat.food.is_hidden = true
    expect(errText(await logTransaction(sb, expense()))).toContain('非表示')
  })

  it('直近の同じ内容は二重登録せず、既存の行を返す', async () => {
    const first = json(await logTransaction(sb, expense()))
    const second = json(await logTransaction(sb, expense()))
    expect(second.deduplicated).toBe(true)
    expect(second.row.id).toBe(first.row.id)
    expect(db.tables.transactions).toHaveLength(1)
    // 金額が違えば別の明細
    json(await logTransaction(sb, expense({ amount: 1300 })))
    expect(db.tables.transactions).toHaveLength(2)
  })

  it('振替/投資と収入も登録できる', async () => {
    json(await logTransaction(sb, expense({ type: 'transfer', category: '投資', amount: 30000, payment_method: 'bank' })))
    json(await logTransaction(sb, expense({ type: 'income', category: '給与', amount: 280000, payment_method: 'bank' })))
    expect(db.tables.transactions.map((t) => t.type).sort()).toEqual(['income', 'transfer'])
  })
})

describe('list_transactions', () => {
  beforeEach(async () => {
    json(await logTransaction(sb, expense({ date: '2026-11-01', amount: 100 })))
    json(await logTransaction(sb, expense({ date: '2026-11-02', amount: 200, category: '交通費' })))
    json(await logTransaction(sb, expense({ date: '2026-11-03', amount: 300 })))
    json(await logTransaction(sb, expense({ type: 'income', date: '2026-11-04', amount: 5000, category: '給与', payment_method: 'bank' })))
  })

  it('新しい順に返し、総件数も返す', async () => {
    const r = json(await listTransactions(sb, {}))
    expect(r.total_matched).toBe(4)
    expect(r.rows.map((x: any) => x.amount)).toEqual([5000, 300, 200, 100])
  })

  it('期間・種別・費目で絞れる', async () => {
    expect(json(await listTransactions(sb, { date_from: '2026-11-02', date_to: '2026-11-03' })).rows).toHaveLength(2)
    expect(json(await listTransactions(sb, { type: 'income' })).rows).toHaveLength(1)
    const byCat = json(await listTransactions(sb, { category: '食費' }))
    expect(byCat.rows.map((x: any) => x.amount)).toEqual([300, 100])
  })

  it('limit と offset で続きを取れる', async () => {
    const page1 = json(await listTransactions(sb, { limit: 2 }))
    const page2 = json(await listTransactions(sb, { limit: 2, offset: 2 }))
    expect(page1.total_matched).toBe(4)
    expect(page1.rows.map((x: any) => x.amount)).toEqual([5000, 300])
    expect(page2.rows.map((x: any) => x.amount)).toEqual([200, 100])
  })

  it('期間の前後が逆、存在しない費目はエラー', async () => {
    expect(errText(await listTransactions(sb, { date_from: '2026-12-01', date_to: '2026-11-01' }))).toContain('date_from')
    expect(errText(await listTransactions(sb, { category: 'ない費目' }))).toContain('見つかりません')
  })
})

describe('update_transaction', () => {
  it('指定した項目だけが変わる', async () => {
    const { row } = json(await logTransaction(sb, expense()))
    const r = json(await updateTransaction(sb, { id: row.id, patch: { amount: 1500, memo: 'コンビニ' } }))
    expect(r.row).toMatchObject({ amount: 1500, memo: 'コンビニ', category: '食費', date: '2026-11-03' })
  })

  it('見込み額の明細は、金額を指定すると確定になる', async () => {
    const est = db.insert('transactions', {
      type: 'expense', occurred_on: '2026-11-15', amount: 8000, category_id: cat.housing.id,
      payment_method: 'card', source: 'fixed', is_estimated: true,
    })
    const r = json(await updateTransaction(sb, { id: est.id, patch: { amount: 7420 } }))
    expect(r.row.amount).toBe(7420)
    expect(r.row.is_estimated).toBe(false)
    expect(r.estimate_confirmed).toBe(true)
  })

  it('金額を変えずに確定することもできる', async () => {
    const est = db.insert('transactions', {
      type: 'expense', occurred_on: '2026-11-15', amount: 8000, category_id: cat.housing.id,
      payment_method: 'card', source: 'fixed', is_estimated: true,
    })
    const r = json(await updateTransaction(sb, { id: est.id, patch: { is_estimated: false } }))
    expect(r.row.is_estimated).toBe(false)
  })

  it('種別を変えるときは費目が必要で、種別に合う費目で更新する', async () => {
    const { row } = json(await logTransaction(sb, expense({ payment_method: 'bank' })))
    expect(errText(await updateTransaction(sb, { id: row.id, patch: { type: 'income' } }))).toContain('category')
    const r = json(await updateTransaction(sb, { id: row.id, patch: { type: 'income', category: '給与' } }))
    expect(r.row).toMatchObject({ type: 'income', category: '給与' })
  })

  it('空の patch、存在しない id、不正な支払方法はエラー', async () => {
    const { row } = json(await logTransaction(sb, expense()))
    expect(errText(await updateTransaction(sb, { id: row.id, patch: {} }))).toContain('patch')
    expect(errText(await updateTransaction(sb, { id: '11111111-1111-4111-8111-111111111111', patch: { amount: 1 } }))).toContain('見つかりません')
    expect(errText(await updateTransaction(sb, { id: row.id, patch: { type: 'income', category: '給与' } }))).toContain('支払方法')
  })
})

describe('delete_transaction', () => {
  it('1件削除し、削除した内容を返す', async () => {
    const { row } = json(await logTransaction(sb, expense()))
    const r = json(await deleteTransaction(sb, { id: row.id }))
    expect(r.deleted.id).toBe(row.id)
    expect(db.tables.transactions).toHaveLength(0)
  })

  it('固定費の自動記録を削除すると、再作成されないことを伝える', async () => {
    const t = db.insert('transactions', {
      type: 'expense', occurred_on: '2026-11-27', amount: 72000, category_id: cat.housing.id,
      payment_method: 'bank', source: 'fixed',
    })
    expect(json(await deleteTransaction(sb, { id: t.id })).note).toContain('再作成されません')
  })

  it('存在しない id はエラー', async () => {
    expect(errText(await deleteTransaction(sb, { id: '11111111-1111-4111-8111-111111111111' }))).toContain('見つかりません')
  })
})

describe('save_fixed_cost / list_fixed_costs / delete_fixed_cost', () => {
  const monthly = (over: Record<string, unknown> = {}) => ({
    name: '家賃', amount: 72000, category: '住居', cycle: 'monthly' as const,
    pay_day: 27, payment_method: 'bank' as const, start_month: '2026-11', ...over,
  })

  it('毎月の固定費を登録できる', async () => {
    const r = json(await saveFixedCost(sb, monthly()))
    expect(r.created).toBe(true)
    expect(r.row).toMatchObject({
      name: '家賃', amount: 72000, category: '住居', cycle: 'monthly', pay_month: null,
      pay_day: 27, start_month: '2026-11', end_month: null, auto_record: true, is_subscription: false,
    })
    expect(db.tables.fixed_costs[0].start_month).toBe('2026-11-01')
  })

  it('月末払いは pay_day に month_end を指定する', async () => {
    const r = json(await saveFixedCost(sb, monthly({ pay_day: 'month_end' })))
    expect(r.row.pay_day).toBe('month_end')
    expect(db.tables.fixed_costs[0]).toMatchObject({ is_month_end: true, pay_day: null })
  })

  it('毎年の固定費には支払月が必要', async () => {
    expect(errText(await saveFixedCost(sb, monthly({ cycle: 'yearly' })))).toContain('pay_month')
    const r = json(await saveFixedCost(sb, monthly({ cycle: 'yearly', pay_month: 4, name: '保険', amount: 13200, category: 'サブスク' })))
    expect(r.row).toMatchObject({ cycle: 'yearly', pay_month: 4 })
  })

  it('新規登録は必須項目が足りないとエラー', async () => {
    const msg = errText(await saveFixedCost(sb, { name: '家賃' }))
    expect(msg).toContain('amount')
    expect(msg).toContain('start_month')
  })

  it('固定費の費目以外は使えない', async () => {
    expect(errText(await saveFixedCost(sb, monthly({ category: '食費' })))).toContain('見つかりません')
  })

  it('終了月が開始月より前だとエラー', async () => {
    expect(errText(await saveFixedCost(sb, monthly({ end_month: '2026-10' })))).toContain('end_month')
  })

  it('更新は指定した項目だけが変わる。解約は終了月を入れる', async () => {
    const { row } = json(await saveFixedCost(sb, monthly({ category: 'サブスク', name: '動画配信', amount: 1590, is_subscription: true })))
    const r = json(await saveFixedCost(sb, { fixed_cost_id: row.id, end_month: '2026-12' }))
    expect(r.updated).toBe(true)
    expect(r.row).toMatchObject({ name: '動画配信', amount: 1590, end_month: '2026-12', is_subscription: true })
    // 周期を変えるときは支払月が必要
    expect(errText(await saveFixedCost(sb, { fixed_cost_id: row.id, cycle: 'yearly' }))).toContain('pay_month')
    // 終了月は null で解除できる
    expect(json(await saveFixedCost(sb, { fixed_cost_id: row.id, end_month: null })).row.end_month).toBeNull()
  })

  it('存在しない固定費の更新はエラー', async () => {
    expect(errText(await saveFixedCost(sb, { fixed_cost_id: '11111111-1111-4111-8111-111111111111', amount: 1 }))).toContain('見つかりません')
  })

  it('一覧は月額と年額の合計を返し、終了済みを除く。年払いは12で割る', async () => {
    json(await saveFixedCost(sb, monthly()))
    json(await saveFixedCost(sb, monthly({ name: 'クラウド', amount: 13200, category: 'サブスク', cycle: 'yearly', pay_month: 4 })))
    json(await saveFixedCost(sb, monthly({ name: '終了済み', amount: 5000, category: 'サブスク', start_month: '2026-01', end_month: '2026-09' })))
    const r = json(await listFixedCosts(sb, { as_of_month: '2026-11' }))
    expect(r.active_count).toBe(2)
    expect(r.yearly_total).toBe(72000 * 12 + 13200)
    expect(r.monthly_total).toBe(Math.round((72000 * 12 + 13200) / 12))
    expect(r.rows.find((x: any) => x.name === '終了済み').ended).toBe(true)
    expect(r.rows.find((x: any) => x.name === '家賃').ended).toBe(false)
  })

  it('削除は記録済みの明細が残ることを伝える。サブスクは終了月を促す', async () => {
    const { row } = json(await saveFixedCost(sb, monthly({ category: 'サブスク', is_subscription: true })))
    const r = json(await deleteFixedCost(sb, { fixed_cost_id: row.id }))
    expect(r.note).toContain('明細は残る')
    expect(r.note).toContain('end_month')
    expect(db.tables.fixed_costs).toHaveLength(0)
  })
})

describe('save_category / list_categories', () => {
  it('新規追加は種類の最後に並ぶ', async () => {
    const r = json(await saveCategory(sb, { kind: 'expense', name: '習い事' }))
    expect(r.created).toBe(true)
    expect(r.row.sort_order).toBe(40)
  })

  it('同じ種類で同じ名前は登録できない。非表示のものは戻し方を案内する', async () => {
    expect(errText(await saveCategory(sb, { kind: 'expense', name: '食費' }))).toContain('既にあります')
    cat.food.is_hidden = true
    expect(errText(await saveCategory(sb, { kind: 'expense', name: '食費' }))).toContain('is_hidden')
    // 別の種類なら同じ名前でよい
    json(await saveCategory(sb, { kind: 'income', name: '食費' }))
  })

  it('名前変更・並び替え・非表示ができる', async () => {
    json(await saveCategory(sb, { category_id: cat.food.id, name: '食費(外食)' }))
    expect(db.tables.categories.find((c) => c.id === cat.food.id)!.name).toBe('食費(外食)')
    json(await saveCategory(sb, { category_id: cat.food.id, sort_order: 99, is_hidden: true }))
    expect(db.tables.categories.find((c) => c.id === cat.food.id)).toMatchObject({ sort_order: 99, is_hidden: true })
  })

  it('名前の重複、種類の変更、空の更新はエラー', async () => {
    expect(errText(await saveCategory(sb, { category_id: cat.food.id, name: '交通費' }))).toContain('既にあります')
    expect(errText(await saveCategory(sb, { category_id: cat.food.id, kind: 'income' }))).toContain('種類')
    expect(errText(await saveCategory(sb, { category_id: cat.food.id }))).toContain('更新する項目')
    expect(errText(await saveCategory(sb, { name: '種類なし' }))).toContain('kind')
  })

  it('一覧は既定で非表示を含まず、種類で絞れる', async () => {
    cat.other.is_hidden = true
    const all = json(await listCategories(sb, {}))
    expect(all.rows.some((c: any) => c.id === cat.other.id)).toBe(false)
    expect(json(await listCategories(sb, { include_hidden: true })).rows.some((c: any) => c.id === cat.other.id)).toBe(true)
    const income = json(await listCategories(sb, { kind: 'income' }))
    expect(income.rows.map((c: any) => c.name)).toEqual(['給与'])
  })
})

describe('get_month_schedule', () => {
  it('月の予定と、これから・未記録の合計を返す', async () => {
    db.rpcs.get_month_schedule = (args) => {
      expect(args).toEqual({ p_month: '2026-11-01' })
      return [
        { due_on: '2026-11-05', fixed_cost_id: 'a', name: '保険', amount: 3500, payment_method: 'bank', is_estimated: false, status: 'unrecorded' },
        { due_on: '2026-11-27', fixed_cost_id: 'b', name: '家賃', amount: 72000, payment_method: 'bank', is_estimated: false, status: 'planned' },
        { due_on: '2026-11-28', fixed_cost_id: 'c', name: '電気', amount: 8000, payment_method: 'card', is_estimated: true, status: 'planned' },
      ]
    }
    const r = json(await getMonthSchedule(sb, { month: '2026-11' }))
    expect(r.planned_total).toBe(80000)
    expect(r.unrecorded_total).toBe(3500)
    expect(r.rows).toHaveLength(3)
  })

  it('DBのエラーはそのまま返す', async () => {
    expect(errText(await getMonthSchedule(sb, { month: '2026-11' }))).toContain('no rpc')
  })
})

describe('get_cashflow_summary', () => {
  const rows = [
    { month: '2026-10-01', income: 280000, expense: 200000, fixed_expense: 90000, transfer: 30000, balance: 80000, savings_rate: 0.2857 },
    { month: '2026-11-01', income: 0, expense: 5000, fixed_expense: 0, transfer: 0, balance: -5000, savings_rate: null },
  ]

  it('月別の行と、期間の合計・貯蓄率を返す。振替は収支に入らない', async () => {
    db.rpcs.get_cashflow_summary = (args) => {
      expect(args).toEqual({ p_from: '2026-10-01', p_to: '2026-11-01' })
      return rows
    }
    const r = json(await getCashflowSummary(sb, { from_month: '2026-10', to_month: '2026-11' }))
    expect(r.months.map((m: any) => m.month)).toEqual(['2026-10', '2026-11'])
    expect(r.months[1].savings_rate).toBeNull()
    expect(r.total).toMatchObject({ income: 280000, expense: 205000, transfer: 30000, balance: 75000 })
    expect(r.total.savings_rate).toBe(Math.round((75000 / 280000) * 10000) / 10000)
  })

  it('期間の前後が逆、36か月超はエラー', async () => {
    expect(errText(await getCashflowSummary(sb, { from_month: '2026-11', to_month: '2026-10' }))).toContain('from_month')
    expect(errText(await getCashflowSummary(sb, { from_month: '2023-01', to_month: '2026-01' }))).toContain('36')
    expect(db.rpcCalls).toHaveLength(0)
  })

  it('収入が0の期間は貯蓄率が null', async () => {
    db.rpcs.get_cashflow_summary = () => [rows[1]]
    const r = json(await getCashflowSummary(sb, { from_month: '2026-11', to_month: '2026-11' }))
    expect(r.total.savings_rate).toBeNull()
  })
})

describe('get_subscription_summary', () => {
  const row = (over: Record<string, unknown>) => ({
    fixed_cost_id: 'x', name: 'サブスク', amount: 1590, cycle: 'monthly', payment_method: 'card',
    start_month: '2026-01-01', end_month: null, is_cancelled: false, monthly_amount: 1590,
    yearly_amount: 19080, paid_in_year: 15900, paid_total: 15900, ...over,
  })

  it('月額・年額の合計は解約済みを除き、支払額は含める', async () => {
    db.rpcs.get_subscription_summary = () => [
      row({ name: '動画' }),
      row({ name: 'クラウド', amount: 13200, cycle: 'yearly', monthly_amount: 1100, yearly_amount: 13200, paid_in_year: 0, paid_total: 0 }),
      row({ name: '音楽', end_month: '2026-08-01', is_cancelled: true, yearly_amount: 11760, paid_in_year: 7840, paid_total: 11760 }),
    ]
    const r = json(await getSubscriptionSummary(sb, {}))
    expect(r.active_count).toBe(2)
    expect(r.yearly_total).toBe(19080 + 13200)
    expect(r.monthly_total).toBe(Math.round((19080 + 13200) / 12))
    expect(r.paid_in_year_total).toBe(15900 + 7840)
    expect(r.paid_total).toBe(15900 + 11760)
    expect(r.rows.find((x: any) => x.name === '音楽')).toMatchObject({ end_month: '2026-08', is_cancelled: true })
  })

  it('year を省略するとDBの既定（日本時間の今年）に任せ、指定すればそのまま渡す', async () => {
    db.rpcs.get_subscription_summary = () => []
    json(await getSubscriptionSummary(sb, {}))
    json(await getSubscriptionSummary(sb, { year: 2025 }))
    expect(db.rpcCalls.map((c) => c.args)).toEqual([{}, { p_year: 2025 }])
  })

  it('サブスクがなければすべて0', async () => {
    db.rpcs.get_subscription_summary = () => []
    const r = json(await getSubscriptionSummary(sb, {}))
    expect(r).toMatchObject({ active_count: 0, monthly_total: 0, yearly_total: 0, paid_total: 0, rows: [] })
  })
})
