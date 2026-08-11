'use client'

import { useState } from 'react'

function feedUrl(token: string | null): string {
  // Built on the client so the URL always matches the host actually in use
  // (see SharePanel.tsx — a build-time base URL would be wrong on previews).
  if (!token) return ''
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/api/staff/calendar/${token}`
}

export default function CalendarSettings({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState(initialToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function regenerate() {
    const hadToken = Boolean(token)
    if (hadToken && !window.confirm('Regenerating invalidates the current link — anything subscribed to it will stop updating until re-subscribed. Continue?')) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/staff/calendar/token', { method: 'POST' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? 'Could not generate a link')
      setToken(payload.token)
      setCopied(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a link')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl(token))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to the clipboard — select the link and copy it manually.')
    }
  }

  return (
    <div>
      <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '18px' }}>
        Subscribe once in Apple, Google or Outlook Calendar and hearing dates
        appear automatically as they are added. The link below is the entire
        credential — anyone holding it can see hearing dates, so treat it
        like a password. Regenerate it if it is ever shared or exposed.
      </p>

      {token ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <code style={{
            flex: 1, minWidth: '220px', fontSize: '11px', color: 'var(--muted)',
            background: 'rgba(var(--ink-rgb),0.03)', border: '1px solid var(--rule)',
            borderRadius: '3px', padding: '9px 12px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {feedUrl(token)}
          </code>
          <button
            onClick={copy}
            disabled={busy}
            style={{
              background: 'none', border: '1px solid var(--rule)', borderRadius: '3px',
              color: copied ? 'var(--status-success)' : 'var(--muted)',
              fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '9px 14px', cursor: 'pointer',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <p style={{ fontSize: '13px', color: 'var(--dim)', marginBottom: '18px' }}>
          No calendar link yet — generate one below.
        </p>
      )}

      {error && (
        <p style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '12px' }}>{error}</p>
      )}

      <button
        className="btn-submit"
        onClick={regenerate}
        disabled={busy}
        style={{ padding: '10px 22px', fontSize: '13px' }}
      >
        {busy ? 'Working…' : token ? 'Regenerate link' : 'Generate link'}
      </button>
    </div>
  )
}
