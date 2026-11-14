import type { Tables } from '../types/database'
import { monthOf } from './date'

export type Category = Tables<'categories'>
export type FixedCost = Tables<'fixed_costs'>
export type Transaction = Tables<'transactions'>

export type TxType = 'expense' | 'income' | 'transfer'
export type CatKind = TxType | 'fixed'
export type PayMethod = 'cash' | 'card' | 'qr' | 'bank'
export type Cycle = 'monthly' | 'yearly'

export interface ScheduleRow {
  due_on: string
  fixed_cost_id: string
  name: string
  amount: number
  payment_method: string
  is_estimated: boolean
  status: 'planned' | 'unrecorded'
}

export interface SubscriptionRow {
  fixed_cost_id: string
  name: string
  amount: number
  cycle: Cycle
  payment_method: string
  start_month: string
  end_month: string | null
  is_cancelled: boolean
  monthly_amount: number
  yearly_amount: number
  paid_in_year: number
  paid_total: number
}

export interface TransactionInput {
  type: TxType
  occurred_on: string
  amount: number
  category_id: string
  payment_method: PayMethod
  memo: string
  is_estimated?: boolean
}

export interface FixedCostInput {
  name: string
  amount: number
  category_id: string
  cycle: Cycle
  pay_month: number | null
  pay_day: number | null
  is_month_end: boolean
  payment_method: PayMethod
  start_month: string
  end_month: string | null
  is_variable: boolean
  auto_record: boolean
  is_subscription: boolean
}

export const KIND_LABELS: Record<CatKind, string> = {
  expense: '支出',
  income: '収入',
  transfer: '振替/投資',
  fixed: '固定費',
}

export const PAY_LABELS: Record<string, string> = {
  cash: '現金',
  card: 'カード',
  qr: 'QR',
  bank: '口座',
}

export function payMethodsFor(type: TxType): PayMethod[] {
  if (type === 'income') return ['bank', 'cash']
  if (type === 'transfer') return ['bank', 'card', 'cash']
  return ['cash', 'card', 'qr', 'bank']
}

export const defaultPay = (type: TxType): PayMethod => (type === 'expense' ? 'card' : 'bank')

export const FIXED_PAY_METHODS: PayMethod[] = ['card', 'bank', 'cash']

export const dayLabel = (fixed: Pick<FixedCost, 'is_month_end' | 'pay_day'>): string =>
  fixed.is_month_end ? '月末' : `${fixed.pay_day}日`

export const cycleLabel = (fixed: FixedCost): string =>
  fixed.cycle === 'yearly'
    ? `毎年${fixed.pay_month}月${dayLabel(fixed)}`
    : `毎月${dayLabel(fixed)}`

const dayRank = (fixed: FixedCost): number => (fixed.is_month_end ? 32 : (fixed.pay_day ?? 0))

export const sortFixedByDay = (list: FixedCost[]): FixedCost[] =>
  list.slice().sort((a, b) => dayRank(a) - dayRank(b) || a.name.localeCompare(b.name, 'ja'))

// 終了月が今月より前なら終了済み
export const isEnded = (fixed: Pick<FixedCost, 'end_month'>, thisMonth: string): boolean =>
  fixed.end_month !== null && monthOf(fixed.end_month) < thisMonth

/** 固定費の一覧の表示。all=すべて / exclude-subscription=サブスクを除く */
export type FixedFilter = 'all' | 'exclude-subscription'

export const filterFixed = (list: FixedCost[], filter: FixedFilter): FixedCost[] =>
  filter === 'all' ? list : list.filter((f) => !f.is_subscription)

// 固定費の合計。年払いは12で割って月額に含める。終了済みは含めない
export function fixedTotals(list: FixedCost[], thisMonth: string) {
  const active = list.filter((f) => !isEnded(f, thisMonth))
  const yearly = active.reduce((sum, f) => sum + (f.cycle === 'yearly' ? f.amount : f.amount * 12), 0)
  return { monthly: Math.round(yearly / 12), yearly, count: active.length }
}

export interface DayStat {
  paid: number
  planned: number
  income: number
}

export interface CalendarSummary {
  days: Record<number, DayStat>
  paid: number
  planned: number
  income: number
  /** 振替/投資の合計。月の支払いには含めず、別枠で表示する */
  transfer: number
}

// 月の支払いは「支出の明細 + 未記録の固定費」。振替/投資は含めない
export function buildCalendar(
  transactions: Transaction[],
  schedule: ScheduleRow[],
): CalendarSummary {
  const days: Record<number, DayStat> = {}
  const dayOf = (date: string) => Number(date.slice(8, 10))
  const stat = (date: string): DayStat => (days[dayOf(date)] ??= { paid: 0, planned: 0, income: 0 })
  const summary: CalendarSummary = { days, paid: 0, planned: 0, income: 0, transfer: 0 }

  for (const t of transactions) {
    if (t.type === 'expense') {
      stat(t.occurred_on).paid += t.amount
      summary.paid += t.amount
    } else if (t.type === 'income') {
      stat(t.occurred_on).income += t.amount
      summary.income += t.amount
    } else if (t.type === 'transfer') {
      summary.transfer += t.amount
    }
  }
  for (const row of schedule) {
    if (row.status === 'planned') {
      stat(row.due_on).planned += row.amount
      summary.planned += row.amount
    } else {
      stat(row.due_on).paid += row.amount
      summary.paid += row.amount
    }
  }
  return summary
}

export interface SubscriptionTotals {
  monthly: number
  yearly: number
  paidInYear: number
  paidTotal: number
  activeCount: number
}

// 月額と年額は解約済みを除く。今年と累計の支払額は解約済みも含める
export function subscriptionTotals(rows: SubscriptionRow[]): SubscriptionTotals {
  const active = rows.filter((r) => !r.is_cancelled)
  const yearly = active.reduce((sum, r) => sum + r.yearly_amount, 0)
  return {
    monthly: Math.round(yearly / 12),
    yearly,
    paidInYear: rows.reduce((sum, r) => sum + r.paid_in_year, 0),
    paidTotal: rows.reduce((sum, r) => sum + r.paid_total, 0),
    activeCount: active.length,
  }
}
