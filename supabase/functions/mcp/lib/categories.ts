import { z } from 'zod'
import type { Client } from './client.ts'
import { throwIfError, ToolError } from './result.ts'

export type CatKind = 'expense' | 'income' | 'transfer' | 'fixed'
export type TxType = 'expense' | 'income' | 'transfer'

export type CategoryRow = {
  id: string
  kind: string
  name: string
  sort_order: number
  is_hidden: boolean
}

export const KINDS = ['expense', 'income', 'transfer', 'fixed'] as const

/** 明細の種別ごとに使える費目の種類。支出は固定費の費目も使える（固定費の自動記録がそうなる） */
export const KINDS_FOR_TYPE: Record<TxType, CatKind[]> = {
  expense: ['expense', 'fixed'],
  income: ['income'],
  transfer: ['transfer'],
}

const uuid = z.string().uuid()

export async function loadCategories(sb: Client): Promise<CategoryRow[]> {
  const { data, error } = await sb
    .from('categories')
    .select('id, kind, name, sort_order, is_hidden')
    .order('kind')
    .order('sort_order')
  throwIfError(error)
  return data ?? []
}

/**
 * 費目名またはidから費目を1件決める。kinds の並びが優先順位になる
 * （例: 支出は「その他」が支出と固定費の両方にあるので、支出の費目を先に探す）。
 * 非表示の費目は新しい記録には使えない。
 */
export function resolveCategory(
  cats: CategoryRow[],
  input: string,
  kinds: CatKind[],
): CategoryRow {
  if (uuid.safeParse(input).success) {
    const byId = cats.find((c) => c.id === input)
    if (!byId) throw new ToolError(`費目 id=${input} が見つかりません。list_categories で確認してください。`)
    if (!kinds.includes(byId.kind as CatKind)) {
      throw new ToolError(`費目「${byId.name}」は種類が ${byId.kind} のため、ここでは使えません（使える種類: ${kinds.join(' / ')}）。`)
    }
    if (byId.is_hidden) throw new ToolError(`費目「${byId.name}」は非表示です。save_category で is_hidden を false にしてから使ってください。`)
    return byId
  }
  for (const kind of kinds) {
    const hit = cats.find((c) => c.kind === kind && c.name === input && !c.is_hidden)
    if (hit) return hit
  }
  const hiddenHit = cats.find((c) => kinds.includes(c.kind as CatKind) && c.name === input && c.is_hidden)
  if (hiddenHit) {
    throw new ToolError(`費目「${input}」は非表示です。save_category で is_hidden を false にしてから使ってください。`)
  }
  const available = cats
    .filter((c) => kinds.includes(c.kind as CatKind) && !c.is_hidden)
    .map((c) => c.name)
  throw new ToolError(
    `費目「${input}」が見つかりません（種類: ${kinds.join(' / ')}）。使える費目: ${[...new Set(available)].join('、')}`,
  )
}

/** 絞り込み用。名前に一致するすべての費目のidを返す（種類をまたぐ同名も含む。非表示も含む） */
export function matchCategoryIds(cats: CategoryRow[], input: string): string[] {
  if (uuid.safeParse(input).success) {
    if (!cats.some((c) => c.id === input)) throw new ToolError(`費目 id=${input} が見つかりません。`)
    return [input]
  }
  const ids = cats.filter((c) => c.name === input).map((c) => c.id)
  if (ids.length === 0) throw new ToolError(`費目「${input}」が見つかりません。list_categories で確認してください。`)
  return ids
}

export const catName = (cats: CategoryRow[], id: string): string =>
  cats.find((c) => c.id === id)?.name ?? ''
