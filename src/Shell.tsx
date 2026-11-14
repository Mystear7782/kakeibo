import { useState } from 'react'
import type { CatKind, FixedCost, ScheduleRow, Transaction } from './lib/model'
import { CalendarScreen } from './screens/Calendar'
import { CategoriesScreen } from './screens/Categories'
import { EntryScreen } from './screens/Entry'
import { FixedScreen } from './screens/Fixed'
import { FixedFormScreen } from './screens/FixedForm'
import { SubscriptionScreen } from './screens/Subscription'
import { useApp } from './state'
import { TabBar, Toast, type Tab } from './ui'

type Screen = Tab | 'fixedForm' | 'categories'

type FixedTarget = { fixed: FixedCost | null; subscription: boolean; key: number; back: Tab }

/** モバイル版の外枠（下タブ）。データと入力中の状態は AppProvider が持つ */
export function Shell() {
  const { toast, entry, changed, fixedCosts } = useApp()
  const [screen, setScreen] = useState<Screen>('entry')
  const [fixedTarget, setFixedTarget] = useState<FixedTarget | null>(null)
  const [catKind, setCatKind] = useState<CatKind>('expense')
  const [catBack, setCatBack] = useState<Screen>('entry')

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
    entry.startEdit(t)
    setScreen('entry')
  }

  function editSchedule(row: ScheduleRow) {
    const fixed = fixedCosts.find((f) => f.id === row.fixed_cost_id)
    if (fixed) openFixedForm(fixed, false, 'calendar')
  }

  const tab: Tab | null =
    screen === 'fixedForm' || screen === 'categories' ? null : screen

  const formOpen = !!fixedTarget && (screen === 'fixedForm' || (screen === 'categories' && catBack === 'fixedForm'))

  return (
    <div className="app">
      <Toast text={toast} />

      {/* 入力と固定費フォームは、費目の編集へ移っても入力中の内容を残す */}
      <div className="screen-wrap" hidden={screen !== 'entry'}>
        <EntryScreen onOpenCategories={openCategories} />
      </div>

      {formOpen && fixedTarget && (
        <div className="screen-wrap" hidden={screen !== 'fixedForm'}>
          <FixedFormScreen
            key={fixedTarget.key}
            fixed={fixedTarget.fixed}
            subscriptionPreset={fixedTarget.subscription}
            onBack={() => setScreen(fixedTarget.back)}
            onSaved={() => {
              changed()
              setScreen(fixedTarget.back)
            }}
            onOpenCategories={openCategories}
          />
        </div>
      )}

      {screen === 'calendar' && (
        <CalendarScreen onEditTransaction={editTransaction} onEditSchedule={editSchedule} />
      )}
      {screen === 'fixed' && (
        <FixedScreen
          onNew={() => openFixedForm(null, false, 'fixed')}
          onOpen={(f) => openFixedForm(f, false, 'fixed')}
        />
      )}
      {screen === 'subscription' && (
        <SubscriptionScreen
          onNew={() => openFixedForm(null, true, 'subscription')}
          onOpen={(f) => openFixedForm(f, false, 'subscription')}
        />
      )}
      {screen === 'categories' && (
        <CategoriesScreen initialKind={catKind} onBack={() => setScreen(catBack)} />
      )}

      {tab !== null && <TabBar current={tab} onSelect={setScreen} />}
    </div>
  )
}
