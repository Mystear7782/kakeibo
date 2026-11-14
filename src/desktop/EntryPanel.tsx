import { digitsOnly, num } from '../lib/format'
import { KIND_LABELS, PAY_LABELS, payMethodsFor, type TxType } from '../lib/model'
import { Chip } from '../ui'
import { accentOf, useEntry } from '../screens/useEntry'
import type { CSSProperties } from 'react'

const TYPES: TxType[] = ['expense', 'income', 'transfer']

type Props = {
  /** 費目の編集ページを開く */
  onOpenCategories: () => void
}

/** PC版の入力フォーム。常に表示し、選択日の内訳から明細を選ぶとここで編集する */
export function EntryPanel({ onOpenCategories }: Props) {
  const e = useEntry()
  const { draft: d, patch } = e

  return (
    <form className="panel" aria-label="入力" onSubmit={(ev) => ev.preventDefault()}>
      <div className="panel-head">
        <h2>{d.editing ? '明細を編集' : '入力'}</h2>
        {d.editing && (
          <button type="button" className="text-btn" onClick={e.reset}>
            編集をやめる
          </button>
        )}
      </div>

      <div className="segmented segmented-3">
        {TYPES.map((t) => (
          <Chip key={t} label={KIND_LABELS[t]} on={d.type === t} color={accentOf(t)} className="segment" onClick={() => e.changeType(t)} />
        ))}
      </div>

      <div className="grid grid-name">
        <div className="field">
          <label htmlFor="pc-amount">金額(円)</label>
          <input
            id="pc-amount"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            className="strong pc-amount"
            style={{ borderColor: e.accent } as CSSProperties}
            value={d.amount ? num(e.amountValue) : ''}
            onChange={(ev) => patch({ amount: digitsOnly(ev.target.value) })}
            onKeyDown={(ev) => {
              // 日本語入力の変換を確定するEnterでは登録しない
              if (ev.key === 'Enter' && !ev.nativeEvent.isComposing && ev.keyCode !== 229) {
                ev.preventDefault()
                void e.save()
              }
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="pc-date">日付</label>
          <input id="pc-date" type="date" value={d.date} onChange={(ev) => patch({ date: ev.target.value })} />
        </div>
      </div>
      {d.editing?.is_estimated && <p className="note">見込み額です。確定した金額に直して更新してください</p>}

      <div className="grid grid-2">
        <div className="field">
          <div className="label-row">
            <label className="label" htmlFor="pc-cat">
              費目
            </label>
            <button type="button" className="link-btn" style={{ color: e.accent }} onClick={onOpenCategories}>
              編集
            </button>
          </div>
          <select id="pc-cat" value={d.categoryId} onChange={(ev) => patch({ categoryId: ev.target.value })}>
            <option value="">選択してください</option>
            {e.chips.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <div className="label-row">
            <label className="label" htmlFor="pc-pay">
              {e.payLabel}
            </label>
          </div>
          <select id="pc-pay" value={d.pay} onChange={(ev) => patch({ pay: ev.target.value as typeof d.pay })}>
            {payMethodsFor(d.type).map((p) => (
              <option key={p} value={p}>
                {PAY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="pc-memo">メモ(任意)</label>
        <input
          id="pc-memo"
          autoComplete="off"
          placeholder="店名など"
          maxLength={200}
          value={d.memo}
          onChange={(ev) => patch({ memo: ev.target.value })}
        />
      </div>

      {e.invalid && <p className="hint">金額と費目を入力してください</p>}
      <div className="panel-actions">
        {d.editing && (
          <button type="button" className="btn-outline" onClick={e.remove} disabled={e.busy}>
            削除
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          style={{ '--c': e.accent } as CSSProperties}
          disabled={e.invalid || e.busy}
          onClick={e.save}
        >
          {d.editing ? '更新する' : '登録する(Enter)'}
        </button>
      </div>
    </form>
  )
}
