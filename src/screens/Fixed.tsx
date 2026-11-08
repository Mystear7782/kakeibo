import { useMemo } from 'react'
import { monthOf, todayJst } from '../lib/date'
import { num, yen } from '../lib/format'
import {
  PAY_LABELS,
  cycleLabel,
  fixedTotals,
  isEnded,
  sortFixedByDay,
  type Category,
  type FixedCost,
} from '../lib/model'
import { COLORS, Header, Screen, Scroll } from '../ui'

type Props = {
  fixedCosts: FixedCost[]
  categories: Category[]
  email: string
  onNew: () => void
  onOpen: (fixed: FixedCost) => void
  onSignOut: () => void
}

export function amountText(f: Pick<FixedCost, 'amount' | 'is_variable'>): string {
  return `${f.is_variable ? '約' : ''}${yen(f.amount)}`
}

export function FixedScreen({ fixedCosts, categories, email, onNew, onOpen, onSignOut }: Props) {
  const thisMonth = monthOf(todayJst())
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const totals = fixedTotals(fixedCosts, thisMonth)

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
        <div className="card">
          <div className="card-label">月額の合計(年払いは12か月で割る)</div>
          <div className="card-big" style={{ color: COLORS.expense }}>
            {yen(totals.monthly)}
          </div>
          <div className="card-sub">
            年額 {yen(totals.yearly)}・{num(totals.count)}件
          </div>
        </div>

        {fixedCosts.length === 0 && <p className="empty">固定費はまだ登録されていません</p>}
        <ul className="list">
          {sortFixedByDay(fixedCosts).map((f) => {
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
