import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import { StaffHeader } from '../StaffHeader'
import DeadlineRow from './DeadlineRow'
import { parseHearingDate, daysUntil, todayInChambers } from '../../../lib/chambers-time'

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  new:      { color: '#E8C97A', bg: 'rgba(232,201,122,0.08)', border: 'rgba(232,201,122,0.25)' },
  reviewed: { color: '#B4B0A9', bg: 'rgba(180,176,169,0.08)', border: 'rgba(180,176,169,0.2)' },
  accepted: { color: '#7AC8A0', bg: 'rgba(122,200,160,0.08)', border: 'rgba(122,200,160,0.25)' },
  declined: { color: '#D97C7C', bg: 'rgba(217,124,124,0.08)', border: 'rgba(217,124,124,0.2)' },
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

function UrgencyBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 500,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color,
      background: `${color}14`,
      border: `1px solid ${color}40`,
      borderRadius: '3px',
      padding: '3px 8px',
      whiteSpace: 'nowrap',
      marginLeft: '8px',
    }}>
      {label}
    </span>
  )
}

export default async function DeadlinesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('id, parties, court, matter_type, urgency, status, hearing_date, your_name')
    .not('hearing_date', 'is', null)
    .order('hearing_date', { ascending: true })

  // Resolved once per request, in the chambers' timezone rather than the
  // server's — see lib/chambers-time.ts.
  const today = todayInChambers()

  return (
    <div style={{ minHeight: '100vh' }}>

      <StaffHeader email={user.email ?? ''} />

      <main style={{ maxWidth: '1040px', margin: '0 auto', padding: '56px 48px 80px' }}>

        <div style={{ marginBottom: '40px' }}>
          <span className="section-label">Deadlines</span>
          <h1 style={{ fontFamily: 'var(--font-garamond, EB Garamond, Georgia, serif)', fontSize: '36px', fontWeight: 400, fontStyle: 'italic', color: 'var(--cream)', lineHeight: 1.1 }}>
            Key Dates
          </h1>
        </div>

        {error && (
          <p style={{ color: '#D97C7C', fontSize: '14px' }}>Failed to load briefs: {error.message}</p>
        )}

        {briefs && briefs.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No briefs with a hearing date.</p>
        )}

        {briefs && briefs.length > 0 && (
          <div style={{ border: '1px solid var(--rule)', borderRadius: '4px', overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '190px 1fr 160px 110px 100px 32px',
              gap: '16px',
              padding: '10px 20px',
              borderBottom: '1px solid var(--rule)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              {['Hearing date', 'Parties', 'Court', 'Matter', 'Status', ''].map(h => (
                <span key={h} style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</span>
              ))}
            </div>

            {briefs.map((b, i) => {
              const hearing = parseHearingDate(b.hearing_date!)
              const diffDays = daysUntil(hearing, today)

              let badge: { label: string; color: string } | null = null
              if (diffDays < 0) badge = { label: 'Overdue', color: '#D97C7C' }
              else if (diffDays <= 7) badge = { label: 'This week', color: '#E8C97A' }

              return (
                <DeadlineRow key={b.id} href={`/staff/briefs/${b.id}`} isLast={i === briefs.length - 1}>
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {hearing.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {badge && <UrgencyBadge label={badge.label} color={badge.color} />}
                  </span>
                  <div>
                    <span style={{ fontSize: '14px', color: 'var(--cream)', display: 'block' }}>{b.parties}</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{b.your_name}</span>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{b.court}</span>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{b.matter_type}</span>
                  <StatusBadge status={b.status} />
                  <span style={{ fontSize: '16px', color: 'var(--dim)' }}>→</span>
                </DeadlineRow>
              )
            })}
          </div>
        )}

      </main>
    </div>
  )
}
