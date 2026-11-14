import { describe, expect, it } from 'vitest'
import {
  buildCalendar,
  fixedTotals,
  isEnded,
  subscriptionTotals,
  type FixedCost,
  type ScheduleRow,
  type SubscriptionRow,
  type Transaction,
} from './model'

const fixed = (p: Partial<FixedCost>): FixedCost => ({
  id: 'f',
  user_id: 'u',
  name: '固定費',
  amount: 1000,
  category_id: 'c',
  cycle: 'monthly',
  pay_month: null,
  pay_day: 1,
  is_month_end: false,
  payment_method: 'card',
  start_month: '2026-01-01',
  end_month: null,
  is_variable: false,
  auto_record: true,
  is_subscription: false,
  tracking_from: '2026-01-01',
  recorded_through: '2026-01-01',
  created_at: '',
  updated_at: '',
  ...p,
})

const tx = (p: Partial<Transaction>): Transaction => ({
  id: 't',
  user_id: 'u',
  type: 'expense',
  occurred_on: '2026-11-03',
  amount: 100,
  category_id: 'c',
  payment_method: 'card',
  memo: '',
  source: 'manual',
  external_id: null,
  fixed_cost_id: null,
  is_estimated: false,
  created_at: '',
  updated_at: '',
  ...p,
})

const due = (p: Partial<ScheduleRow>): ScheduleRow => ({
  due_on: '2026-11-27',
  fixed_cost_id: 'f',
  name: '家賃',
  amount: 72000,
  payment_method: 'bank',
  is_estimated: false,
  status: 'planned',
  ...p,
})

describe('fixedTotals', () => {
  it('年払いは12で割って月額に含める', () => {
    const totals = fixedTotals(
      [fixed({ amount: 72000 }), fixed({ amount: 13200, cycle: 'yearly', pay_month: 4 })],
      '2026-11',
    )
    expect(totals.yearly).toBe(72000 * 12 + 13200)
    expect(totals.monthly).toBe(Math.round((72000 * 12 + 13200) / 12))
    expect(totals.count).toBe(2)
  })

  it('終了月が過ぎた固定費は合計に含めない', () => {
    const totals = fixedTotals(
      [fixed({ amount: 1000 }), fixed({ amount: 5000, end_month: '2026-10-01' })],
      '2026-11',
    )
    expect(totals.monthly).toBe(1000)
    expect(totals.count).toBe(1)
  })

  it('終了月と同じ月はまだ合計に含める', () => {
    expect(isEnded({ end_month: '2026-11-01' }, '2026-11')).toBe(false)
    expect(isEnded({ end_month: '2026-10-01' }, '2026-11')).toBe(true)
    expect(isEnded({ end_month: null }, '2026-11')).toBe(false)
  })
})

describe('buildCalendar', () => {
  it('月の支払いは支出の明細と未記録の固定費の合計', () => {
    const summary = buildCalendar(
      [tx({ amount: 2140, occurred_on: '2026-11-03' }), tx({ amount: 680, occurred_on: '2026-11-03' })],
      [due({ status: 'unrecorded', due_on: '2026-11-02', amount: 3000 })],
    )
    expect(summary.paid).toBe(2140 + 680 + 3000)
    expect(summary.planned).toBe(0)
    expect(summary.days[3].paid).toBe(2820)
    expect(summary.days[2].paid).toBe(3000)
  })

  it('これからの予定は支払い済みと分けて集計する', () => {
    const summary = buildCalendar([tx({ amount: 1000 })], [due({ status: 'planned', amount: 72000 })])
    expect(summary.paid).toBe(1000)
    expect(summary.planned).toBe(72000)
    expect(summary.days[27].planned).toBe(72000)
  })

  it('振替/投資は月の支払いにも収入にも含めない', () => {
    const summary = buildCalendar(
      [tx({ type: 'transfer', amount: 30000 }), tx({ type: 'expense', amount: 500 })],
      [],
    )
    expect(summary.paid).toBe(500)
    expect(summary.income).toBe(0)
    expect(summary.days[3].paid).toBe(500)
    // 月の支払いには入らないが、別枠の合計には出る
    expect(summary.transfer).toBe(30000)
  })

  it('収入は日ごとと月の合計に出る', () => {
    const summary = buildCalendar([tx({ type: 'income', amount: 280000, occurred_on: '2026-11-25' })], [])
    expect(summary.income).toBe(280000)
    expect(summary.days[25].income).toBe(280000)
    expect(summary.paid).toBe(0)
  })

  it('記録がない月は0になる', () => {
    const summary = buildCalendar([], [])
    expect(summary).toEqual({ days: {}, paid: 0, planned: 0, income: 0, transfer: 0 })
  })
})

describe('subscriptionTotals', () => {
  const row = (p: Partial<SubscriptionRow>): SubscriptionRow => ({
    fixed_cost_id: 'f',
    name: 'サブスク',
    amount: 1590,
    cycle: 'monthly',
    payment_method: 'card',
    start_month: '2026-01-01',
    end_month: null,
    is_cancelled: false,
    monthly_amount: 1590,
    yearly_amount: 19080,
    paid_in_year: 15900,
    paid_total: 15900,
    ...p,
  })

  it('月額と年額は解約済みを含めない', () => {
    const totals = subscriptionTotals([
      row({}),
      row({ amount: 13200, cycle: 'yearly', monthly_amount: 1100, yearly_amount: 13200 }),
      row({ is_cancelled: true, yearly_amount: 11760 }),
    ])
    expect(totals.yearly).toBe(19080 + 13200)
    expect(totals.monthly).toBe(Math.round((19080 + 13200) / 12))
    expect(totals.activeCount).toBe(2)
  })

  it('今年と累計の支払額は解約済みも含める', () => {
    const totals = subscriptionTotals([
      row({ paid_in_year: 1000, paid_total: 3000 }),
      row({ is_cancelled: true, paid_in_year: 200, paid_total: 4000 }),
    ])
    expect(totals.paidInYear).toBe(1200)
    expect(totals.paidTotal).toBe(7000)
  })

  it('サブスクがなければすべて0', () => {
    expect(subscriptionTotals([])).toEqual({ monthly: 0, yearly: 0, paidInYear: 0, paidTotal: 0, activeCount: 0 })
  })
})
