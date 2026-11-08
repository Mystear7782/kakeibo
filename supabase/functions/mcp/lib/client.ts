import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types.ts'

/** ユーザーのアクセストークンで接続したクライアント。RLS が効く */
export type Client = SupabaseClient<Database>
