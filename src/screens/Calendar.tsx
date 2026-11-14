import { shiftedSelection, todayJst } from '../lib/date'
import { yen } from '../lib/format'
import type { ScheduleRow, Transaction } from '../lib/model'
import { useApp } from '../state'
import { COLORS, Scroll, Screen } from '../ui'
import { DayDetail, MonthCalendar, useMonthData } from './calendar-parts'

type Props = {
  onEditTransaction: (t: Transaction) => void
  onEditSchedule: (row: ScheduleRow) => void
}

const MUTED = '#a6adb8'

export function CalendarScreen({ onEditTransaction, onEditSchedule }: Props) {
  const { cal } = useApp()
  const { month, day } = cal
  const { transactions, schedule, summary } = useMonthData(month)
  const [y, m] = month.split('-').map(Number)

  const shift = (delta: number) => {
    const next = shiftedSelection(month, delta)
    cal.select(next.month, next.day)
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

        <MonthCalendar
          month={month}
          day={day}
          today={todayJst()}
          summary={summary}
          onPick={(d) => cal.select(month, d)}
        />

        <DayDetail
          month={month}
          day={day}
          transactions={transactions}
          schedule={schedule}
          onEditTransaction={onEditTransaction}
          onEditSchedule={onEditSchedule}
        />
      </Scroll>
    </Screen>
  )
}
