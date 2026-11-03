import { useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('メールアドレスまたはパスワードが違います')
    setBusy(false)
  }

  return (
    <main className="login">
      <h1>家計簿</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="email">メールアドレス</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="password">パスワード</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'ログイン中…' : 'ログイン'}
        </button>
      </form>
    </main>
  )
}
