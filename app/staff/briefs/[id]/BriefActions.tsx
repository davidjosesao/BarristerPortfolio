'use client'

import { useState } from 'react'

const STATUSES = ['new', 'reviewed', 'accepted', 'declined']

const STATUS_COLORS: Record<string, string> = {
  new: '#E8C97A',
  reviewed: '#B4B0A9',
  accepted: '#7AC8A0',
  declined: '#D97C7C',
}

export default function BriefActions({
  briefId,
  initialStatus,
  initialNotes,
}: {
  briefId: string
  initialStatus: string
  initialNotes: string | null
}) {
  const [status, setStatus] = useState(initialStatus)
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save(patch: { status?: string; staff_notes?: string }) {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const res = await fetch(`/api/staff/briefs/${briefId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value
    setStatus(next)
    await save({ status: next })
  }

  return (
    <div>
      {/* Status */}
      <div style={{ marginBottom: '32px' }}>
        <span style={{
          display: 'block', fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px',
        }}>
          Status
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="field" style={{ margin: 0, flex: '0 0 180px' }}>
            <select value={status} onChange={handleStatusChange} disabled={saving}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <span style={{ fontSize: '13px', color: STATUS_COLORS[status] ?? 'var(--muted)', fontWeight: 500 }}>
            ● {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </div>

      {/* Staff notes */}
      <div>
        <span style={{
          display: 'block', fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '10px',
        }}>
          Staff notes
        </span>
        <div className="field" style={{ margin: 0 }}>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Internal notes visible only to chambers staff…"
            style={{ minHeight: '100px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px' }}>
          <button
            className="btn-submit"
            onClick={() => save({ staff_notes: notes })}
            disabled={saving}
            style={{ padding: '10px 24px', fontSize: '13px' }}
          >
            {saving ? 'Saving…' : 'Save notes'}
          </button>
          {saved && <span style={{ fontSize: '13px', color: '#7AC8A0' }}>Saved</span>}
          {error && <span style={{ fontSize: '13px', color: '#D97C7C' }}>{error}</span>}
        </div>
      </div>
    </div>
  )
}
