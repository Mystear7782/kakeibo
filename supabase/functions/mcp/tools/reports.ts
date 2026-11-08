// 集計のツール: get_month_schedule / get_cashflow_summary / get_subscription_summary
// 集計はDBの関数(get_month_schedule / get_cashflow_summary / get_subscription_summary)が行い、
// ユーザーのトークンで呼ぶため RLS が効く。金額は円の整数で返す。
import { z } from 'zod'
import type { Client } from '../lib/client.ts'
import { monthsBetween, monthSchema } from '../lib/dates.ts'
import { run, throwIfError, ToolError } from '../lib/result.ts'

const MAX_MONTHS = 36

// ===== get_month_schedule =====
export const getMonthScheduleSchema = z.object({
  month: monthSchema.describe('予定を見る月（YYYY-MM）'),
})
export type GetMonthScheduleArgs = z.infer<typeof getMonthScheduleSchema>

export function getMonthSchedule(sb: Client, a: GetMonthScheduleArgs) {
  return run(async () => {
    const { data, error } = await sb.rpc('get_month_schedule', { p_month: `${a.month}-01` })
    throwIfError(error)
    const rows = (data ?? []).map((r) => ({
      due_on: r.due_on,
      fixed_cost_id: r.fixed_cost_id,
      name: r.name,
      amount: r.amount,
      payment_method: r.payment_method,
      is_estimated: r.is_estimated,
      // planned=これから / unrecorded=支払日を過ぎたが明細になっていない
      status: r.status,
    }))
    const sum = (status: string) => rows.filter((r) => r.status === status).reduce((n, r) => n + r.amount, 0)
    return {
      month: a.month,
      planned_total: sum('planned'),
      unrecorded_total: sum('unrecorded'),
      rows,
    }
  })
}

// ===== get_cashflow_summary =====
export const getCashflowSummarySchema = z.object({
  from_month: monthSchema.describe('集計の開始月（YYYY-MM）'),
  to_month: monthSchema.describe(`集計の終了月（YYYY-MM）。最大${MAX_MONTHS}か月`),
})
export type GetCashflowSummaryArgs = z.infer<typeof getCashflowSummarySchema>

export function getCashflowSummary(sb: Client, a: GetCashflowSummaryArgs) {
  return run(async () => {
    const span = monthsBetween(a.from_month, a.to_month)
    if (span < 0) throw new ToolError('from_month が to_month より後になっています。')
    if (span + 1 > MAX_MONTHS) throw new ToolError(`期間は${MAX_MONTHS}か月以内にしてください。`)

    const { data, error } = await sb.rpc('get_cashflow_summary', {
      p_from: `${a.from_month}-01`,
      p_to: `${a.to_month}-01`,
    })
    throwIfError(error)
    const months = (data ?? []).map((r) => ({
      month: r.month.slice(0, 7),
      income: r.income,
      expense: r.expense,
      fixed_expense: r.fixed_expense,
      transfer: r.transfer,
      balance: r.balance,
      // (収入 - 支出) / 収入。収入が0の月は null。振替/投資は支出に含めない
      savings_rate: r.savings_rate,
    }))
    const total = (k: 'income' | 'expense' | 'fixed_expense' | 'transfer') =>
      months.reduce((n, m) => n + m[k], 0)
    const income = total('income')
    const expense = total('expense')
    return {
      from_month: a.from_month,
      to_month: a.to_month,
      months,
      total: {
        income,
        expense,
        fixed_expense: total('fixed_expense'),
        transfer: total('transfer'),
        balance: income - expense,
        savings_rate: income === 0 ? null : Math.round(((income - expense) / income) * 10000) / 10000,
      },
    }
  })
}

// ===== get_subscription_summary =====
export const getSubscriptionSummarySchema = z.object({
  year: z.number().int().min(2000).max(2100).optional()
    .describe('「今年の支払額」を数える年（西暦）。省略すると日本時間の今年'),
})
export type GetSubscriptionSummaryArgs = z.infer<typeof getSubscriptionSummarySchema>

export function getSubscriptionSummary(sb: Client, a: GetSubscriptionSummaryArgs) {
  return run(async () => {
    const { data, error } = await sb.rpc(
      'get_subscription_summary',
      a.year === undefined ? {} : { p_year: a.year },
    )
    throwIfError(error)
    const rows = (data ?? []).map((r) => ({
      fixed_cost_id: r.fixed_cost_id,
      name: r.name,
      amount: r.amount,
      cycle: r.cycle,
      payment_method: r.payment_method,
      start_month: r.start_month.slice(0, 7),
      end_month: r.end_month ? r.end_month.slice(0, 7) : null,
      is_cancelled: r.is_cancelled,
      monthly_amount: r.monthly_amount,
      yearly_amount: r.yearly_amount,
      paid_in_year: r.paid_in_year,
      paid_total: r.paid_total,
    }))
    const active = rows.filter((r) => !r.is_cancelled)
    const yearly = active.reduce((n, r) => n + r.yearly_amount, 0)
    return {
      // 月額・年額の合計は解約済みを含めない。支払額の合計は解約済みも含める
      active_count: active.length,
      monthly_total: Math.round(yearly / 12),
      yearly_total: yearly,
      paid_in_year_total: rows.reduce((n, r) => n + r.paid_in_year, 0),
      paid_total: rows.reduce((n, r) => n + r.paid_total, 0),
      rows,
    }
  })
}
