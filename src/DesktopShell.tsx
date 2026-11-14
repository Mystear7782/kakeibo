import { useState } from 'react'
import { PcCategories } from './desktop/PcCategories'
import { PcFixed, type FixedSelection } from './desktop/PcFixed'
import { PcHome } from './desktop/PcHome'
import { PcSubscription } from './desktop/PcSubscription'
import { useApp } from './state'
import { Toast } from './ui'

type Page = 'home' | 'fixed' | 'subscription' | 'categories'

const NAV: { id: Page; label: string }[] = [
  { id: 'home', label: 'ホーム' },
  { id: 'fixed', label: '固定費' },
  { id: 'subscription', label: 'サブスク' },
  { id: 'categories', label: '費目' },
]

const select = (id: string | null): FixedSelection => ({ id, key: Date.now() })

/** PC版の外枠（左サイドバー）。データと入力中の状態は AppProvider が持つ */
export function DesktopShell() {
  const { toast, email, onSignOut } = useApp()
  const [page, setPage] = useState<Page>('home')
  const [fixedSel, setFixedSel] = useState<FixedSelection>(() => select(null))
  const [subSel, setSubSel] = useState<FixedSelection>(() => select(null))

  // ホームの内訳で固定費を選ぶと、固定費ページでその固定費の編集フォームを開く
  function editFixed(id: string) {
    setFixedSel(select(id))
    setPage('fixed')
  }

  return (
    <div className="desk">
      <Toast text={toast} />
      <nav aria-label="メイン" className="desk-nav">
        <div className="desk-brand">家計簿</div>
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-current={page === n.id ? 'page' : undefined}
            className="desk-nav-item"
            onClick={() => setPage(n.id)}
          >
            {n.label}
          </button>
        ))}
        <div className="desk-spacer" />
        <div className="desk-account">{email}</div>
        <button type="button" className="desk-logout" onClick={onSignOut}>
          ログアウト
        </button>
      </nav>

      <main className={page === 'categories' ? 'desk-main' : 'desk-main is-split'}>
        {page === 'home' && <PcHome onEditFixed={editFixed} onOpenCategories={() => setPage('categories')} />}
        {page === 'fixed' && <PcFixed selection={fixedSel} onSelect={(id) => setFixedSel(select(id))} />}
        {page === 'subscription' && <PcSubscription selection={subSel} onSelect={(id) => setSubSel(select(id))} />}
        {page === 'categories' && <PcCategories />}
      </main>
    </div>
  )
}
