import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { dateOf, daysInMonth, firstWeekday, monthEnd, monthStart } from '../lib/date'
import { num, yen } from '../lib/format'
import {
  PAY_LABELS,
  buildCalendar,
  type CalendarSummary,
  type ScheduleRow,
  type Transaction,
} from '../lib/model'
import { useApp } from '../state'
import { COLORS } from '../ui'
import { txAmountText, txColor } from './Entry'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const MUTED = '#a6adb8'

/** 月の明細と未記録の固定費を読み込み、集計する。明細や固定費が変わると読み直す */
export function useMonthData(month: string) {
  const { version, notify } = useApp()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [schedule, setSchedule] = useState<ScheduleRow[]>([])

  useEffect(() => {
    let live = true
    Promise.all([api.listTransactions(monthStart(month), monthEnd(month)), api.getMonthSchedule(month)])
      .then(([tx, rows]) => {
        if (!live) return
        setTransactions(tx)
        setSchedule(rows)
      })
      .catch(() => live && notify('カレンダーを読み込めませんでした'))
    return () => {
      live = false
    }
  }, [month, version, notify])

  const summary = useMemo(() => buildCalendar(transactions, schedule), [transactions, schedule])
  return { transactions, schedule, summary }
}

type MonthCalendarProps = {
  month: string
  day: number
  today: string
  summary: CalendarSummary
  onPick: (day: number) => void
  /** pc は日ごとの金額を省略せずに書く */
  variant?: 'mobile' | 'pc'
}

export function MonthCalendar({ month, day, today, summary, onPick, variant = 'mobile' }: MonthCalendarProps) {
  const m = Number(month.slice(5, 7))
  const pc = variant === 'pc'
  return (
    <div className={pc ? 'cal-wrap-pc' : undefined}>
      <div aria-hidden="true" className="weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="cal-grid">
        {Array.from({ length: daysInMonth(month) }, (_, i) => i + 1).map((d) => {
          const st = summary.days[d]
          const pay = (st?.paid ?? 0) + (st?.planned ?? 0)
          const on = d === day
          const isToday = dateOf(month, d) === today
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={`${m}月${d}日 支払い${yen(pay)}${st?.income ? ` 収入${yen(st.income)}` : ''}`}
              className={pc ? 'cal-cell cal-cell-pc' : 'cal-cell'}
              style={{ gridColumnStart: d === 1 ? firstWeekday(month) + 1 : undefined }}
              onClick={() => onPick(d)}
            >
              <span className="cal-day" style={{ color: isToday ? COLORS.expense : undefined, fontWeight: isToday ? 700 : 400 }}>
                {d}
              </span>
              {pc ? (
                <>
                  <span className="cal-paid">{st?.paid ? yen(st.paid) : ''}</span>
                  <span className="cal-planned">{st?.planned ? `予定 ${yen(st.planned)}` : ''}</span>
                  <span className="cal-income">{st?.income ? `+${yen(st.income)}` : ''}</span>
                </>
              ) : (
                <>
                  <span className="cal-pay" style={{ color: st?.paid ? '#f2f3f5' : MUTED }}>
                    {pay ? num(pay) : ''}
                  </span>
                  <span className="cal-income">{st?.income ? `+${num(st.income)}` : ''}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
      <p className="note">
        {pc
          ? '白は支払い済み、グレーは予定(固定費)、青は収入です。日付を選ぶと右に内訳が出て、入力の日付もその日になります。'
          : '白い金額は支払い済み、グレーは支払い予定です。'}
      </p>
    </div>
  )
}

type DayDetailProps = {
  month: string
  day: number
  transactions: Transaction[]
  schedule: ScheduleRow[]
  onEditTransaction: (t: Transaction) => void
  onEditSchedule: (row: ScheduleRow) => void
}

export function DayDetail({ month, day, transactions, schedule, onEditTransaction, onEditSchedule }: DayDetailProps) {
  const { categories } = useApp()
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const m = Number(month.slice(5, 7))
  const shownDay = Math.min(day, daysInMonth(month))
  const selected = dateOf(month, shownDay)
  const dayTx = transactions.filter((t) => t.occurred_on === selected)
  const daySchedule = schedule.filter((r) => r.due_on === selected)
  const empty = dayTx.length === 0 && daySchedule.length === 0

  return (
    <section aria-label="選択した日の内訳" className="recent">
      <h2>
        {m}月{shownDay}日の内訳
      </h2>
      {empty && <p className="empty">この日の記録はありません</p>}
      {dayTx.map((t) => (
        <button key={t.id} type="button" className="row-item" onClick={() => onEditTransaction(t)}>
          <span className="row-main">
            <span className="row-title">{t.memo || catName.get(t.category_id)}</span>
            <span className="row-sub">
              {catName.get(t.category_id)}・{PAY_LABELS[t.payment_method]}
            </span>
          </span>
          <span className="row-amount" style={{ color: txColor(t) }}>
            {txAmountText(t)}
          </span>
        </button>
      ))}
      {daySchedule.map((r) => (
        <button key={`${r.fixed_cost_id}-${r.due_on}`} type="button" className="row-item" onClick={() => onEditSchedule(r)}>
          <span className="row-main">
            <span className="row-title">{r.name}</span>
            <span className="row-sub">
              固定費・{r.status === 'planned' ? '支払い予定' : '未記録'}・{PAY_LABELS[r.payment_method]}
            </span>
          </span>
          <span className="row-amount" style={{ color: r.status === 'planned' ? MUTED : '#f2f3f5' }}>
            {r.is_estimated ? '約' : ''}
            {yen(r.amount)}
          </span>
        </button>
      ))}
    </section>
  )
}
