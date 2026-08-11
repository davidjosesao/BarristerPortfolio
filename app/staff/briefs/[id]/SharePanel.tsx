'use client'

import { useState } from 'react'

export type Share = {
  id: string
  token: string
  created_at: string
  created_by: string | null
  expires_at: string | null
  revoked_at: string | null
  last_viewed_at: string | null
  view_count: number
}

const EXPIRY_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: 'No expiry', value: 0 },
]

function shareUrl(token: string): string {
  // Built on the client so the link always matches the host staff are actually
  // using, rather than a base URL baked in at build time that would be wrong
  // on a preview deployment.
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/share/${token}`
}

function describeState(share: Share): { text: string; color: string } {
  if (share.revoked_at) return { text: 'Revoked', color: 'var(--error)' }
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
    return { text: 'Expired', color: 'var(--dim)' }
  }
  if (share.expires_at) {
    const date = new Date(share.expires_at).toLocaleDateString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
    return { text: `Active until ${date}`, color: 'var(--status-success)' }
  }
  return { text: 'Active — no expiry', color: 'var(--status-success)' }
}

export default function SharePanel({
  briefId,
  initialShares,
}: {
  briefId: string
  initialShares: Share[]
}) {
  const [shares, setShares] = useState<Share[]>(initialShares)
  const [expiryDays, setExpiryDays] = useState(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function createShare() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/staff/briefs/${briefId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_in_days: expiryDays === 0 ? null : expiryDays }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? 'Could not create the link')

      setShares(current => [{ ...payload.share, created_by: null, last_viewed_at: null }, ...current])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the link')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(shareId: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/staff/briefs/${briefId}/shares/${shareId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Could not revoke the link')
      setShares(current => current.map(s =>
        s.id === shareId ? { ...s, revoked_at: new Date().toISOString() } : s
      ))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke the link')
    } finally {
      setBusy(false)
    }
  }

  async function copy(share: Share) {
    try {
      await navigator.clipboard.writeText(shareUrl(share.token))
      setCopiedId(share.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setError('Could not copy to the clipboard — select the link and copy it manually.')
    }
  }

  const live = shares.filter(s => !s.revoked_at)

  return (
    <div>
      <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7, marginBottom: '18px' }}>
        A read-only link showing this brief&rsquo;s progress — status, court and hearing
        date. It does not expose chambers&rsquo; notes, the AI summary or fees.
        Anyone holding the link can open it, so treat it as a password.
      </p>

      {shares.length > 0 && (
        <div style={{ border: '1px solid var(--rule)', borderRadius: '4px', marginBottom: '18px' }}>
          {shares.map((share, i) => {
            const state = describeState(share)
            const revoked = Boolean(share.revoked_at)
            return (
              <div
                key={share.id}
                style={{
                  padding: '14px 18px',
                  borderBottom: i === shares.length - 1 ? 'none' : '1px solid var(--rule)',
                  opacity: revoked ? 0.55 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: state.color, fontWeight: 500 }}>
                    {state.text}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--dim)' }}>
                    {share.view_count > 0
                      ? `Opened ${share.view_count}×`
                      : 'Not yet opened'}
                  </span>
                </div>

                {!revoked && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <code style={{
                      flex: 1, minWidth: '200px', fontSize: '11px', color: 'var(--muted)',
                      background: 'rgba(var(--ink-rgb),0.03)', border: '1px solid var(--rule)',
                      borderRadius: '3px', padding: '6px 9px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {shareUrl(share.token)}
                    </code>
                    <button
                      onClick={() => copy(share)}
                      disabled={busy}
                      style={{
                        background: 'none', border: '1px solid var(--rule)', borderRadius: '3px',
                        color: copiedId === share.id ? 'var(--status-success)' : 'var(--muted)',
                        fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase',
                        padding: '7px 12px', cursor: 'pointer',
                      }}
                    >
                      {copiedId === share.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => revoke(share.id)}
                      disabled={busy}
                      style={{
                        background: 'none', border: 'none', color: 'var(--error)',
                        fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase',
                        padding: '7px 4px', cursor: 'pointer',
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <p style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '12px' }}>{error}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <span style={{
            display: 'block', fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px',
          }}>
            Expires after
          </span>
          <div className="field" style={{ margin: 0, minWidth: '150px' }}>
            <select value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value))}>
              {EXPIRY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="btn-submit"
          onClick={createShare}
          disabled={busy}
          style={{ padding: '10px 22px', fontSize: '13px' }}
        >
          {busy ? 'Working…' : live.length > 0 ? 'Create another link' : 'Create share link'}
        </button>
      </div>
    </div>
  )
}
