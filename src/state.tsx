import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'
import { monthOf, todayJst } from './lib/date'
import type { Category, FixedCost, PayMethod, Transaction, TxType } from './lib/model'

// モバイル版とPC版は、同じ状態を使う。ウィンドウ幅の変更で外枠が入れ替わっても、
// 入力中の内容、編集中の明細、選択中の月と日、読み込み済みのデータを失わない。

export interface EntryDraft {
  type: TxType
  amount: string
  date: string
  categoryId: string
  pay: PayMethod
  memo: string
  /** 編集中の明細。null なら新規入力 */
  editing: Transaction | null
}

export interface AppState {
  email: string
  onSignOut: () => void

  categories: Category[]
  fixedCosts: FixedCost[]
  /** 明細や固定費が変わるたびに増える。各画面が読み直す合図になる */
  version: number
  /** 変更の後に呼ぶ。version を進め、費目と固定費を読み直す */
  changed: () => void

  toast: string
  notify: (text: string) => void

  entry: {
    draft: EntryDraft
    patch: (p: Partial<EntryDraft>) => void
    startEdit: (t: Transaction) => void
    /** 金額・費目・メモを空にして、新規入力に戻す */
    reset: () => void
  }

  cal: {
    month: string
    day: number
    select: (month: string, day: number) => void
  }
}

const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('AppProvider の中で使ってください')
  return ctx
}

type Props = {
  email: string
  onSignOut: () => void
  children: ReactNode
}

export function AppProvider({ email, onSignOut, children }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [version, setVersion] = useState(0)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const notify = useCallback((text: string) => {
    setToast(text)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1800)
  }, [])

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

  // ===== 入力フォーム =====
  const [draft, setDraft] = useState<EntryDraft>(() => ({
    type: 'expense',
    amount: '',
    date: todayJst(),
    categoryId: '',
    pay: 'card',
    memo: '',
    editing: null,
  }))
  const patchDraft = useCallback((p: Partial<EntryDraft>) => setDraft((d) => ({ ...d, ...p })), [])
  const startEdit = useCallback((t: Transaction) => {
    setDraft({
      type: t.type as TxType,
      amount: String(t.amount),
      date: t.occurred_on,
      categoryId: t.category_id,
      pay: t.payment_method as PayMethod,
      memo: t.memo,
      editing: t,
    })
  }, [])
  const resetDraft = useCallback(
    () => setDraft((d) => ({ ...d, editing: null, amount: '', categoryId: '', memo: '' })),
    [],
  )

  // ===== カレンダーの選択 =====
  const [cal, setCal] = useState(() => {
    const today = todayJst()
    return { month: monthOf(today), day: Number(today.slice(8, 10)) }
  })
  const select = useCallback((month: string, day: number) => setCal({ month, day }), [])

  const value = useMemo<AppState>(
    () => ({
      email,
      onSignOut,
      categories,
      fixedCosts,
      version,
      changed,
      toast,
      notify,
      entry: { draft, patch: patchDraft, startEdit, reset: resetDraft },
      cal: { ...cal, select },
    }),
    [email, onSignOut, categories, fixedCosts, version, changed, toast, notify, draft, patchDraft, startEdit, resetDraft, cal, select],
  )

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

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
