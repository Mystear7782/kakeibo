import { useMemo } from 'react'
import { monthOf, todayJst } from '../lib/date'
import { num, yen } from '../lib/format'
import {
  PAY_LABELS,
  cycleLabel,
  filterFixed,
  fixedTotals,
  isEnded,
  sortFixedByDay,
  type FixedCost,
  type FixedFilter,
} from '../lib/model'
import { useApp } from '../state'
import { COLORS, Chip, Header, Screen, Scroll } from '../ui'

type Props = {
  onNew: () => void
  onOpen: (fixed: FixedCost) => void
}

export function amountText(f: Pick<FixedCost, 'amount' | 'is_variable'>): string {
  return `${f.is_variable ? '約' : ''}${yen(f.amount)}`
}

/** 一覧と合計に、サブスクを含めるかを切り替える。モバイル版とPC版の固定費画面で使う */
export function FixedFilterSwitch({
  value,
  onChange,
  className,
}: {
  value: FixedFilter
  onChange: (filter: FixedFilter) => void
  className?: string
}) {
  return (
    <div role="group" aria-label="固定費の表示" className={className ? `segmented segmented-2 ${className}` : 'segmented segmented-2'}>
      <Chip label="すべて" on={value === 'all'} color={COLORS.expense} className="segment" onClick={() => onChange('all')} />
      <Chip
        label="サブスクを除く"
        on={value === 'exclude-subscription'}
        color={COLORS.expense}
        className="segment"
        onClick={() => onChange('exclude-subscription')}
      />
    </div>
  )
}

/** 絞り込みに合わせた、一覧が空のときの案内 */
export function emptyFixedMessage(total: number, filter: FixedFilter): string | null {
  if (total === 0) return '固定費はまだ登録されていません'
  if (filter === 'exclude-subscription') return 'サブスク以外の固定費はありません'
  return null
}

export function FixedScreen({ onNew, onOpen }: Props) {
  const { fixedCosts, categories, email, onSignOut, fixedFilter, setFixedFilter } = useApp()
  const thisMonth = monthOf(todayJst())
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const shown = filterFixed(fixedCosts, fixedFilter)
  const totals = fixedTotals(shown, thisMonth)
  const emptyMessage = shown.length === 0 ? emptyFixedMessage(fixedCosts.length, fixedFilter) : null

  return (
    <Screen>
      <Header
        title="固定費"
        right={
          <button type="button" className="btn-add" onClick={onNew}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            追加
          </button>
        }
      />
      <Scroll>
        <FixedFilterSwitch value={fixedFilter} onChange={setFixedFilter} />
        <div className="card">
          <div className="card-label">
            {fixedFilter === 'all' ? '月額の合計(年払いは12か月で割る)' : '月額の合計(サブスクを除く・年払いは12か月で割る)'}
          </div>
          <div className="card-big" style={{ color: COLORS.expense }}>
            {yen(totals.monthly)}
          </div>
          <div className="card-sub">
            年額 {yen(totals.yearly)}・{num(totals.count)}件
          </div>
        </div>

        {emptyMessage && <p className="empty">{emptyMessage}</p>}
        <ul className="list">
          {sortFixedByDay(shown).map((f) => {
            const ended = isEnded(f, thisMonth)
            return (
              <li key={f.id}>
                <button type="button" className="row-card" onClick={() => onOpen(f)} style={ended ? { opacity: 0.6 } : undefined}>
                  <span className="row-main">
                    <span className="row-title">
                      {f.name}
                      {f.is_subscription && <span className="tag">サブスク</span>}
                      {ended && <span className="tag">終了</span>}
                    </span>
                    <span className="row-sub">
                      {cycleLabel(f)}・{catName.get(f.category_id)}・{PAY_LABELS[f.payment_method]}
                    </span>
                  </span>
                  <span className="row-side">
                    <span className="row-amount">{amountText(f)}</span>
                    <span className="row-sub">{f.auto_record ? '自動で記録' : '手動で記録'}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="account">
          <span>{email}</span>
          <button type="button" className="text-btn" onClick={onSignOut}>
            ログアウト
          </button>
        </div>
      </Scroll>
    </Screen>
  )
}
