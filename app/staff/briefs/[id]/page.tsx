import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase/server'
import BriefActions from './BriefActions'

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      gap: '16px',
      padding: '12px 0',
      borderBottom: '1px solid var(--rule)',
      alignItems: 'start',
    }}>
      <span style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', paddingTop: '2px' }}>
        {label}
      </span>
      <span style={{ fontSize: '14px', color: 'var(--cream)', lineHeight: 1.65 }}>{value}</span>
    </div>
  )
}

export default async function BriefDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { data: brief, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', params.id)
    .single()

  // Only treat a "no rows" result as 404 — real DB/permission errors should surface
  if (!brief) notFound()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)

  const submitted = new Date(brief.created_at).toLocaleString('en-AU', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* Nav */}
      <div className="nav-brief-inner">
        <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '0 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/staff/briefs" className="nav-back">
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
              <path d="M5 1L1 5l4 4M1 5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            All briefs
          </Link>
          <span className="nav-name">Brief detail</span>
        </div>
      </div>

      <main style={{ maxWidth: '1040px', margin: '0 auto', padding: '56px 48px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '48px' }}>
          <span className="section-label">Brief</span>
          <h1 style={{
            fontFamily: 'var(--font-garamond, EB Garamond, Georgia, serif)',
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 400, fontStyle: 'italic',
            color: 'var(--cream)', lineHeight: 1.1, marginBottom: '10px',
          }}>
            {brief.parties}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Submitted {submitted} by {brief.your_name}{brief.firm_name ? `, ${brief.firm_name}` : ''}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '64px', alignItems: 'start' }}>

          {/* Left: details */}
          <div>

            {/* AI Summary */}
            <div style={{
              padding: '24px 28px',
              border: '1px solid rgba(232,229,223,0.12)',
              borderRadius: '4px',
              background: 'rgba(232,229,223,0.03)',
              marginBottom: '40px',
            }}>
              <span style={{
                display: 'block', fontSize: '11px', fontWeight: 500,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--gold)', marginBottom: '14px',
              }}>
                AI Summary
              </span>
              <div style={{ fontSize: '14px', color: 'var(--cream)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {brief.ai_summary || 'No summary available.'}
              </div>
            </div>

            {/* Contact */}
            <h2 style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
              Contact
            </h2>
            <div style={{ marginBottom: '32px' }}>
              <Row label="Name" value={brief.your_name} />
              <Row label="Firm" value={brief.firm_name} />
              <Row label="Email" value={brief.your_email} />
              <Row label="Phone" value={brief.your_phone} />
            </div>

            {/* Matter */}
            <h2 style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
              Matter
            </h2>
            <div style={{ marginBottom: '32px' }}>
              <Row label="Parties" value={brief.parties} />
              <Row label="Court" value={brief.court} />
              <Row label="Jurisdiction" value={brief.jurisdiction} />
              <Row label="Matter type" value={brief.matter_type} />
              <Row label="Urgency" value={brief.urgency} />
              <Row label="Hearing date" value={brief.hearing_date ?? 'Not set'} />
            </div>

            {/* Key facts */}
            <h2 style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
              Key facts
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--cream)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {brief.key_facts}
            </p>

          </div>

          {/* Right: actions */}
          <div style={{
            padding: '28px',
            border: '1px solid var(--rule)',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.02)',
            position: 'sticky',
            top: '80px',
          }}>
            <span style={{
              display: 'block', fontSize: '11px', fontWeight: 500,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--muted)', marginBottom: '24px',
            }}>
              Chambers actions
            </span>
            <BriefActions
              briefId={brief.id}
              initialStatus={brief.status}
              initialNotes={brief.staff_notes}
            />
          </div>

        </div>

      </main>
    </div>
  )
}
