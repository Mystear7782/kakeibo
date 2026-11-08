import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { CatKind, Category, FixedCost, Transaction } from './lib/model'
import { CalendarScreen } from './screens/Calendar'
import { CategoriesScreen } from './screens/Categories'
import { EntryScreen } from './screens/Entry'
import { FixedScreen } from './screens/Fixed'
import { FixedFormScreen } from './screens/FixedForm'
import { SubscriptionScreen } from './screens/Subscription'
import { TabBar, Toast, type Tab } from './ui'

type Screen = Tab | 'fixedForm' | 'categories'

type FixedTarget = { fixed: FixedCost | null; subscription: boolean; key: number; back: Tab }

type Props = {
  email: string
  onSignOut: () => void
}

export function Shell({ email, onSignOut }: Props) {
  const [screen, setScreen] = useState<Screen>('entry')
  const [categories, setCategories] = useState<Category[]>([])
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // 明細や固定費が変わるたびに増やし、各画面が読み直す合図にする
  const [version, setVersion] = useState(0)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [fixedTarget, setFixedTarget] = useState<FixedTarget | null>(null)
  const [catKind, setCatKind] = useState<CatKind>('expense')
  const [catBack, setCatBack] = useState<Screen>('entry')

  const notify = useCallback((text: string) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }, [])
  const clearEdit = useCallback(() => setEditTx(null), [])

  const reload = useCallback(async () => {
    const [cats, fixed] = await Promise.all([api.listCategories(), api.listFixedCosts()])
    setCategories(cats)
    setFixedCosts(fixed)
  }, [])

  const load = useCallback(async () => {
    setLoadError(false)
    try {
      await api.ensureDefaultCategories()
      await reload()
      setLoaded(true)
    } catch {
      setLoadError(true)
    }
  }, [reload])

  useEffect(() => {
    void load()
  }, [load])

  const changed = useCallback(() => {
    setVersion((v) => v + 1)
    reload().catch(() => notify('最新の状態を読み込めませんでした'))
  }, [reload, notify])

  function openFixedForm(fixed: FixedCost | null, subscription: boolean, back: Tab) {
    setFixedTarget({ fixed, subscription, key: Date.now(), back })
    setScreen('fixedForm')
  }

  function openCategories(kind: CatKind) {
    setCatKind(kind)
    setCatBack(screen)
    setScreen('categories')
  }

  function editTransaction(t: Transaction) {
    setEditTx(t)
    setScreen('entry')
  }

  const tab: Tab | null =
    screen === 'fixedForm' || screen === 'categories' ? null : screen

  if (!loaded) {
    return (
      <div className="app">
        <div className="center">
          {loadError ? (
            <>
              <p>データを読み込めませんでした</p>
              <button type="button" className="btn-primary btn-inline" onClick={() => void load()}>
                再読み込み
              </button>
            </>
          ) : (
            <p className="empty">読み込み中…</p>
          )}
        </div>
      </div>
    )
  }

  const formOpen = !!fixedTarget && (screen === 'fixedForm' || (screen === 'categories' && catBack === 'fixedForm'))

  return (
    <div className="app">
      <Toast text={toast} />

      {/* 入力と固定費フォームは、費目の編集へ移っても入力中の内容を残す */}
      <div className="screen-wrap" hidden={screen !== 'entry'}>
        <EntryScreen
          categories={categories}
          editTx={editTx}
          version={version}
          onClearEdit={clearEdit}
          onChanged={changed}
          onOpenCategories={openCategories}
          notify={notify}
        />
      </div>

      {formOpen && fixedTarget && (
        <div className="screen-wrap" hidden={screen !== 'fixedForm'}>
          <FixedFormScreen
            key={fixedTarget.key}
            fixed={fixedTarget.fixed}
            subscriptionPreset={fixedTarget.subscription}
            categories={categories}
            onBack={() => setScreen(fixedTarget.back)}
            onSaved={() => {
              changed()
              setScreen(fixedTarget.back)
            }}
            onOpenCategories={openCategories}
            notify={notify}
          />
        </div>
      )}

      {screen === 'calendar' && (
        <CalendarScreen
          categories={categories}
          fixedCosts={fixedCosts}
          version={version}
          onEditTransaction={editTransaction}
          onEditFixed={(f) => openFixedForm(f, false, 'calendar')}
          notify={notify}
        />
      )}
      {screen === 'fixed' && (
        <FixedScreen
          fixedCosts={fixedCosts}
          categories={categories}
          email={email}
          onNew={() => openFixedForm(null, false, 'fixed')}
          onOpen={(f) => openFixedForm(f, false, 'fixed')}
          onSignOut={onSignOut}
        />
      )}
      {screen === 'subscription' && (
        <SubscriptionScreen
          fixedCosts={fixedCosts}
          version={version}
          onNew={() => openFixedForm(null, true, 'subscription')}
          onOpen={(f) => openFixedForm(f, false, 'subscription')}
          notify={notify}
        />
      )}
      {screen === 'categories' && (
        <CategoriesScreen
          categories={categories}
          initialKind={catKind}
          onBack={() => setScreen(catBack)}
          onChanged={changed}
          notify={notify}
        />
      )}

      {tab !== null && <TabBar current={tab} onSelect={setScreen} />}
    </div>
  )
}
