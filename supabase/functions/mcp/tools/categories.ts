// 費目のツール: list_categories / save_category
// 費目の削除は提供しない。使わなくなった費目は is_hidden で選択肢から外す
// （過去の記録には名前が残る）。同じ種類で同じ名前の費目は登録できない。
import { z } from 'zod'
import { KINDS, loadCategories } from '../lib/categories.ts'
import type { Client } from '../lib/client.ts'
import { run, throwIfError, ToolError } from '../lib/result.ts'

const kindSchema = z.enum(KINDS).describe('expense=支出 / income=収入 / transfer=振替・投資 / fixed=固定費')

// ===== list_categories =====
export const listCategoriesSchema = z.object({
  kind: kindSchema.optional().describe('種類で絞る'),
  include_hidden: z.boolean().default(false).describe('非表示の費目も含める'),
})
export type ListCategoriesArgs = z.input<typeof listCategoriesSchema>

export function listCategories(sb: Client, raw: ListCategoriesArgs) {
  return run(async () => {
    const a = listCategoriesSchema.parse(raw)
    const rows = (await loadCategories(sb))
      .filter((c) => (!a.kind || c.kind === a.kind) && (a.include_hidden || !c.is_hidden))
      .sort((x, y) => KINDS.indexOf(x.kind as typeof KINDS[number]) - KINDS.indexOf(y.kind as typeof KINDS[number]) ||
        x.sort_order - y.sort_order)
    return { count: rows.length, rows }
  })
}

// ===== save_category =====
export const saveCategorySchema = z.object({
  category_id: z.string().uuid().optional().describe('更新する費目のid。省略すると新規追加'),
  kind: kindSchema.optional().describe('新規追加のときに必須。既存の費目の種類は変えられない'),
  name: z.string().trim().min(1).max(30).optional().describe('費目の名前（1〜30文字）。名前を変えると過去の記録にも反映される'),
  sort_order: z.number().int().min(0).optional().describe('並び順（小さいほど前）。新規追加で省略すると、その種類の最後'),
  is_hidden: z.boolean().optional().describe('true で選択肢から外す（過去の記録には残る）。false で戻す'),
})
export type SaveCategoryArgs = z.infer<typeof saveCategorySchema>

export function saveCategory(sb: Client, a: SaveCategoryArgs) {
  return run(async () => {
    const cats = await loadCategories(sb)

    if (a.category_id) {
      const cur = cats.find((c) => c.id === a.category_id)
      if (!cur) throw new ToolError(`費目 id=${a.category_id} が見つかりません。list_categories で確認してください。`)
      if (a.kind && a.kind !== cur.kind) throw new ToolError('費目の種類(kind)は変更できません。')
      const patch: { name?: string; sort_order?: number; is_hidden?: boolean } = {}
      if (a.name !== undefined) {
        const dup = cats.find((c) => c.kind === cur.kind && c.name === a.name && c.id !== cur.id)
        if (dup) throw new ToolError(`同じ種類に「${a.name}」という費目が既にあります${dup.is_hidden ? '（非表示）' : ''}。`)
        patch.name = a.name
      }
      if (a.sort_order !== undefined) patch.sort_order = a.sort_order
      if (a.is_hidden !== undefined) patch.is_hidden = a.is_hidden
      if (Object.keys(patch).length === 0) throw new ToolError('更新する項目(name / sort_order / is_hidden)を指定してください。')
      const { data, error } = await sb.from('categories').update(patch).eq('id', cur.id)
        .select('id, kind, name, sort_order, is_hidden')
      throwIfError(error)
      if (!data || data.length === 0) throw new ToolError(`費目 id=${cur.id} が見つかりません。`)
      return { updated: true, row: data[0] }
    }

    if (!a.kind || !a.name) throw new ToolError('新規追加には kind と name が必要です（更新するときは category_id を指定する）。')
    const dup = cats.find((c) => c.kind === a.kind && c.name === a.name)
    if (dup) {
      throw new ToolError(
        `同じ種類に「${a.name}」という費目が既にあります${dup.is_hidden ? '（非表示。category_id を指定して is_hidden を false にすると戻せる）' : ''}。`,
      )
    }
    const sortOrder = a.sort_order ??
      cats.filter((c) => c.kind === a.kind).reduce((m, c) => Math.max(m, c.sort_order), 0) + 10
    const { data, error } = await sb.from('categories')
      .insert({ kind: a.kind, name: a.name, sort_order: sortOrder, is_hidden: a.is_hidden ?? false })
      .select('id, kind, name, sort_order, is_hidden').single()
    throwIfError(error)
    return { created: true, row: data! }
  })
}
