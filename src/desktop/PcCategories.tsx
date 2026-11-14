import { KIND_LABELS } from '../lib/model'
import { CATEGORY_KINDS, CategoryPanel } from '../screens/Categories'

/** PC版の費目ページ。4種類の費目を並べて編集する */
export function PcCategories() {
  return (
    <div className="pc-page">
      <div className="pc-head">
        <h1>費目</h1>
      </div>
      <div className="cat-board">
        {CATEGORY_KINDS.map((kind) => (
          <section key={kind} className="panel cat-col" aria-label={`${KIND_LABELS[kind]}の費目`}>
            <CategoryPanel kind={kind} showTitle />
          </section>
        ))}
      </div>
      <p className="note">費目の名前を選ぶと、上の入力欄で名前を変更できます。使用中の費目を削除すると、選択肢から外れて過去の記録には残ります。</p>
    </div>
  )
}
