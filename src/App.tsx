import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { FAKE_API } from './api'
import { Login } from './Login'
import { Shell } from './Shell'
import { supabase } from './lib/supabase'

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (FAKE_API) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  if (FAKE_API) return <Shell email="demo@example.com" onSignOut={() => undefined} />
  if (session === undefined) return null
  if (!session) return <Login />

  // ユーザーが変わったら状態を持ち越さないよう key で作り直す
  return <Shell key={session.user.id} email={session.user.email ?? ''} onSignOut={() => supabase.auth.signOut()} />
}
