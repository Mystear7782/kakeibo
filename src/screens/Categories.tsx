import { useState, type CSSProperties } from 'react'
import { api } from '../api'
import { KIND_LABELS, type CatKind, type Category } from '../lib/model'
import { COLORS, Chip, Header, Screen, Scroll } from '../ui'

type Props = {
  categories: Category[]
  initialKind: CatKind
  onBack: () => void
  onChanged: () => void
  notify: (text: string) => void
}

const KINDS: CatKind[] = ['expense', 'income', 'transfer', 'fixed']

export function CategoriesScreen({ categories, initialKind, onBack, onChanged, notify }: Props) {
  const [kind, setKind] = useState<CatKind>(initialKind)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)

  const ofKind = categories.filter((c) => c.kind === kind).sort((a, b) => a.sort_order - b.sort_order)
  const visible = ofKind.filter((c) => !c.is_hidden)
  const hidden = ofKind.filter((c) => c.is_hidden)

  const trimmed = name.trim()
  const same = ofKind.find((c) => c.name === trimmed && c.id !== editing?.id)
  // 追加のとき、同名の費目が非表示なら元に戻す。それ以外の同名は登録できない
  const restorable = !editing && same?.is_hidden ? same : null
  const duplicate = !!same && !restorable
  const invalid = !trimmed || duplicate
  const nextOrder = ofKind.reduce((max, c) => Math.max(max, c.sort_order), 0) + 10

  function pickKind(next: CatKind) {
    setKind(next)
    setName('')
    setEditing(null)
  }

  async function run(action: () => Promise<void>, done?: string, failed = '保存できませんでした') {
    if (busy) return
    setBusy(true)
    try {
      await action()
      if (done) notify(done)
      onChanged()
    } catch {
      notify(failed)
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (invalid) return
    const target = editing
    const revive = restorable
    await run(
      async () => {
        if (target) await api.updateCategory(target.id, { name: trimmed })
        else if (revive) await api.updateCategory(revive.id, { is_hidden: false, sort_order: nextOrder })
        else await api.addCategory(kind, trimmed, nextOrder)
        setName('')
        setEditing(null)
      },
      target ? '更新しました' : revive ? '非表示だった費目を戻しました' : '追加しました',
    )
  }

  async function move(index: number, delta: number) {
    const list = visible.slice()
    const [item] = list.splice(index, 1)
    list.splice(index + delta, 0, item)
    // 並び順を10刻みで振り直し、変わった行だけ更新する
    const changes = list
      .map((c, i) => ({ c, order: (i + 1) * 10 }))
      .filter(({ c, order }) => c.sort_order !== order)
    await run(
      async () => {
        await Promise.all(changes.map(({ c, order }) => api.updateCategory(c.id, { sort_order: order })))
      },
      '並び替えました',
    )
  }

  async function remove(c: Category) {
    await run(
      async () => {
        const used = await api.isCategoryUsed(c.id)
        if (used) await api.updateCategory(c.id, { is_hidden: true })
        else await api.deleteCategory(c.id)
        if (editing?.id === c.id) {
          setEditing(null)
          setName('')
        }
        notify(used ? '選択肢から外しました。過去の記録には残ります' : '削除しました')
      },
    )
  }

  async function restore(c: Category) {
    await run(() => api.updateCategory(c.id, { is_hidden: false, sort_order: nextOrder }), '戻しました')
  }

  return (
    <Screen>
      <Header title="費目の編集" onBack={onBack} backLabel="前の画面に戻る" />
      <Scroll>
        <div className="segmented segmented-4">
          {KINDS.map((k) => (
            <Chip key={k} label={KIND_LABELS[k]} on={kind === k} color={COLORS.expense} className="segment" onClick={() => pickKind(k)} />
          ))}
        </div>

        <div className="field">
          <label htmlFor="catname">
            {editing ? `「${editing.name}」の名前を変更` : `${KIND_LABELS[kind]}の費目を追加`}
          </label>
          <div className="row">
            <input
              id="catname"
              autoComplete="off"
              placeholder="費目の名前"
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              className="btn-small"
              style={{ '--c': COLORS.expense } as CSSProperties}
              disabled={invalid || busy}
              onClick={save}
            >
              {editing ? '更新' : '追加'}
            </button>
          </div>
          {duplicate && <p className="note">同じ名前の費目があります</p>}
          {restorable && <p className="note">非表示にした同じ名前の費目を元に戻します</p>}
        </div>

        <ul className="cat-list">
          {visible.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                className="cat-name"
                style={{ fontWeight: c.id === editing?.id ? 700 : 400 }}
                onClick={() => {
                  setEditing(c)
                  setName(c.name)
                }}
              >
                {c.name}
              </button>
              <button type="button" aria-label={`${c.name}を上へ移動`} className="icon-btn" disabled={i === 0 || busy} onClick={() => move(i, -1)}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 14V4M4.5 8.5 9 4l4.5 4.5" />
                </svg>
              </button>
              <button type="button" aria-label={`${c.name}を下へ移動`} className="icon-btn" disabled={i === visible.length - 1 || busy} onClick={() => move(i, 1)}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 4v10M4.5 9.5 9 14l4.5-4.5" />
                </svg>
              </button>
              <button type="button" aria-label={`${c.name}を削除`} className="icon-btn" disabled={busy} onClick={() => remove(c)}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m4.5 4.5 9 9M13.5 4.5l-9 9" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {hidden.length > 0 && (
          <section aria-label="非表示の費目" className="recent">
            <h2>非表示の費目</h2>
            <ul className="cat-list">
              {hidden.map((c) => (
                <li key={c.id}>
                  <span className="cat-name cat-hidden">{c.name}</span>
                  <button type="button" className="text-btn" disabled={busy} onClick={() => restore(c)}>
                    戻す
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Scroll>
    </Screen>
  )
}
