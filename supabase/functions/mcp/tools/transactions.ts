// 明細のツール: log_transaction / list_transactions / update_transaction / delete_transaction
// 金額は円の正の整数。方向は type(expense / income / transfer)で表す。
// RLS はユーザーのトークンで効くため、user_id はここでは扱わない（DBが auth.uid() を入れる）。
import { z } from 'zod'
import { catName, KINDS_FOR_TYPE, loadCategories, matchCategoryIds, resolveCategory } from '../lib/categories.ts'
import type { CategoryRow, TxType } from '../lib/categories.ts'
import type { Client } from '../lib/client.ts'
import type { Database } from '../database.types.ts'
import { dateSchema } from '../lib/dates.ts'
import { run, throwIfError, ToolError } from '../lib/result.ts'

export const TYPES = ['expense', 'income', 'transfer'] as const
export const PAY_METHODS = ['cash', 'card', 'qr', 'bank'] as const
type PayMethod = (typeof PAY_METHODS)[number]

// 種別ごとに選べる支払方法（アプリの入力画面と同じ）
const PAY_FOR_TYPE: Record<TxType, PayMethod[]> = {
  expense: ['cash', 'card', 'qr', 'bank'],
  income: ['bank', 'cash'],
  transfer: ['bank', 'card', 'cash'],
}

export const typeSchema = z.enum(TYPES).describe('expense=支出 / income=収入 / transfer=振替・投資（月の支払いには含まれない）')
export const paySchema = z.enum(PAY_METHODS).describe('cash=現金 / card=カード / qr=QR / bank=口座。支出は4つ、収入は bank・cash、振替/投資は bank・card・cash')
export const amountSchema = z.number().int().min(1).max(999_999_999).describe('円の正の整数（方向は type で表す）')
const categoryField = z.string().min(1).describe('費目の名前、または費目のid。list_categories で確認できる。種別に合う費目だけが使える')

export function assertPay(type: TxType, pay: string): void {
  if (!(PAY_FOR_TYPE[type] as string[]).includes(pay)) {
    throw new ToolError(`${type} では支払方法 ${pay} は使えません（使える: ${PAY_FOR_TYPE[type].join(' / ')}）。`)
  }
}

type TxRow = {
  id: string
  type: string
  occurred_on: string
  amount: number
  category_id: string
  payment_method: string
  memo: string
  source: string
  external_id: string | null
  fixed_cost_id: string | null
  is_estimated: boolean
}

export function pubTx(row: TxRow, cats: CategoryRow[]) {
  return {
    id: row.id,
    type: row.type,
    date: row.occurred_on,
    amount: row.amount,
    category: catName(cats, row.category_id),
    category_id: row.category_id,
    payment_method: row.payment_method,
    memo: row.memo,
    source: row.source,
    fixed_cost_id: row.fixed_cost_id,
    is_estimated: row.is_estimated,
  }
}

const DUP_WINDOW_MS = 2 * 60 * 1000

// ===== log_transaction =====
export const logTransactionSchema = z.object({
  type: typeSchema,
  date: dateSchema.describe('明細の日付（日本時間 YYYY-MM-DD）'),
  amount: amountSchema,
  category: categoryField,
  payment_method: paySchema,
  memo: z.string().trim().max(200).optional().describe('店名など（任意、200文字まで）'),
})
export type LogTransactionArgs = z.infer<typeof logTransactionSchema>

export function logTransaction(sb: Client, a: LogTransactionArgs) {
  return run(async () => {
    assertPay(a.type, a.payment_method)
    const cats = await loadCategories(sb)
    const cat = resolveCategory(cats, a.category, KINDS_FOR_TYPE[a.type])
    const memo = a.memo ?? ''

    // 通信の再送などで二重に登録しないよう、直近2分以内の同じ内容は既存の行を返す
    const since = new Date(Date.now() - DUP_WINDOW_MS).toISOString()
    const dup = await sb.from('transactions').select('*')
      .eq('type', a.type).eq('occurred_on', a.date).eq('amount', a.amount)
      .eq('category_id', cat.id).eq('payment_method', a.payment_method).eq('memo', memo)
      .gte('created_at', since)
      .limit(1)
    throwIfError(dup.error)
    if (dup.data && dup.data.length > 0) {
      return { deduplicated: true, row: pubTx(dup.data[0], cats) }
    }

    const { data, error } = await sb.from('transactions')
      .insert({
        type: a.type,
        occurred_on: a.date,
        amount: a.amount,
        category_id: cat.id,
        payment_method: a.payment_method,
        memo,
        source: 'mcp',
      })
      .select().single()
    throwIfError(error)
    return { row: pubTx(data!, cats) }
  })
}

// ===== list_transactions =====
export const listTransactionsSchema = z.object({
  date_from: dateSchema.optional().describe('この日以降に絞る'),
  date_to: dateSchema.optional().describe('この日以前に絞る'),
  type: typeSchema.optional(),
  category: z.string().min(1).optional().describe('費目の名前またはid。同じ名前の費目（種類違い）はすべて対象になる'),
  limit: z.number().int().min(1).max(200).default(50).describe('返す最大件数（1〜200、既定50）。新しい順'),
  offset: z.number().int().min(0).default(0).describe('読み飛ばす件数（続きを取るとき）'),
})
export type ListTransactionsArgs = z.input<typeof listTransactionsSchema>

export function listTransactions(sb: Client, raw: ListTransactionsArgs) {
  return run(async () => {
    const a = listTransactionsSchema.parse(raw)
    if (a.date_from && a.date_to && a.date_from > a.date_to) {
      throw new ToolError('date_from が date_to より後になっています。')
    }
    const cats = await loadCategories(sb)
    let q = sb.from('transactions').select('*', { count: 'exact' })
    if (a.date_from) q = q.gte('occurred_on', a.date_from)
    if (a.date_to) q = q.lte('occurred_on', a.date_to)
    if (a.type) q = q.eq('type', a.type)
    if (a.category) q = q.in('category_id', matchCategoryIds(cats, a.category))
    const { data, error, count } = await q
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
      .range(a.offset, a.offset + a.limit - 1)
    throwIfError(error)
    const rows = (data ?? []).map((r) => pubTx(r, cats))
    return {
      total_matched: count ?? rows.length,
      returned: rows.length,
      offset: a.offset,
      rows,
    }
  })
}

// ===== update_transaction =====
export const updateTransactionSchema = z.object({
  id: z.string().uuid().describe('更新する明細のid。list_transactions で確認できる'),
  patch: z.strictObject({
    type: typeSchema.optional().describe('種別を変えるときは category も指定する'),
    date: dateSchema.optional(),
    amount: amountSchema.optional(),
    category: categoryField.optional(),
    payment_method: paySchema.optional(),
    memo: z.string().trim().max(200).optional(),
    is_estimated: z.boolean().optional().describe('見込み額かどうか。金額を指定すると、見込みだった明細は自動で確定(false)になる'),
  }).describe('更新する項目だけを指定する（指定しなかった項目は変わらない）'),
})
export type UpdateTransactionArgs = z.infer<typeof updateTransactionSchema>

export function updateTransaction(sb: Client, a: UpdateTransactionArgs) {
  return run(async () => {
    const p = a.patch
    if (Object.keys(p).length === 0) throw new ToolError('patch が空です。更新する項目を指定してください。')

    const cur = await sb.from('transactions').select('*').eq('id', a.id).maybeSingle()
    throwIfError(cur.error)
    if (!cur.data) throw new ToolError(`明細 id=${a.id} が見つかりません。`)
    const before = cur.data

    const cats = await loadCategories(sb)
    const type = (p.type ?? before.type) as TxType
    if (p.type && p.type !== before.type && !p.category) {
      throw new ToolError('種別(type)を変えるときは、その種別に合う費目(category)も指定してください。')
    }
    assertPay(type, p.payment_method ?? before.payment_method)

    const row: Database['public']['Tables']['transactions']['Update'] = {}
    if (p.type !== undefined) row.type = p.type
    if (p.date !== undefined) row.occurred_on = p.date
    if (p.amount !== undefined) row.amount = p.amount
    if (p.payment_method !== undefined) row.payment_method = p.payment_method
    if (p.memo !== undefined) row.memo = p.memo
    if (p.category !== undefined) {
      row.category_id = resolveCategory(cats, p.category, KINDS_FOR_TYPE[type]).id
    }
    // 見込み額の明細は、金額を直した時点で確定とみなす（明示的に指定したときはそれに従う）
    let confirmed = false
    if (p.is_estimated !== undefined) {
      row.is_estimated = p.is_estimated
    } else if (before.is_estimated && p.amount !== undefined) {
      row.is_estimated = false
      confirmed = true
    }

    const { data, error } = await sb.from('transactions').update(row).eq('id', a.id).select()
    throwIfError(error)
    if (!data || data.length === 0) throw new ToolError(`明細 id=${a.id} が見つかりません。`)
    return {
      row: pubTx(data[0], cats),
      ...(confirmed ? { estimate_confirmed: true } : {}),
    }
  })
}

// ===== delete_transaction =====
export const deleteTransactionSchema = z.object({
  id: z.string().uuid().describe('削除する明細のid'),
})
export type DeleteTransactionArgs = z.infer<typeof deleteTransactionSchema>

export function deleteTransaction(sb: Client, a: DeleteTransactionArgs) {
  return run(async () => {
    const cats = await loadCategories(sb)
    const { data, error } = await sb.from('transactions').delete().eq('id', a.id).select()
    throwIfError(error)
    if (!data || data.length === 0) throw new ToolError(`明細 id=${a.id} が見つかりません。`)
    const row = data[0]
    return {
      deleted: pubTx(row, cats),
      ...(row.source === 'fixed'
        ? { note: '固定費の自動記録だった明細です。削除した分は自動では再作成されません。' }
        : {}),
    }
  })
}
