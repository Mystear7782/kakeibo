import { ensureDefaultCategories } from '../lib/seed'
import { supabase } from '../lib/supabase'
import type { ScheduleRow, SubscriptionRow } from '../lib/model'
import { monthStart } from '../lib/date'
import type { Api } from './types'

type Result<T> = { data: T; error: { message: string } | null }

// RLS を通すため、ユーザーのセッションで接続した anon クライアントだけを使う
function check<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

function rows<T>(result: Result<T[] | null>): T[] {
  return check(result) ?? []
}

export function createRealApi(): Api {
  return {
    ensureDefaultCategories,

    async listCategories() {
      return rows(
        await supabase.from('categories').select('*').order('kind').order('sort_order').order('name'),
      )
    },
    async addCategory(kind, name, sortOrder) {
      check(await supabase.from('categories').insert({ kind, name, sort_order: sortOrder }))
    },
    async updateCategory(id, patch) {
      check(await supabase.from('categories').update(patch).eq('id', id))
    },
    async deleteCategory(id) {
      check(await supabase.from('categories').delete().eq('id', id))
    },
    async isCategoryUsed(id) {
      const [tx, fixed] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', id),
        supabase.from('fixed_costs').select('id', { count: 'exact', head: true }).eq('category_id', id),
      ])
      if (tx.error) throw new Error(tx.error.message)
      if (fixed.error) throw new Error(fixed.error.message)
      return (tx.count ?? 0) + (fixed.count ?? 0) > 0
    },

    async listFixedCosts() {
      return rows(await supabase.from('fixed_costs').select('*').order('created_at'))
    },
    async saveFixedCost(input, id) {
      if (id) check(await supabase.from('fixed_costs').update(input).eq('id', id))
      else check(await supabase.from('fixed_costs').insert(input))
    },
    async deleteFixedCost(id) {
      check(await supabase.from('fixed_costs').delete().eq('id', id))
    },

    async listRecentTransactions(limit) {
      return rows(
        await supabase
          .from('transactions')
          .select('*')
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit),
      )
    },
    async listTransactions(from, to) {
      return rows(
        await supabase
          .from('transactions')
          .select('*')
          .gte('occurred_on', from)
          .lte('occurred_on', to)
          .order('occurred_on')
          .order('created_at'),
      )
    },
    async saveTransaction(input, id) {
      if (id) check(await supabase.from('transactions').update(input).eq('id', id))
      else check(await supabase.from('transactions').insert(input))
    },
    async deleteTransaction(id) {
      check(await supabase.from('transactions').delete().eq('id', id))
    },

    async getMonthSchedule(month) {
      const data = check(await supabase.rpc('get_month_schedule', { p_month: monthStart(month) }))
      return (data ?? []) as ScheduleRow[]
    },
    async getSubscriptionSummary(year) {
      const data = check(await supabase.rpc('get_subscription_summary', { p_year: year }))
      return (data ?? []) as unknown as SubscriptionRow[]
    },
  }
}
