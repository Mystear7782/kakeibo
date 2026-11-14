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
} from '../lib/model'
import { FixedFilterSwitch, amountText, emptyFixedMessage } from '../screens/Fixed'
import { useApp } from '../state'
import { FixedPanel } from './FixedPanel'

export type FixedSelection = { id: string | null; key: number }

type Props = {
  selection: FixedSelection
  /** null で「追加」（空のフォーム） */
  onSelect: (id: string | null) => void
}

/** PC版の固定費ページ。左に一覧表、右に編集フォーム */
export function PcFixed({ selection, onSelect }: Props) {
  const { fixedCosts, categories, changed, fixedFilter, setFixedFilter } = useApp()
  const thisMonth = monthOf(todayJst())
  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])
  const shown = filterFixed(fixedCosts, fixedFilter)
  const totals = fixedTotals(shown, thisMonth)
  const emptyMessage = shown.length === 0 ? emptyFixedMessage(fixedCosts.length, fixedFilter) : null
  // 絞り込みで一覧から外れた固定費でも、開いている間は右のフォームで編集できる
  const current = fixedCosts.find((f) => f.id === selection.id) ?? null

  const stats = [
    {
      label: fixedFilter === 'all' ? '月額の合計(年払いは12か月で割る)' : '月額の合計(サブスクを除く)',
      value: yen(totals.monthly),
    },
    { label: '年額', value: yen(totals.yearly) },
    { label: '件数', value: `${num(totals.count)}件` },
  ]

  return (
    <div className="pc-split">
      <section aria-label="固定費の一覧" className="pc-col pc-stack">
        <div className="pc-head">
          <h1>固定費</h1>
          <button type="button" className="pc-add" onClick={() => onSelect(null)}>
            + 追加
          </button>
        </div>

        <FixedFilterSwitch value={fixedFilter} onChange={setFixedFilter} className="pc-filter" />

        <div className="pc-stats">
          {stats.map((s) => (
            <div key={s.label} className="stat-tile">
              <div className="card-label">{s.label}</div>
              <div className="stat-big">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="table-wrap">
          <table className="fixed-table">
            <thead>
              <tr>
                <th scope="col">名前</th>
                <th scope="col">費目</th>
                <th scope="col">支払日</th>
                <th scope="col">支払方法</th>
                <th scope="col">記録</th>
                <th scope="col" className="num">
                  金額
                </th>
              </tr>
            </thead>
            <tbody>
              {emptyMessage && (
                <tr>
                  <td colSpan={6} className="table-empty">
                    {emptyMessage}
                  </td>
                </tr>
              )}
              {sortFixedByDay(shown).map((f) => {
                const ended = isEnded(f, thisMonth)
                const selected = f.id === selection.id
                return (
                  <tr
                    key={f.id}
                    className={selected ? 'is-selected' : undefined}
                    style={ended ? { opacity: 0.6 } : undefined}
                    onClick={() => onSelect(f.id)}
                  >
                    <td>
                      <button type="button" aria-current={selected ? 'true' : undefined} className="table-name">
                        {f.name}
                        {f.is_subscription && <span className="tag">サブスク</span>}
                        {ended && <span className="tag">終了</span>}
                      </button>
                    </td>
                    <td>{catName.get(f.category_id)}</td>
                    <td>{cycleLabel(f)}</td>
                    <td>{PAY_LABELS[f.payment_method]}</td>
                    <td className="muted">{f.auto_record ? '自動' : '手動'}</td>
                    <td className="num strong">{amountText(f)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="note">行を選ぶと右側で編集できます。年払いは月額合計に12分の1で含めます。</p>
      </section>

      <aside aria-label="固定費の編集" className="pc-col">
        <FixedPanel
          key={selection.key}
          fixed={current}
          subscriptionPreset={false}
          onDone={(result) => {
            changed()
            // 登録と削除のあとは空のフォームに戻す。更新のあとは同じ行を開いたままにする
            if (result !== 'updated') onSelect(null)
          }}
        />
      </aside>
    </div>
  )
}
