import { dateOf, daysInMonth, monthOf, shiftedSelection, todayJst } from '../lib/date'
import { yen } from '../lib/format'
import type { ScheduleRow } from '../lib/model'
import { DayDetail, MonthCalendar, useMonthData } from '../screens/calendar-parts'
import { useApp } from '../state'
import { COLORS } from '../ui'
import { EntryPanel } from './EntryPanel'

type Props = {
  onEditFixed: (fixedCostId: string) => void
  onOpenCategories: () => void
}

const MUTED = '#a6adb8'

/** PC版のホーム。集計、カレンダー、入力フォーム、選択日の内訳を1画面に出す */
export function PcHome({ onEditFixed, onOpenCategories }: Props) {
  const { cal, entry } = useApp()
  const { month, day } = cal
  const { transactions, schedule, summary } = useMonthData(month)
  const today = todayJst()
  const [y, m] = month.split('-').map(Number)

  // 日付を選ぶと、入力フォームの日付もその日になる。明細を編集中は、編集中の日付を変えない
  function select(nextMonth: string, nextDay: number) {
    cal.select(nextMonth, nextDay)
    if (!entry.draft.editing) {
      entry.patch({ date: dateOf(nextMonth, Math.min(nextDay, daysInMonth(nextMonth))) })
    }
  }

  function shift(delta: number) {
    const next = shiftedSelection(month, delta)
    select(next.month, next.day)
  }

  const stats = [
    { label: '月の支払い(予定を含む)', value: yen(summary.paid + summary.planned), color: '#f2f3f5' },
    { label: '支払い済み', value: yen(summary.paid), color: '#f2f3f5' },
    { label: 'これから', value: yen(summary.planned), color: MUTED },
    { label: '収入', value: yen(summary.income), color: COLORS.income },
    { label: '振替/投資', value: yen(summary.transfer), color: COLORS.transfer },
  ]

  return (
    <div className="pc-split">
      <section aria-label="カレンダー" className="pc-col pc-stack">
        <div className="pc-month">
          <button type="button" aria-label="前の月" className="pc-square" onClick={() => shift(-1)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.5 4 6.5 10l6 6" />
            </svg>
          </button>
          <h1>
            {y}年{m}月
          </h1>
          <button type="button" aria-label="次の月" className="pc-square" onClick={() => shift(1)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m7.5 4 6 6-6 6" />
            </svg>
          </button>
          <button
            type="button"
            className="pc-outline"
            disabled={month === monthOf(today) && day === Number(today.slice(8, 10))}
            onClick={() => select(monthOf(today), Number(today.slice(8, 10)))}
          >
            今月
          </button>
        </div>

        <div className="pc-stats">
          {stats.map((s) => (
            <div key={s.label} className="stat-tile">
              <div className="card-label">{s.label}</div>
              <div className="stat-big" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <MonthCalendar
            month={month}
            day={day}
            today={today}
            summary={summary}
            variant="pc"
            onPick={(d) => select(month, d)}
          />
        </div>
      </section>

      <aside aria-label="入力と内訳" className="pc-col pc-stack">
        <EntryPanel onOpenCategories={onOpenCategories} />
        <div className="panel">
          <DayDetail
            month={month}
            day={day}
            transactions={transactions}
            schedule={schedule}
            onEditTransaction={entry.startEdit}
            onEditSchedule={(row: ScheduleRow) => onEditFixed(row.fixed_cost_id)}
          />
        </div>
      </aside>
    </div>
  )
}
