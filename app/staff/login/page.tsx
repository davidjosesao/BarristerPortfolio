'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

export default function StaffLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    router.push('/staff/briefs')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <span style={{
            display: 'block',
            fontFamily: 'var(--font-garamond, EB Garamond, Georgia, serif)',
            fontStyle: 'italic',
            fontSize: '28px',
            color: 'var(--cream)',
            marginBottom: '6px',
          }}>
            Chambers Staff
          </span>
          <span style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Sign in to view briefs
          </span>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field" style={{ marginBottom: '16px' }}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field" style={{ marginBottom: '24px' }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p style={{
              fontSize: '13px',
              color: '#D97C7C',
              marginBottom: '16px',
              padding: '10px 13px',
              border: '1px solid rgba(217,124,124,0.25)',
              borderRadius: '3px',
              background: 'rgba(217,124,124,0.05)',
            }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

      </div>
    </div>
  )
}
