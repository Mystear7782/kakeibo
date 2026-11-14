import { useState } from 'react'
import { api } from '../api'
import { MAX_YEAR, MIN_YEAR, isValidMonth, monthOf, todayJst } from '../lib/date'
import type { Cycle, FixedCost, FixedCostInput, PayMethod } from '../lib/model'
import { useApp } from '../state'

export type FixedSaveResult = 'created' | 'updated' | 'deleted'

type Options = {
  /** 編集する固定費。null なら新規登録 */
  fixed: FixedCost | null
  /** 新規登録のとき、サブスクとして管理をオンにして始める */
  subscriptionPreset: boolean
  onDone: (result: FixedSaveResult) => void
}

/** 固定費フォームの状態と操作。モバイル版とPC版のフォームが共有する */
export function useFixedForm({ fixed, subscriptionPreset, onDone }: Options) {
  const { categories, notify } = useApp()

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
  // 開始月は必須、終了月は任意。年は2000〜2100年に限る（日付欄は6桁の年まで入ってしまうため）
  const rangeText = `${MIN_YEAR}年1月〜${MAX_YEAR}年12月`
  const startError = isValidMonth(start) ? '' : `開始月は${rangeText}の範囲で入力してください`
  const endError = !end || isValidMonth(end) ? '' : `終了月は${rangeText}の範囲で入力してください`
  const endBeforeStart = !startError && !!end && !endError && end < start
  const fieldsMissing = !name.trim() || !amountValue || !categoryId
  const invalid = fieldsMissing || !!startError || !!endError || endBeforeStart

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
      onDone(fixed ? 'updated' : 'created')
    } catch {
      notify('保存できませんでした')
    } finally {
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
      onDone('deleted')
    } catch {
      notify('削除できませんでした')
    } finally {
      setBusy(false)
    }
  }

  return {
    fixed,
    name, setName,
    amount, setAmount, amountValue,
    categoryId, setCategoryId, chips,
    cycle, setCycle,
    month, setMonth,
    day, setDay,
    pay, setPay,
    start, setStart,
    end, setEnd,
    variable, setVariable,
    auto, setAuto,
    subscription, setSubscription,
    busy, startError, endError, endBeforeStart, fieldsMissing, invalid,
    save, remove,
  }
}

export type FixedForm = ReturnType<typeof useFixedForm>
