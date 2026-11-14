import type { CatKind, FixedCost } from '../lib/model'
import { Footer, Header, Screen, Scroll } from '../ui'
import { FixedFormFields } from './FixedFormFields'
import { useFixedForm } from './useFixedForm'

type Props = {
  fixed: FixedCost | null
  /** 新規登録のとき、サブスクとして管理をオンにして始める */
  subscriptionPreset: boolean
  onBack: () => void
  onSaved: () => void
  onOpenCategories: (kind: CatKind) => void
}

export function FixedFormScreen({ fixed, subscriptionPreset, onBack, onSaved, onOpenCategories }: Props) {
  const f = useFixedForm({ fixed, subscriptionPreset, onDone: onSaved })

  return (
    <Screen>
      <Header title={fixed ? '固定費を編集' : '固定費を登録'} onBack={onBack} backLabel="固定費の一覧に戻る" />
      <Scroll>
        <FixedFormFields f={f} onOpenCategories={onOpenCategories} />
      </Scroll>
      <Footer hint={f.fieldsMissing ? '名前、金額、費目を入力してください' : undefined}>
        {fixed && (
          <button type="button" className="btn-outline" onClick={f.remove} disabled={f.busy}>
            削除
          </button>
        )}
        <button type="button" className="btn-primary" disabled={f.invalid || f.busy} onClick={f.save}>
          {fixed ? '更新する' : '登録する'}
        </button>
      </Footer>
    </Screen>
  )
}
