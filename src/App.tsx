import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Login } from './Login'
import { ensureDefaultCategories } from './lib/seed'
import { supabase } from './lib/supabase'

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    ensureDefaultCategories().catch(() => setError('初期費目の作成に失敗しました'))
  }, [userId])

  if (session === undefined) return null
  if (!session) return <Login />

  return (
    <main className="home">
      <h1>家計簿</h1>
      <p>{session.user.email} でログイン中</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="button" onClick={() => supabase.auth.signOut()}>
        ログアウト
      </button>
    </main>
  )
}
