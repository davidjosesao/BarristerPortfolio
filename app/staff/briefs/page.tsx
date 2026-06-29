import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../lib/supabase/server'

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

export default async function BriefsListPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('id, created_at, parties, court, matter_type, urgency, status, your_name')
    .order('created_at', { ascending: false })

  async function handleSignOut() {
    'use server'
    const { createClient: mkClient } = await import('../../../lib/supabase/server')
    const sb = mkClient()
    await sb.auth.signOut()
    redirect('/staff/login')
  }

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* Nav */}
      <div className="nav-brief-inner">
        <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '0 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-garamond, EB Garamond, Georgia, serif)', fontStyle: 'italic', fontSize: '17px', color: 'var(--text)', opacity: 0.85 }}>
            Chambers Staff
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <span style={{ fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              {user.email}
            </span>
            <form action={handleSignOut}>
              <button type="submit" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--muted)',
                transition: 'color 0.2s', padding: 0,
              }}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: '1040px', margin: '0 auto', padding: '56px 48px 80px' }}>

        <div style={{ marginBottom: '40px' }}>
          <span className="section-label">Briefs</span>
          <h1 style={{ fontFamily: 'var(--font-garamond, EB Garamond, Georgia, serif)', fontSize: '36px', fontWeight: 400, fontStyle: 'italic', color: 'var(--cream)', lineHeight: 1.1 }}>
            Incoming Briefs
          </h1>
        </div>

        {error && (
          <p style={{ color: '#D97C7C', fontSize: '14px' }}>Failed to load briefs: {error.message}</p>
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
              background: 'rgba(255,255,255,0.02)',
            }}>
              {['Date', 'Parties', 'Court', 'Matter', 'Urgency', 'Status', ''].map(h => (
                <span key={h} style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</span>
              ))}
            </div>

            {briefs.map((b, i) => (
              <Link
                key={b.id}
                href={`/staff/briefs/${b.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr 160px 110px 90px 100px 32px',
                  gap: '16px',
                  padding: '16px 20px',
                  borderBottom: i < briefs.length - 1 ? '1px solid var(--rule)' : 'none',
                  textDecoration: 'none',
                  alignItems: 'center',
                  transition: 'background 0.2s',
                  background: 'transparent',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(b.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <div>
                  <span style={{ fontSize: '14px', color: 'var(--cream)', display: 'block' }}>{b.parties}</span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{b.your_name}</span>
                </div>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{b.court}</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{b.matter_type}</span>
                <span style={{ fontSize: '13px', color: b.urgency === 'Immediate' ? '#E8C97A' : 'var(--muted)' }}>{b.urgency}</span>
                <StatusBadge status={b.status} />
                <span style={{ fontSize: '16px', color: 'var(--dim)' }}>→</span>
              </Link>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
