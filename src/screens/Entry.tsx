import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { api } from '../api'
import { shortDate, todayJst } from '../lib/date'
import { digitsOnly, num, yen } from '../lib/format'
import {
  KIND_LABELS,
  PAY_LABELS,
  defaultPay,
  payMethodsFor,
  type CatKind,
  type Category,
  type PayMethod,
  type Transaction,
  type TransactionInput,
  type TxType,
} from '../lib/model'
import { COLORS, Chip, Footer, Header, Screen, Scroll } from '../ui'

type Props = {
  categories: Category[]
  /** カレンダーなどから編集を開始するときに渡される。取り込んだら onClearEdit で空に戻す */
  editTx: Transaction | null
  version: number
  onClearEdit: () => void
  onChanged: () => void
  onOpenCategories: (kind: CatKind) => void
  notify: (text: string) => void
}

const TYPES: TxType[] = ['expense', 'income', 'transfer']

const accentOf = (type: TxType) => COLORS[type]

export function txAmountText(t: Transaction): string {
  const sign = t.type === 'income' ? '+' : t.type === 'transfer' ? '' : '-'
  return `${t.is_estimated ? '約' : ''}${sign}${yen(t.amount)}`
}

export const txColor = (t: Pick<Transaction, 'type'>): string =>
  t.type === 'income' ? COLORS.income : t.type === 'transfer' ? '#a6adb8' : '#f2f3f5'

export function EntryScreen({
  categories,
  editTx,
  version,
  onClearEdit,
  onChanged,
  onOpenCategories,
  notify,
}: Props) {
  const [type, setType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayJst())
  const [categoryId, setCategoryId] = useState('')
  const [pay, setPay] = useState<PayMethod>('card')
  const [memo, setMemo] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [recent, setRecent] = useState<Transaction[]>([])
  const [busy, setBusy] = useState(false)

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  function startEdit(t: Transaction) {
    setEditing(t)
    setType(t.type as TxType)
    setAmount(String(t.amount))
    setDate(t.occurred_on)
    setCategoryId(t.category_id)
    setPay(t.payment_method as PayMethod)
    setMemo(t.memo)
  }

  function resetForm() {
    setEditing(null)
    setAmount('')
    setCategoryId('')
    setMemo('')
  }

  useEffect(() => {
    if (!editTx) return
    startEdit(editTx)
    onClearEdit()
  }, [editTx, onClearEdit])

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

  const visible = categories
    .filter((c) => c.kind === type && !c.is_hidden)
    .sort((a, b) => a.sort_order - b.sort_order)
  // 編集中の明細の費目が非表示や固定費でも、選択中として見えるようにする
  const selected = categories.find((c) => c.id === categoryId)
  const chips = selected && !visible.some((c) => c.id === selected.id) ? [...visible, selected] : visible

  const amountValue = Number(amount)
  const invalid = !amountValue || !categoryId || !date
  const accent = accentOf(type)
  const payLabel = type === 'income' ? '入金先' : type === 'transfer' ? '出金元' : '支払方法'

  function changeType(next: TxType) {
    if (next === type) return
    setType(next)
    setCategoryId('')
    setPay((p) => (payMethodsFor(next).includes(p) ? p : defaultPay(next)))
    if (!editing) {
      setAmount('')
      setMemo('')
    }
  }

  async function save() {
    if (invalid || busy) return
    setBusy(true)
    try {
      const input: TransactionInput = {
        type,
        occurred_on: date,
        amount: amountValue,
        category_id: categoryId,
        payment_method: pay,
        memo: memo.trim(),
      }
      // 見込み額の明細は、金額を直して更新した時点で確定とする
      if (editing?.is_estimated && editing.amount !== amountValue) input.is_estimated = false
      await api.saveTransaction(input, editing?.id)
      notify(editing ? '更新しました' : '登録しました')
      resetForm()
      onChanged()
    } catch {
      notify('保存できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!editing || busy) return
    if (!window.confirm('この明細を削除しますか？')) return
    setBusy(true)
    try {
      await api.deleteTransaction(editing.id)
      notify('削除しました')
      resetForm()
      onChanged()
    } catch {
      notify('削除できませんでした')
    } finally {
      setBusy(false)
    }
  }

  const btnStyle = { '--c': accent } as CSSProperties

  return (
    <Screen>
      <Header
        title={editing ? '明細を編集' : '入力'}
        right={
          editing && (
            <button type="button" className="text-btn" onClick={resetForm}>
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
              on={type === t}
              color={accentOf(t)}
              className="segment"
              onClick={() => changeType(t)}
            />
          ))}
        </div>

        <div className="field">
          <label htmlFor="amount">金額</label>
          <div className="amount-row" style={{ borderBottomColor: accent }}>
            <span aria-hidden="true" style={{ color: accent }}>
              ¥
            </span>
            <input
              id="amount"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={amount ? num(amountValue) : ''}
              onChange={(e) => setAmount(digitsOnly(e.target.value))}
            />
          </div>
          {editing?.is_estimated && (
            <p className="note">見込み額です。確定した金額に直して更新してください</p>
          )}
        </div>

        <div className="field">
          <label htmlFor="date">日付</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <fieldset className="field" aria-labelledby="catlabel">
          <div className="label-row">
            <span id="catlabel" className="label">
              費目
            </span>
            <button
              type="button"
              className="link-btn"
              style={{ color: accent }}
              onClick={() => onOpenCategories(type)}
            >
              編集
            </button>
          </div>
          <div className="grid grid-3">
            {chips.map((c) => (
              <Chip key={c.id} label={c.name} on={categoryId === c.id} color={accent} onClick={() => setCategoryId(c.id)} />
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="label">{payLabel}</legend>
          <div className="row">
            {payMethodsFor(type).map((p) => (
              <Chip key={p} label={PAY_LABELS[p]} on={pay === p} color={accent} onClick={() => setPay(p)} />
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
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        <section aria-label="最近の明細" className="recent">
          <h2>最近の明細</h2>
          {recent.length === 0 && <p className="empty">まだ明細がありません</p>}
          {recent.map((t) => (
            <button key={t.id} type="button" className="row-item" onClick={() => startEdit(t)}>
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
      <Footer hint={invalid ? '金額と費目を入力してください' : undefined}>
        {editing && (
          <button type="button" className="btn-outline" onClick={remove} disabled={busy}>
            削除
          </button>
        )}
        <button type="button" className="btn-primary" style={btnStyle} disabled={invalid || busy} onClick={save}>
          {editing ? '更新する' : '登録する'}
        </button>
      </Footer>
    </Screen>
  )
}
