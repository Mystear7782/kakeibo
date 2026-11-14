import { digitsOnly, num } from '../lib/format'
import { FIXED_PAY_METHODS, PAY_LABELS, type CatKind } from '../lib/model'
import { COLORS, Chip, Switch } from '../ui'
import type { FixedForm } from './useFixedForm'

const DAYS = [...Array.from({ length: 28 }, (_, i) => ({ v: String(i + 1), l: `${i + 1}日` })), { v: 'end', l: '月末' }]
const MONTHS = Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1), l: `${i + 1}月` }))

type Props = {
  f: FixedForm
  /** 省略すると、費目の「編集」リンクを出さない（PC版は費目ページで編集する） */
  onOpenCategories?: (kind: CatKind) => void
  /** 入力欄の id の接頭辞。同じ画面にフォームが2つ並ぶことはないが、PC版と見分けるために使う */
  idPrefix?: string
}

/** 固定費フォームの入力項目。モバイル版の画面とPC版のパネルの両方で使う */
export function FixedFormFields({ f, onOpenCategories, idPrefix = 'f' }: Props) {
  return (
    <>
      <div className="grid grid-name">
        <div className="field">
          <label htmlFor={`${idPrefix}name`}>名前</label>
          <input id={`${idPrefix}name`} autoComplete="off" placeholder="家賃など" maxLength={50} value={f.name} onChange={(e) => f.setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}amount`}>金額(円)</label>
          <input
            id={`${idPrefix}amount`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            className="strong"
            value={f.amount ? num(f.amountValue) : ''}
            onChange={(e) => f.setAmount(digitsOnly(e.target.value))}
          />
        </div>
      </div>

      <fieldset className="field" aria-labelledby={`${idPrefix}catlabel`}>
        <div className="label-row">
          <span id={`${idPrefix}catlabel`} className="label">
            費目
          </span>
          {onOpenCategories && (
            <button type="button" className="link-btn" style={{ color: COLORS.expense }} onClick={() => onOpenCategories('fixed')}>
              編集
            </button>
          )}
        </div>
        <div className="grid grid-4">
          {f.chips.map((c) => (
            <Chip key={c.id} label={c.name} on={f.categoryId === c.id} color={COLORS.expense} className="chip chip-small" onClick={() => f.setCategoryId(c.id)} />
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="label">支払いの周期</legend>
        <div className="grid grid-2">
          <Chip label="毎月" on={f.cycle === 'monthly'} color={COLORS.expense} onClick={() => f.setCycle('monthly')} />
          <Chip label="毎年" on={f.cycle === 'yearly'} color={COLORS.expense} onClick={() => f.setCycle('yearly')} />
        </div>
      </fieldset>

      <div className="row">
        {f.cycle === 'yearly' && (
          <div className="field grow">
            <label htmlFor={`${idPrefix}month`}>支払月</label>
            <select id={`${idPrefix}month`} value={f.month} onChange={(e) => f.setMonth(e.target.value)}>
              {MONTHS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field grow">
          <label htmlFor={`${idPrefix}day`}>支払日</label>
          <select id={`${idPrefix}day`} value={f.day} onChange={(e) => f.setDay(e.target.value)}>
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
            <Chip key={p} label={PAY_LABELS[p]} on={f.pay === p} color={COLORS.expense} onClick={() => f.setPay(p)} />
          ))}
        </div>
      </fieldset>

      <div className="grid grid-2">
        <div className="field">
          <label htmlFor={`${idPrefix}start`}>開始月</label>
          <input id={`${idPrefix}start`} type="month" value={f.start} onChange={(e) => f.setStart(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}end`}>終了月(任意)</label>
          <input id={`${idPrefix}end`} type="month" value={f.end} onChange={(e) => f.setEnd(e.target.value)} />
        </div>
      </div>
      {f.endBeforeStart && <p className="note">終了月は開始月と同じか、あとの月にしてください</p>}

      <div className="switches">
        <Switch label="金額が毎回変わる" help="登録額を見込みとして記録" on={f.variable} onChange={f.setVariable} />
        <Switch label="支払日に自動で明細へ記録" help="オフなら記録は手動" on={f.auto} onChange={f.setAuto} />
        <Switch label="サブスクとして管理" help="サブスク画面で月額や累計を確認" on={f.subscription} onChange={f.setSubscription} />
      </div>
    </>
  )
}
