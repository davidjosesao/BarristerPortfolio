import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { StaffHeader } from '../StaffHeader'
import BriefRow from './BriefRow'
import { formatChambersDate } from '../../../lib/chambers-time'

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  new:      { color: 'var(--status-warning)', bg: 'rgba(var(--status-warning-rgb),0.08)', border: 'rgba(var(--status-warning-rgb),0.25)' },
  reviewed: { color: 'var(--gold)', bg: 'rgba(var(--gold-rgb),0.08)', border: 'rgba(var(--gold-rgb),0.2)' },
  accepted: { color: 'var(--status-success)', bg: 'rgba(var(--status-success-rgb),0.08)', border: 'rgba(var(--status-success-rgb),0.25)' },
  declined: { color: 'var(--error)', bg: 'rgba(var(--error-rgb),0.08)', border: 'rgba(var(--error-rgb),0.2)' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.reviewed
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 500,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: '3px',
      padding: '3px 8px',
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  )
}

export default async function BriefsListPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('id, created_at, parties, court, matter_type, urgency, status, your_name')
    .order('created_at', { ascending: false })

  return (
    <div style={{ minHeight: '100vh' }}>

      <StaffHeader email={user.email ?? ''} />

      <main style={{ maxWidth: '1040px', margin: '0 auto', padding: '56px 48px 80px' }}>

        <div style={{ marginBottom: '40px' }}>
          <span className="section-label">Briefs</span>
          <h1 style={{ fontFamily: 'var(--font-garamond, EB Garamond, Georgia, serif)', fontSize: '36px', fontWeight: 400, fontStyle: 'italic', color: 'var(--cream)', lineHeight: 1.1 }}>
            Incoming Briefs
          </h1>
        </div>

        {error && (
          <p style={{ color: 'var(--error)', fontSize: '14px' }}>Failed to load briefs: {error.message}</p>
        )}

        {briefs && briefs.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No briefs submitted yet.</p>
        )}

        {briefs && briefs.length > 0 && (
          <div style={{ border: '1px solid var(--rule)', borderRadius: '4px', overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr 160px 110px 90px 100px 32px',
              gap: '16px',
              padding: '10px 20px',
              borderBottom: '1px solid var(--rule)',
              background: 'rgba(var(--ink-rgb),0.02)',
            }}>
              {['Date', 'Parties', 'Court', 'Matter', 'Urgency', 'Status', ''].map(h => (
                <span key={h} style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</span>
              ))}
            </div>

            {briefs.map((b, i) => (
              <BriefRow key={b.id} href={`/staff/briefs/${b.id}`} isLast={i === briefs.length - 1}>
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatChambersDate(b.created_at)}
                </span>
                <div>
                  <span style={{ fontSize: '14px', color: 'var(--cream)', display: 'block' }}>{b.parties}</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{b.your_name}</span>
                </div>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{b.court}</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{b.matter_type}</span>
                <span style={{ fontSize: '13px', color: b.urgency === 'Immediate' ? 'var(--status-warning)' : 'var(--muted)' }}>{b.urgency}</span>
                <StatusBadge status={b.status} />
                <span style={{ fontSize: '16px', color: 'var(--dim)' }}>→</span>
              </BriefRow>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
