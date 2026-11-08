import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import {
  addMonths,
  dateOf,
  daysInMonth,
  firstWeekday,
  monthEnd,
  monthOf,
  monthStart,
  todayJst,
} from '../lib/date'
import { num, yen } from '../lib/format'
import {
  PAY_LABELS,
  buildCalendar,
  type Category,
  type FixedCost,
  type ScheduleRow,
  type Transaction,
} from '../lib/model'
import { COLORS, Screen, Scroll } from '../ui'
import { txAmountText, txColor } from './Entry'

type Props = {
  categories: Category[]
  fixedCosts: FixedCost[]
  version: number
  onEditTransaction: (t: Transaction) => void
  onEditFixed: (f: FixedCost) => void
  notify: (text: string) => void
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const MUTED = '#a6adb8'

export function CalendarScreen({ categories, fixedCosts, version, onEditTransaction, onEditFixed, notify }: Props) {
  const today = todayJst()
  const [month, setMonth] = useState(monthOf(today))
  const [day, setDay] = useState(Number(today.slice(8, 10)))
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

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const summary = useMemo(() => buildCalendar(transactions, schedule), [transactions, schedule])

  function shift(delta: number) {
    const next = addMonths(month, delta)
    setMonth(next)
    setDay(next === monthOf(today) ? Number(today.slice(8, 10)) : 1)
  }

  const [y, m] = month.split('-').map(Number)
  const selected = dateOf(month, Math.min(day, daysInMonth(month)))
  const dayTx = transactions.filter((t) => t.occurred_on === selected)
  const daySchedule = schedule.filter((r) => r.due_on === selected)
  const empty = dayTx.length === 0 && daySchedule.length === 0

  function openSchedule(row: ScheduleRow) {
    const fixed = fixedCosts.find((f) => f.id === row.fixed_cost_id)
    if (fixed) onEditFixed(fixed)
  }

  return (
    <Screen>
      <div className="header header-cal">
        <button type="button" aria-label="前の月" className="icon-btn" onClick={() => shift(-1)}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.5 4 6.5 10l6 6" />
          </svg>
        </button>
        <h1>
          {y}年{m}月
        </h1>
        <button type="button" aria-label="次の月" className="icon-btn" onClick={() => shift(1)}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7.5 4 6 6-6 6" />
          </svg>
        </button>
      </div>
      <Scroll gap={10}>
        <div className="card card-compact">
          <div className="card-label">月の支払い(予定を含む)</div>
          <div className="card-big card-big-sm">{yen(summary.paid + summary.planned)}</div>
          <div className="stats">
            <div>
              <span className="card-label">支払い済み</span>
              <span className="stat-value">{yen(summary.paid)}</span>
            </div>
            <div>
              <span className="card-label">これから</span>
              <span className="stat-value" style={{ color: MUTED }}>
                {yen(summary.planned)}
              </span>
            </div>
            <div>
              <span className="card-label">収入</span>
              <span className="stat-value" style={{ color: COLORS.income }}>
                {yen(summary.income)}
              </span>
            </div>
          </div>
        </div>

        <div>
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
                  className="cal-cell"
                  style={{ gridColumnStart: d === 1 ? firstWeekday(month) + 1 : undefined }}
                  onClick={() => setDay(d)}
                >
                  <span className="cal-day" style={{ color: isToday ? COLORS.expense : undefined, fontWeight: isToday ? 700 : 400 }}>
                    {d}
                  </span>
                  <span className="cal-pay" style={{ color: st?.paid ? '#f2f3f5' : MUTED }}>
                    {pay ? num(pay) : ''}
                  </span>
                  <span className="cal-income">{st?.income ? `+${num(st.income)}` : ''}</span>
                </button>
              )
            })}
          </div>
          <p className="note">白い金額は支払い済み、グレーは支払い予定です。</p>
        </div>

        <section aria-label="選択した日の内訳" className="recent">
          <h2>
            {m}月{Math.min(day, daysInMonth(month))}日の内訳
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
            <button key={`${r.fixed_cost_id}-${r.due_on}`} type="button" className="row-item" onClick={() => openSchedule(r)}>
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
      </Scroll>
    </Screen>
  )
}
