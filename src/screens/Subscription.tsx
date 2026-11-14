import { useEffect, useState } from 'react'
import { api } from '../api'
import { todayJst, yearOf } from '../lib/date'
import { num, yen } from '../lib/format'
import {
  PAY_LABELS,
  subscriptionTotals,
  type FixedCost,
  type SubscriptionRow,
} from '../lib/model'
import { useApp } from '../state'
import { COLORS, Header, Screen, Scroll } from '../ui'

/** サブスクの一覧と金額を読み込む。明細や固定費が変わると読み直す */
export function useSubscriptionRows() {
  const { version, notify } = useApp()
  const [rows, setRows] = useState<SubscriptionRow[] | null>(null)
  const year = yearOf(todayJst())

  useEffect(() => {
    let live = true
    api
      .getSubscriptionSummary(year)
      .then((data) => live && setRows(data))
      .catch(() => live && notify('サブスクを読み込めませんでした'))
    return () => {
      live = false
    }
  }, [year, version, notify])

  return { rows, year }
}

type BodyProps = {
  rows: SubscriptionRow[] | null
  year: number
  onOpen: (row: SubscriptionRow) => void
  /** 選択中の行（PC版で、右の編集フォームに開いているもの） */
  selectedId?: string | null
}

/** サブスクの合計カードと一覧。モバイル版の画面とPC版の左側の両方で使う */
export function SubscriptionBody({ rows, year, onOpen, selectedId }: BodyProps) {
  const totals = subscriptionTotals(rows ?? [])
  const active = (rows ?? []).filter((r) => !r.is_cancelled)
  const cancelled = (rows ?? []).filter((r) => r.is_cancelled)
  const rowClass = (id: string) => (selectedId === id ? 'row-card is-selected' : 'row-card')

  return (
    <>
      <div className="card">
        <div className="card-label">月額換算の合計(年払いは12か月で割る)</div>
        <div className="card-big" style={{ color: COLORS.expense }}>
          {yen(totals.monthly)}
        </div>
        <div className="stats">
          <div>
            <span className="card-label">年額換算</span>
            <span className="stat-value">{yen(totals.yearly)}</span>
          </div>
          <div>
            <span className="card-label">{year}年の支払額</span>
            <span className="stat-value">{yen(totals.paidInYear)}</span>
          </div>
          <div>
            <span className="card-label">累計の支払額</span>
            <span className="stat-value">{yen(totals.paidTotal)}</span>
          </div>
        </div>
      </div>

      {rows === null && <p className="empty">読み込み中…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="empty">
          サブスクはまだありません。固定費の登録で「サブスクとして管理」をオンにすると、ここに表示されます
        </p>
      )}

      {active.length > 0 && (
        <section aria-label="利用中のサブスク" className="recent">
          <h2>利用中({num(active.length)}件)</h2>
          <ul className="list">
            {active.map((r) => (
              <li key={r.fixed_cost_id}>
                <button
                  type="button"
                  className={rowClass(r.fixed_cost_id)}
                  aria-current={selectedId === r.fixed_cost_id ? 'true' : undefined}
                  onClick={() => onOpen(r)}
                >
                  <span className="row-main">
                    <span className="row-title">{r.name}</span>
                    <span className="row-sub">
                      {r.cycle === 'yearly' ? '年払い' : '月払い'}・{PAY_LABELS[r.payment_method]}・年額 {yen(r.yearly_amount)}
                    </span>
                  </span>
                  <span className="row-side">
                    <span className="row-amount">
                      {yen(r.amount)}
                      <span className="unit">/{r.cycle === 'yearly' ? '年' : '月'}</span>
                    </span>
                    <span className="row-sub">累計 {yen(r.paid_total)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cancelled.length > 0 && (
        <section aria-label="解約済みのサブスク" className="recent">
          <h2>解約済み({num(cancelled.length)}件)</h2>
          <ul className="list">
            {cancelled.map((r) => (
              <li key={r.fixed_cost_id}>
                <button
                  type="button"
                  className={rowClass(r.fixed_cost_id)}
                  aria-current={selectedId === r.fixed_cost_id ? 'true' : undefined}
                  style={{ opacity: 0.6 }}
                  onClick={() => onOpen(r)}
                >
                  <span className="row-main">
                    <span className="row-title">{r.name}</span>
                    <span className="row-sub">
                      {r.end_month ? `${r.end_month.slice(0, 4)}年${Number(r.end_month.slice(5, 7))}月まで` : ''}
                    </span>
                  </span>
                  <span className="row-side">
                    <span className="row-amount">{yen(r.paid_total)}</span>
                    <span className="row-sub">累計</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="note">金額は記録済みの明細の合計です。解約するときは固定費を削除せず、終了月を入れてください。</p>
    </>
  )
}

type Props = {
  onNew: () => void
  onOpen: (fixed: FixedCost) => void
}

export function SubscriptionScreen({ onNew, onOpen }: Props) {
  const { fixedCosts } = useApp()
  const { rows, year } = useSubscriptionRows()

  function open(row: SubscriptionRow) {
    const fixed = fixedCosts.find((f) => f.id === row.fixed_cost_id)
    if (fixed) onOpen(fixed)
  }

  return (
    <Screen>
      <Header
        title="サブスク"
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
        <SubscriptionBody rows={rows} year={year} onOpen={open} />
      </Scroll>
    </Screen>
  )
}
