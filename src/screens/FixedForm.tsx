import { useState } from 'react'
import { api } from '../api'
import { monthOf, todayJst } from '../lib/date'
import { digitsOnly, num } from '../lib/format'
import {
  FIXED_PAY_METHODS,
  PAY_LABELS,
  type CatKind,
  type Category,
  type Cycle,
  type FixedCost,
  type FixedCostInput,
  type PayMethod,
} from '../lib/model'
import { COLORS, Chip, Footer, Header, Screen, Scroll, Switch } from '../ui'

type Props = {
  fixed: FixedCost | null
  /** 新規登録のとき、サブスクとして管理をオンにして始める */
  subscriptionPreset: boolean
  categories: Category[]
  onBack: () => void
  onSaved: () => void
  onOpenCategories: (kind: CatKind) => void
  notify: (text: string) => void
}

const DAYS = [...Array.from({ length: 28 }, (_, i) => ({ v: String(i + 1), l: `${i + 1}日` })), { v: 'end', l: '月末' }]
const MONTHS = Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1), l: `${i + 1}月` }))

export function FixedFormScreen({
  fixed,
  subscriptionPreset,
  categories,
  onBack,
  onSaved,
  onOpenCategories,
  notify,
}: Props) {
  const presetCategory = subscriptionPreset
    ? categories.find((c) => c.kind === 'fixed' && c.name === 'サブスク' && !c.is_hidden)
    : undefined

  const [name, setName] = useState(fixed?.name ?? '')
  const [amount, setAmount] = useState(fixed ? String(fixed.amount) : '')
  const [categoryId, setCategoryId] = useState(fixed?.category_id ?? presetCategory?.id ?? '')
  const [cycle, setCycle] = useState<Cycle>((fixed?.cycle as Cycle) ?? 'monthly')
  const [month, setMonth] = useState(String(fixed?.pay_month ?? 1))
  const [day, setDay] = useState(fixed ? (fixed.is_month_end ? 'end' : String(fixed.pay_day)) : '1')
  const [pay, setPay] = useState<PayMethod>((fixed?.payment_method as PayMethod) ?? 'card')
  const [start, setStart] = useState(fixed ? monthOf(fixed.start_month) : monthOf(todayJst()))
  const [end, setEnd] = useState(fixed?.end_month ? monthOf(fixed.end_month) : '')
  const [variable, setVariable] = useState(fixed?.is_variable ?? false)
  const [auto, setAuto] = useState(fixed?.auto_record ?? true)
  const [subscription, setSubscription] = useState(fixed?.is_subscription ?? subscriptionPreset)
  const [busy, setBusy] = useState(false)

  const visible = categories
    .filter((c) => c.kind === 'fixed' && !c.is_hidden)
    .sort((a, b) => a.sort_order - b.sort_order)
  const selected = categories.find((c) => c.id === categoryId)
  const chips = selected && !visible.some((c) => c.id === selected.id) ? [...visible, selected] : visible

  const amountValue = Number(amount)
  const endBeforeStart = !!end && !!start && end < start
  const invalid = !name.trim() || !amountValue || !categoryId || !start || endBeforeStart

  async function save() {
    if (invalid || busy) return
    setBusy(true)
    try {
      const input: FixedCostInput = {
        name: name.trim(),
        amount: amountValue,
        category_id: categoryId,
        cycle,
        pay_month: cycle === 'yearly' ? Number(month) : null,
        pay_day: day === 'end' ? null : Number(day),
        is_month_end: day === 'end',
        payment_method: pay,
        start_month: `${start}-01`,
        end_month: end ? `${end}-01` : null,
        is_variable: variable,
        auto_record: auto,
        is_subscription: subscription,
      }
      await api.saveFixedCost(input, fixed?.id)
      notify(fixed ? '更新しました' : '登録しました')
      onSaved()
    } catch {
      notify('保存できませんでした')
      setBusy(false)
    }
  }

  async function remove() {
    if (!fixed || busy) return
    const message = fixed.is_subscription
      ? 'これまでの明細との紐づきが外れ、サブスクの累計額からも消えます。解約する場合は削除せず、終了月を入れてください。削除しますか？'
      : 'この固定費を削除しますか？これまでの明細は残ります。'
    if (!window.confirm(message)) return
    setBusy(true)
    try {
      await api.deleteFixedCost(fixed.id)
      notify('削除しました')
      onSaved()
    } catch {
      notify('削除できませんでした')
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Header title={fixed ? '固定費を編集' : '固定費を登録'} onBack={onBack} backLabel="固定費の一覧に戻る" />
      <Scroll>
        <div className="grid grid-name">
          <div className="field">
            <label htmlFor="fname">名前</label>
            <input id="fname" autoComplete="off" placeholder="家賃など" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="famount">金額(円)</label>
            <input
              id="famount"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              className="strong"
              value={amount ? num(amountValue) : ''}
              onChange={(e) => setAmount(digitsOnly(e.target.value))}
            />
          </div>
        </div>

        <fieldset className="field" aria-labelledby="fcatlabel">
          <div className="label-row">
            <span id="fcatlabel" className="label">
              費目
            </span>
            <button type="button" className="link-btn" style={{ color: COLORS.expense }} onClick={() => onOpenCategories('fixed')}>
              編集
            </button>
          </div>
          <div className="grid grid-4">
            {chips.map((c) => (
              <Chip key={c.id} label={c.name} on={categoryId === c.id} color={COLORS.expense} className="chip chip-small" onClick={() => setCategoryId(c.id)} />
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="label">支払いの周期</legend>
          <div className="grid grid-2">
            <Chip label="毎月" on={cycle === 'monthly'} color={COLORS.expense} onClick={() => setCycle('monthly')} />
            <Chip label="毎年" on={cycle === 'yearly'} color={COLORS.expense} onClick={() => setCycle('yearly')} />
          </div>
        </fieldset>

        <div className="row">
          {cycle === 'yearly' && (
            <div className="field grow">
              <label htmlFor="fmonth">支払月</label>
              <select id="fmonth" value={month} onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field grow">
            <label htmlFor="fday">支払日</label>
            <select id="fday" value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="field">
          <legend className="label">支払方法</legend>
          <div className="row">
            {FIXED_PAY_METHODS.map((p) => (
              <Chip key={p} label={PAY_LABELS[p]} on={pay === p} color={COLORS.expense} onClick={() => setPay(p)} />
            ))}
          </div>
        </fieldset>

        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="fstart">開始月</label>
            <input id="fstart" type="month" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fend">終了月(任意)</label>
            <input id="fend" type="month" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {endBeforeStart && <p className="note">終了月は開始月と同じか、あとの月にしてください</p>}

        <div className="switches">
          <Switch label="金額が毎回変わる" help="登録額を見込みとして記録" on={variable} onChange={setVariable} />
          <Switch label="支払日に自動で明細へ記録" help="オフなら記録は手動" on={auto} onChange={setAuto} />
          <Switch label="サブスクとして管理" help="サブスク画面で月額や累計を確認" on={subscription} onChange={setSubscription} />
        </div>
      </Scroll>
      <Footer hint={invalid && !endBeforeStart ? '名前、金額、費目を入力してください' : undefined}>
        {fixed && (
          <button type="button" className="btn-outline" onClick={remove} disabled={busy}>
            削除
          </button>
        )}
        <button type="button" className="btn-primary" disabled={invalid || busy} onClick={save}>
          {fixed ? '更新する' : '登録する'}
        </button>
      </Footer>
    </Screen>
  )
}
