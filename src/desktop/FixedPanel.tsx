import type { FixedCost } from '../lib/model'
import { FixedFormFields } from '../screens/FixedFormFields'
import { useFixedForm, type FixedSaveResult } from '../screens/useFixedForm'

type Props = {
  fixed: FixedCost | null
  /** 新規登録のとき、サブスクとして管理をオンにして始める */
  subscriptionPreset: boolean
  onDone: (result: FixedSaveResult) => void
}

/** PC版の固定費の編集フォーム（固定費ページとサブスクページの右側） */
export function FixedPanel({ fixed, subscriptionPreset, onDone }: Props) {
  const f = useFixedForm({ fixed, subscriptionPreset, onDone })

  return (
    <form className="panel" aria-label="固定費の編集" onSubmit={(ev) => ev.preventDefault()}>
      <div className="panel-head">
        <h2>{fixed ? `「${fixed.name}」を編集` : '固定費を登録'}</h2>
      </div>
      <FixedFormFields f={f} idPrefix="pf-" />
      {f.fieldsMissing && <p className="hint">名前、金額、費目を入力してください</p>}
      <div className="panel-actions">
        {fixed && (
          <button type="button" className="btn-outline" onClick={f.remove} disabled={f.busy}>
            削除
          </button>
        )}
        <button type="button" className="btn-primary" disabled={f.invalid || f.busy} onClick={f.save}>
          {fixed ? '更新する' : '登録する'}
        </button>
      </div>
    </form>
  )
}
