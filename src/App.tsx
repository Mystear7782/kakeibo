import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { FAKE_API } from './api'
import { Login } from './Login'
import { DesktopShell } from './DesktopShell'
import { Shell } from './Shell'
import { supabase } from './lib/supabase'
import { useIsDesktop } from './lib/useIsDesktop'
import { AppProvider } from './state'

const noop = () => undefined

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const isDesktop = useIsDesktop()
  const signOut = useCallback(() => void supabase.auth.signOut(), [])

  useEffect(() => {
    if (FAKE_API) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  // 幅が変わっても AppProvider は入れ替えない。入力中の内容や選択中の月日、ログイン状態を残すため
  const shell = isDesktop ? <DesktopShell /> : <Shell />

  if (FAKE_API) {
    return (
      <AppProvider email="demo@example.com" onSignOut={noop}>
        {shell}
      </AppProvider>
    )
  }
  if (session === undefined) return null
  if (!session) return <Login />

  // ユーザーが変わったら状態を持ち越さないよう key で作り直す
  return (
    <AppProvider key={session.user.id} email={session.user.email ?? ''} onSignOut={signOut}>
      {shell}
    </AppProvider>
  )
}
