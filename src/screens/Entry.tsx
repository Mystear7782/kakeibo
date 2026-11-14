import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { api } from '../api'
import { shortDate } from '../lib/date'
import { digitsOnly, num, yen } from '../lib/format'
import {
  KIND_LABELS,
  PAY_LABELS,
  payMethodsFor,
  type CatKind,
  type Transaction,
  type TxType,
} from '../lib/model'
import { useApp } from '../state'
import { Chip, Footer, Header, Screen, Scroll } from '../ui'
import { accentOf, useEntry } from './useEntry'

type Props = {
  onOpenCategories: (kind: CatKind) => void
}

const TYPES: TxType[] = ['expense', 'income', 'transfer']

export function txAmountText(t: Transaction): string {
  const sign = t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'
  return `${t.is_estimated ? '約' : ''}${sign}${yen(t.amount)}`
}

export const txColor = (t: Pick<Transaction, 'type'>): string =>
  t.type === 'income' ? '#8cc8ff' : t.type === 'transfer' ? '#a6adb8' : '#f2f3f5'

export function EntryScreen({ onOpenCategories }: Props) {
  const { categories, version, notify } = useApp()
  const e = useEntry()
  const { draft: d, patch } = e
  const [recent, setRecent] = useState<Transaction[]>([])

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  useEffect(() => {
    let live = true
    api
      .listRecentTransactions(5)
      .then((rows) => live && setRecent(rows))
      .catch(() => live && notify('明細を読み込めませんでした'))
    return () => {
      live = false
    }
  }, [version, notify])

  const btnStyle = { '--c': e.accent } as CSSProperties

  return (
    <Screen>
      <Header
        title={d.editing ? '明細を編集' : '入力'}
        right={
          d.editing && (
            <button type="button" className="text-btn" onClick={e.reset}>
              編集をやめる
            </button>
          )
        }
      />
      <Scroll>
        <div className="segmented segmented-3">
          {TYPES.map((t) => (
            <Chip
              key={t}
              label={KIND_LABELS[t]}
              on={d.type === t}
              color={accentOf(t)}
              className="segment"
              onClick={() => e.changeType(t)}
            />
          ))}
        </div>

        <div className="field">
          <label htmlFor="amount">金額</label>
          <div className="amount-row" style={{ borderBottomColor: e.accent }}>
            <span aria-hidden="true" style={{ color: e.accent }}>
              ¥
            </span>
            <input
              id="amount"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={d.amount ? num(e.amountValue) : ''}
              onChange={(ev) => patch({ amount: digitsOnly(ev.target.value) })}
            />
          </div>
          {d.editing?.is_estimated && (
            <p className="note">見込み額です。確定した金額に直して更新してください</p>
          )}
        </div>

        <div className="field">
          <label htmlFor="date">日付</label>
          <input id="date" type="date" value={d.date} onChange={(ev) => patch({ date: ev.target.value })} />
        </div>

        <fieldset className="field" aria-labelledby="catlabel">
          <div className="label-row">
            <span id="catlabel" className="label">
              費目
            </span>
            <button
              type="button"
              className="link-btn"
              style={{ color: e.accent }}
              onClick={() => onOpenCategories(d.type)}
            >
              編集
            </button>
          </div>
          <div className="grid grid-3">
            {e.chips.map((c) => (
              <Chip key={c.id} label={c.name} on={d.categoryId === c.id} color={e.accent} onClick={() => patch({ categoryId: c.id })} />
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="label">{e.payLabel}</legend>
          <div className="row">
            {payMethodsFor(d.type).map((p) => (
              <Chip key={p} label={PAY_LABELS[p]} on={d.pay === p} color={e.accent} onClick={() => patch({ pay: p })} />
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="memo">メモ(任意)</label>
          <input
            id="memo"
            autoComplete="off"
            placeholder="店名など"
            maxLength={200}
            value={d.memo}
            onChange={(ev) => patch({ memo: ev.target.value })}
          />
        </div>

        <section aria-label="最近の明細" className="recent">
          <h2>最近の明細</h2>
          {recent.length === 0 && <p className="empty">まだ明細がありません</p>}
          {recent.map((t) => (
            <button key={t.id} type="button" className="row-item" onClick={() => e.startEdit(t)}>
              <span className="row-day">{shortDate(t.occurred_on)}</span>
              <span className="row-main">
                <span className="row-title">{t.memo || catName.get(t.category_id) || ''}</span>
                <span className="row-sub">
                  {catName.get(t.category_id)}・{PAY_LABELS[t.payment_method]}
                </span>
              </span>
              <span className="row-amount" style={{ color: txColor(t) }}>
                {txAmountText(t)}
              </span>
            </button>
          ))}
        </section>
      </Scroll>
      <Footer hint={e.invalid ? '金額と費目を入力してください' : undefined}>
        {d.editing && (
          <button type="button" className="btn-outline" onClick={e.remove} disabled={e.busy}>
            削除
          </button>
        )}
        <button type="button" className="btn-primary" style={btnStyle} disabled={e.invalid || e.busy} onClick={e.save}>
          {d.editing ? '更新する' : '登録する'}
        </button>
      </Footer>
    </Screen>
  )
}
