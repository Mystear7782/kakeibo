import { supabase } from './supabase'

// 費目が1件もないときだけ初期費目を作る。seed_default_categories は何度呼んでも重複しない
export async function ensureDefaultCategories(): Promise<void> {
  const { count, error } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  if (count && count > 0) return

  const { error: seedError } = await supabase.rpc('seed_default_categories')
  if (seedError) throw seedError
}
