import { SubscriptionBody, useSubscriptionRows } from '../screens/Subscription'
import { useApp } from '../state'
import { FixedPanel } from './FixedPanel'
import type { FixedSelection } from './PcFixed'

type Props = {
  selection: FixedSelection
  /** null で「追加」（サブスクとして管理がオンの空のフォーム） */
  onSelect: (id: string | null) => void
}

/** PC版のサブスクページ。左に一覧と合計、右に編集フォーム */
export function PcSubscription({ selection, onSelect }: Props) {
  const { fixedCosts, changed } = useApp()
  const { rows, year } = useSubscriptionRows()
  const current = fixedCosts.find((f) => f.id === selection.id) ?? null

  return (
    <div className="pc-split">
      <section aria-label="サブスクの一覧" className="pc-col pc-stack">
        <div className="pc-head">
          <h1>サブスク</h1>
          <button type="button" className="pc-add" onClick={() => onSelect(null)}>
            + 追加
          </button>
        </div>
        <SubscriptionBody rows={rows} year={year} selectedId={selection.id} onOpen={(row) => onSelect(row.fixed_cost_id)} />
      </section>

      <aside aria-label="サブスクの編集" className="pc-col">
        <FixedPanel
          key={selection.key}
          fixed={current}
          subscriptionPreset
          onDone={(result) => {
            changed()
            if (result !== 'updated') onSelect(null)
          }}
        />
      </aside>
    </div>
  )
}
