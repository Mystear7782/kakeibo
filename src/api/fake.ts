// 画面の動作確認とテスト用のメモリ上のAPI。本番のビルドには含めない(VITE_FAKE_API=1 のときだけ使う)。
import { addMonths, daysInMonth, dateOf, monthOf, todayJst } from '../lib/date'
import type {
  CatKind,
  Category,
  FixedCost,
  ScheduleRow,
  SubscriptionRow,
  Transaction,
} from '../lib/model'
import type { Api } from './types'

const DEFAULT_CATEGORIES: Record<CatKind, string[]> = {
  expense: ['食費', '日用品', '交通費', '交際費', '趣味', '医療', '衣服', '特別費', 'その他'],
  income: ['給与', '賞与', '副業', '還付', 'その他'],
  transfer: ['投資', '貯金', '口座間の移動', 'その他'],
  fixed: ['住居', '水道光熱', '通信', '保険', 'サブスク', 'ローン', '車', 'その他'],
}

let seq = 0
const uid = () => `id-${++seq}`
const now = () => new Date().toISOString()

export function createFakeApi(): Api {
  const today = todayJst()
  const thisMonth = monthOf(today)

  const categories: Category[] = []
  for (const [kind, names] of Object.entries(DEFAULT_CATEGORIES)) {
    names.forEach((name, i) =>
      categories.push({
        id: uid(),
        user_id: 'demo',
        kind,
        name,
        sort_order: (i + 1) * 10,
        is_hidden: false,
        created_at: now(),
        updated_at: now(),
      }),
    )
  }
  const cat = (kind: CatKind, name: string) => categories.find((c) => c.kind === kind && c.name === name)!.id

  const fixedCosts: FixedCost[] = []
  const addFixed = (p: Partial<FixedCost> & Pick<FixedCost, 'name' | 'amount' | 'category_id'>) =>
    fixedCosts.push({
      id: uid(),
      user_id: 'demo',
      cycle: 'monthly',
      pay_month: null,
      pay_day: 1,
      is_month_end: false,
      payment_method: 'card',
      start_month: `${addMonths(thisMonth, -10)}-01`,
      end_month: null,
      is_variable: false,
      auto_record: true,
      is_subscription: false,
      tracking_from: `${addMonths(thisMonth, -10)}-01`,
      recorded_through: today,
      created_at: now(),
      updated_at: now(),
      ...p,
    })
  addFixed({ name: '家賃', amount: 72000, category_id: cat('fixed', '住居'), pay_day: 27, payment_method: 'bank' })
  addFixed({ name: '電気', amount: 8000, category_id: cat('fixed', '水道光熱'), pay_day: 15, is_variable: true })
  addFixed({ name: 'スマホ', amount: 2970, category_id: cat('fixed', '通信'), pay_day: 20 })
  addFixed({ name: '動画配信', amount: 1590, category_id: cat('fixed', 'サブスク'), pay_day: 10, is_subscription: true })
  addFixed({
    name: 'クラウド保存',
    amount: 13200,
    category_id: cat('fixed', 'サブスク'),
    cycle: 'yearly',
    pay_month: 4,
    pay_day: 1,
    auto_record: false,
    is_subscription: true,
  })
  addFixed({
    name: '音楽配信',
    amount: 980,
    category_id: cat('fixed', 'サブスク'),
    pay_day: 5,
    end_month: `${addMonths(thisMonth, -3)}-01`,
    is_subscription: true,
  })
  addFixed({ name: '保険', amount: 3500, category_id: cat('fixed', '保険'), pay_day: 5, payment_method: 'bank' })

  const transactions: Transaction[] = []
  const addTx = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'occurred_on' | 'amount' | 'category_id'>) =>
    transactions.push({
      id: uid(),
      user_id: 'demo',
      payment_method: 'card',
      memo: '',
      source: 'manual',
      external_id: null,
      fixed_cost_id: null,
      is_estimated: false,
      created_at: now(),
      updated_at: now(),
      ...p,
    })
  const day = (n: number) => dateOf(thisMonth, Math.min(n, daysInMonth(thisMonth)))
  addTx({ type: 'expense', occurred_on: day(3), amount: 2140, category_id: cat('expense', '食費'), payment_method: 'qr', memo: 'スーパー' })
  addTx({ type: 'expense', occurred_on: day(2), amount: 680, category_id: cat('expense', '交通費'), memo: '電車' })
  addTx({ type: 'expense', occurred_on: day(1), amount: 1320, category_id: cat('expense', '日用品'), memo: 'ドラッグストア' })
  addTx({ type: 'transfer', occurred_on: day(1), amount: 30000, category_id: cat('transfer', '投資'), payment_method: 'bank', memo: 'つみたて' })
  addTx({ type: 'income', occurred_on: day(25), amount: 280000, category_id: cat('income', '給与'), payment_method: 'bank', memo: '給与' })
  // 固定費の自動記録(過去分)
  for (const f of fixedCosts.filter((x) => x.auto_record && x.cycle === 'monthly')) {
    for (let back = 1; back <= 3; back++) {
      const ym = addMonths(thisMonth, -back)
      const due = dateOf(ym, f.is_month_end ? daysInMonth(ym) : Math.min(f.pay_day ?? 1, daysInMonth(ym)))
      if (f.end_month && ym > monthOf(f.end_month)) continue
      addTx({
        type: 'expense',
        occurred_on: due,
        amount: f.amount,
        category_id: f.category_id,
        payment_method: f.payment_method as Transaction['payment_method'],
        memo: f.name,
        source: 'fixed',
        fixed_cost_id: f.id,
        is_estimated: f.is_variable,
      })
    }
  }

  const delay = <T>(value: T): Promise<T> => Promise.resolve(structuredClone(value))
  const byDateDesc = (a: Transaction, b: Transaction) =>
    b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at)

  function dueDates(f: FixedCost, month: string): string[] {
    if (f.cycle === 'yearly' && Number(month.slice(5, 7)) !== f.pay_month) return []
    if (month < monthOf(f.start_month)) return []
    if (f.end_month && month > monthOf(f.end_month)) return []
    const date = dateOf(month, f.is_month_end ? daysInMonth(month) : (f.pay_day ?? 1))
    return date >= f.tracking_from ? [date] : []
  }

  return {
    async ensureDefaultCategories() {},

    listCategories: () => delay(categories),
    async addCategory(kind, name, sortOrder) {
      if (categories.some((c) => c.kind === kind && c.name === name)) throw new Error('duplicate')
      categories.push({
        id: uid(), user_id: 'demo', kind, name, sort_order: sortOrder,
        is_hidden: false, created_at: now(), updated_at: now(),
      })
    },
    async updateCategory(id, patch) {
      Object.assign(categories.find((c) => c.id === id)!, patch)
    },
    async deleteCategory(id) {
      categories.splice(categories.findIndex((c) => c.id === id), 1)
    },
    async isCategoryUsed(id) {
      return transactions.some((t) => t.category_id === id) || fixedCosts.some((f) => f.category_id === id)
    },

    listFixedCosts: () => delay(fixedCosts),
    async saveFixedCost(input, id) {
      if (id) Object.assign(fixedCosts.find((f) => f.id === id)!, input)
      else addFixed({ ...input, tracking_from: today, recorded_through: today })
    },
    async deleteFixedCost(id) {
      fixedCosts.splice(fixedCosts.findIndex((f) => f.id === id), 1)
      for (const t of transactions) if (t.fixed_cost_id === id) t.fixed_cost_id = null
    },

    listRecentTransactions: (limit) => delay(transactions.slice().sort(byDateDesc).slice(0, limit)),
    listTransactions: (from, to) =>
      delay(transactions.filter((t) => t.occurred_on >= from && t.occurred_on <= to).sort(byDateDesc)),
    async saveTransaction(input, id) {
      if (id) Object.assign(transactions.find((t) => t.id === id)!, input)
      else addTx(input)
    },
    async deleteTransaction(id) {
      transactions.splice(transactions.findIndex((t) => t.id === id), 1)
    },

    async getMonthSchedule(month) {
      const rows: ScheduleRow[] = []
      for (const f of fixedCosts) {
        for (const due of dueDates(f, month)) {
          if (transactions.some((t) => t.fixed_cost_id === f.id && t.occurred_on === due)) continue
          if (f.auto_record && due <= f.recorded_through) continue
          rows.push({
            due_on: due,
            fixed_cost_id: f.id,
            name: f.name,
            amount: f.amount,
            payment_method: f.payment_method,
            is_estimated: f.is_variable,
            status: due > today ? 'planned' : 'unrecorded',
          })
        }
      }
      return delay(rows.sort((a, b) => a.due_on.localeCompare(b.due_on)))
    },
    async getSubscriptionSummary(year) {
      const rows: SubscriptionRow[] = fixedCosts
        .filter((f) => f.is_subscription)
        .map((f) => {
          const paid = transactions.filter((t) => t.fixed_cost_id === f.id && t.type === 'expense')
          const sum = (list: Transaction[]) => list.reduce((n, t) => n + t.amount, 0)
          return {
            fixed_cost_id: f.id,
            name: f.name,
            amount: f.amount,
            cycle: f.cycle as SubscriptionRow['cycle'],
            payment_method: f.payment_method,
            start_month: f.start_month,
            end_month: f.end_month,
            is_cancelled: f.end_month !== null && addMonths(monthOf(f.end_month), 1) <= thisMonth,
            monthly_amount: f.cycle === 'monthly' ? f.amount : Math.round(f.amount / 12),
            yearly_amount: f.cycle === 'monthly' ? f.amount * 12 : f.amount,
            paid_in_year: sum(paid.filter((t) => t.occurred_on.startsWith(String(year)))),
            paid_total: sum(paid),
          }
        })
      return delay(rows.sort((a, b) => a.name.localeCompare(b.name, 'ja')))
    },
  }
}
