import { useState } from 'react'
import { api } from '../api'
import { MAX_YEAR, MIN_YEAR, isValidDate } from '../lib/date'
import {
  defaultPay,
  payMethodsFor,
  type Category,
  type TransactionInput,
  type TxType,
} from '../lib/model'
import { useApp } from '../state'
import { COLORS } from '../ui'

export const accentOf = (type: TxType): string => COLORS[type]

/** 入力フォームの状態と操作。モバイル版とPC版の入力フォームが共有する */
export function useEntry() {
  const { categories, entry, notify, changed } = useApp()
  const { draft: d, patch } = entry
  const [busy, setBusy] = useState(false)

  const visible = categories
    .filter((c: Category) => c.kind === d.type && !c.is_hidden)
    .sort((a, b) => a.sort_order - b.sort_order)
  // 編集中の明細の費目が非表示や固定費でも、選択中として見えるようにする
  const selected = categories.find((c) => c.id === d.categoryId)
  const chips = selected && !visible.some((c) => c.id === selected.id) ? [...visible, selected] : visible

  const amountValue = Number(d.amount)
  // 日付欄は6桁の年(例: 203301年)まで入ってしまうため、2000〜2100年の実在する日付に限る
  const dateInvalid = !isValidDate(d.date)
  const dateHint = `日付は${MIN_YEAR}年〜${MAX_YEAR}年の正しい日付を入力してください`
  const invalid = !amountValue || !d.categoryId || dateInvalid
  const accent = accentOf(d.type)
  const payLabel = d.type === 'income' ? '入金先' : d.type === 'transfer' ? '出金元' : '支払方法'

  function changeType(next: TxType) {
    if (next === d.type) return
    patch({
      type: next,
      categoryId: '',
      pay: payMethodsFor(next).includes(d.pay) ? d.pay : defaultPay(next),
      ...(d.editing ? {} : { amount: '', memo: '' }),
    })
  }

  async function save() {
    if (invalid || busy) return
    setBusy(true)
    try {
      const input: TransactionInput = {
        type: d.type,
        occurred_on: d.date,
        amount: amountValue,
        category_id: d.categoryId,
        payment_method: d.pay,
        memo: d.memo.trim(),
      }
      // 見込み額の明細は、金額を直して更新した時点で確定とする
      if (d.editing?.is_estimated && d.editing.amount !== amountValue) input.is_estimated = false
      await api.saveTransaction(input, d.editing?.id)
      notify(d.editing ? '更新しました' : '登録しました')
      entry.reset()
      changed()
    } catch {
      notify('保存できませんでした')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!d.editing || busy) return
    if (!window.confirm('この明細を削除しますか？')) return
    setBusy(true)
    try {
      await api.deleteTransaction(d.editing.id)
      notify('削除しました')
      entry.reset()
      changed()
    } catch {
      notify('削除できませんでした')
    } finally {
      setBusy(false)
    }
  }

  return {
    draft: d,
    patch,
    categories,
    chips,
    amountValue,
    invalid,
    dateInvalid,
    dateHint,
    busy,
    accent,
    payLabel,
    changeType,
    save,
    remove,
    reset: entry.reset,
    startEdit: entry.startEdit,
  }
}
