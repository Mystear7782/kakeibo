// 固定費のツール: list_fixed_costs / save_fixed_cost / delete_fixed_cost
// 登録日より前の支払日は、自動記録にも予定にも出ない（DBが tracking_from で判定する）。
import { z } from 'zod'
import { catName, loadCategories, resolveCategory } from '../lib/categories.ts'
import type { CategoryRow } from '../lib/categories.ts'
import type { Client } from '../lib/client.ts'
import type { Database } from '../database.types.ts'
import { monthSchema } from '../lib/dates.ts'
import { run, throwIfError, ToolError } from '../lib/result.ts'
import { amountSchema } from './transactions.ts'

const CYCLES = ['monthly', 'yearly'] as const
const FIXED_PAY = ['cash', 'card', 'bank'] as const

type FixedRow = {
  id: string
  name: string
  amount: number
  category_id: string
  cycle: string
  pay_month: number | null
  pay_day: number | null
  is_month_end: boolean
  payment_method: string
  start_month: string
  end_month: string | null
  is_variable: boolean
  auto_record: boolean
  is_subscription: boolean
  tracking_from: string
  recorded_through: string
}

type FixedInsert = Database['public']['Tables']['fixed_costs']['Insert']

const ym = (date: string | null): string | null => (date ? date.slice(0, 7) : null)

export function pubFixed(row: FixedRow, cats: CategoryRow[]) {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    category: catName(cats, row.category_id),
    category_id: row.category_id,
    cycle: row.cycle,
    pay_month: row.pay_month,
    pay_day: row.is_month_end ? 'month_end' : row.pay_day,
    payment_method: row.payment_method,
    start_month: ym(row.start_month),
    end_month: ym(row.end_month),
    is_variable: row.is_variable,
    auto_record: row.auto_record,
    is_subscription: row.is_subscription,
    tracking_from: row.tracking_from,
    recorded_through: row.recorded_through,
  }
}

// ===== list_fixed_costs =====
export const listFixedCostsSchema = z.object({
  as_of_month: monthSchema.describe('今月など、判定の基準にする月（YYYY-MM）。終了月がこの月より前の固定費は「終了済み」として合計から除く'),
})
export type ListFixedCostsArgs = z.infer<typeof listFixedCostsSchema>

export function listFixedCosts(sb: Client, a: ListFixedCostsArgs) {
  return run(async () => {
    const cats = await loadCategories(sb)
    const { data, error } = await sb.from('fixed_costs').select('*').order('created_at')
    throwIfError(error)
    const rows = (data ?? []).map((f) => {
      const ended = f.end_month !== null && f.end_month.slice(0, 7) < a.as_of_month
      return { ...pubFixed(f, cats), ended }
    })
    // 年払いは12で割って月額に含める
    const yearly = rows.filter((r) => !r.ended)
      .reduce((sum, r) => sum + (r.cycle === 'yearly' ? r.amount : r.amount * 12), 0)
    return {
      as_of_month: a.as_of_month,
      active_count: rows.filter((r) => !r.ended).length,
      monthly_total: Math.round(yearly / 12),
      yearly_total: yearly,
      rows,
    }
  })
}

// ===== save_fixed_cost =====
export const saveFixedCostSchema = z.object({
  fixed_cost_id: z.string().uuid().optional().describe('更新する固定費のid。省略すると新規登録'),
  name: z.string().trim().min(1).max(50).optional(),
  amount: amountSchema.optional().describe('1回あたりの支払額（円）。金額が毎回変わるものは見込み額'),
  category: z.string().min(1).optional().describe('固定費の費目の名前またはid（種類が fixed のもの）'),
  cycle: z.enum(CYCLES).optional().describe('monthly=毎月 / yearly=毎年'),
  pay_month: z.number().int().min(1).max(12).nullable().optional().describe('支払月（yearly のときだけ必須）'),
  pay_day: z.union([z.number().int().min(1).max(28), z.literal('month_end')]).optional()
    .describe('支払日。1〜28、または月末を表す "month_end"'),
  payment_method: z.enum(FIXED_PAY).optional().describe('cash=現金 / card=カード / bank=口座'),
  start_month: monthSchema.optional().describe('開始月（YYYY-MM）。登録日より前の支払日は自動記録も予定表示も行わない'),
  end_month: monthSchema.nullable().optional().describe('終了月（YYYY-MM）。解約したサブスクなどはここに入れる。null で解除'),
  is_variable: z.boolean().optional().describe('金額が毎回変わる。見込み額で記録され、確定後に update_transaction で直す'),
  auto_record: z.boolean().optional().describe('支払日に明細を自動で作る'),
  is_subscription: z.boolean().optional().describe('サブスクとして管理する（サブスク画面と get_subscription_summary に出る）'),
})
export type SaveFixedCostArgs = z.infer<typeof saveFixedCostSchema>

const REQUIRED_ON_CREATE = ['name', 'amount', 'category', 'cycle', 'pay_day', 'payment_method', 'start_month'] as const

export function saveFixedCost(sb: Client, a: SaveFixedCostArgs) {
  return run(async () => {
    const cats = await loadCategories(sb)
    let cur: FixedRow | null = null

    if (a.fixed_cost_id) {
      const r = await sb.from('fixed_costs').select('*').eq('id', a.fixed_cost_id).maybeSingle()
      throwIfError(r.error)
      if (!r.data) throw new ToolError(`固定費 id=${a.fixed_cost_id} が見つかりません。list_fixed_costs で確認してください。`)
      cur = r.data
    } else {
      const missing = REQUIRED_ON_CREATE.filter((k) => a[k] === undefined)
      if (missing.length > 0) {
        throw new ToolError(`新規登録には ${missing.join(', ')} が必要です（更新するときは fixed_cost_id を指定する）。`)
      }
    }

    // 更新のときは、現在の値に指定した項目を重ねたものを検証する
    const cycle = a.cycle ?? cur?.cycle
    const payMonth = a.pay_month !== undefined ? a.pay_month : (cur?.pay_month ?? null)
    if (cycle === 'yearly' && payMonth === null) {
      throw new ToolError('周期が yearly のときは pay_month(支払月 1〜12)が必要です。')
    }
    const finalPayMonth = cycle === 'yearly' ? payMonth : null

    const monthEnd = a.pay_day !== undefined ? a.pay_day === 'month_end' : (cur?.is_month_end ?? false)
    const payDay = a.pay_day !== undefined
      ? (a.pay_day === 'month_end' ? null : a.pay_day)
      : (cur?.pay_day ?? null)

    const start = a.start_month ?? ym(cur?.start_month ?? null)
    const end = a.end_month !== undefined ? a.end_month : ym(cur?.end_month ?? null)
    if (start && end && end < start) throw new ToolError('end_month は start_month と同じか、あとの月にしてください。')

    // 新規登録では必須項目の存在を上で確認済み。更新では現在の値が入る
    const row: FixedInsert = {
      name: (a.name ?? cur?.name)!,
      amount: (a.amount ?? cur?.amount)!,
      category_id: (a.category !== undefined
        ? resolveCategory(cats, a.category, ['fixed']).id
        : cur?.category_id)!,
      cycle: cycle!,
      pay_month: finalPayMonth,
      pay_day: payDay,
      is_month_end: monthEnd,
      payment_method: (a.payment_method ?? cur?.payment_method)!,
      start_month: `${start}-01`,
      end_month: end ? `${end}-01` : null,
      is_variable: a.is_variable ?? cur?.is_variable ?? false,
      auto_record: a.auto_record ?? cur?.auto_record ?? true,
      is_subscription: a.is_subscription ?? cur?.is_subscription ?? false,
    }

    if (cur) {
      const { data, error } = await sb.from('fixed_costs').update(row).eq('id', cur.id).select()
      throwIfError(error)
      if (!data || data.length === 0) throw new ToolError(`固定費 id=${cur.id} が見つかりません。`)
      return { updated: true, row: pubFixed(data[0], cats) }
    }
    const { data, error } = await sb.from('fixed_costs').insert(row).select().single()
    throwIfError(error)
    return { created: true, row: pubFixed(data!, cats) }
  })
}

// ===== delete_fixed_cost =====
export const deleteFixedCostSchema = z.object({
  fixed_cost_id: z.string().uuid().describe('削除する固定費のid'),
})
export type DeleteFixedCostArgs = z.infer<typeof deleteFixedCostSchema>

export function deleteFixedCost(sb: Client, a: DeleteFixedCostArgs) {
  return run(async () => {
    const cats = await loadCategories(sb)
    const { data, error } = await sb.from('fixed_costs').delete().eq('id', a.fixed_cost_id).select()
    throwIfError(error)
    if (!data || data.length === 0) throw new ToolError(`固定費 id=${a.fixed_cost_id} が見つかりません。`)
    const row = data[0]
    return {
      deleted: pubFixed(row, cats),
      note: '記録済みの明細は残るが、固定費とのひもづけは外れる。' +
        (row.is_subscription ? 'サブスクの累計額からも消える。解約した場合は削除せず end_month を入れる方がよい。' : ''),
    }
  })
}
