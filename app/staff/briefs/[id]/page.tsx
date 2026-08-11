import { redirect, notFound } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import { StaffHeader } from '../../StaffHeader'
import BriefActions from './BriefActions'
import FeesPanel, { type Fee } from './FeesPanel'
import SharePanel, { type Share } from './SharePanel'
import ChronologyPanel from './ChronologyPanel'
import { formatChambersDateTime, formatHearingDate } from '../../../../lib/chambers-time'

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

export default async function BriefDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/staff/login')

  const { data: brief, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', id)
    .single()

  // Only treat a "no rows" result as 404 — real DB/permission errors should surface
  if (!brief) notFound()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)

  // Deliberately non-fatal: until supabase/schema.sql has been re-run the
  // `fees` table does not exist, and a brief should still be readable rather
  // than 500-ing the whole page over a section that has not been set up yet.
  const { data: feesData, error: feesError } = await supabase
    .from('fees')
    .select('id, fee_type, description, quantity, unit_amount, gst_applicable, gst_rate, amount_ex_gst, gst_amount')
    .eq('brief_id', id)
    .order('created_at', { ascending: true })

  const fees = (feesData ?? []) as Fee[]

  // Same non-fatal treatment as fees: the brief must stay readable before the
  // brief_shares migration has been run.
  const { data: sharesData, error: sharesError } = await supabase
    .from('brief_shares')
    .select('id, token, created_at, created_by, expires_at, revoked_at, last_viewed_at, view_count')
    .eq('brief_id', id)
    .order('created_at', { ascending: false })

  const shares = (sharesData ?? []) as Share[]

  const submitted = formatChambersDateTime(brief.created_at)

  return (
    <div style={{ minHeight: '100vh' }}>

      <StaffHeader
        email={user.email ?? ''}
        back={{ href: '/staff/briefs', label: 'All briefs' }}
      />

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
              border: '1px solid rgba(var(--ink-rgb),0.12)',
              borderRadius: '4px',
              background: 'rgba(var(--ink-rgb),0.03)',
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
              <Row label="Hearing date" value={brief.hearing_date ? formatHearingDate(brief.hearing_date) : 'Not set'} />
            </div>

            {/* Key facts */}
            <h2 style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
              Key facts
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--cream)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {brief.key_facts}
            </p>

            {/* Chronology + AI questions */}
            <h2 style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '40px 0 12px' }}>
              Analysis
            </h2>
            <ChronologyPanel briefId={brief.id} initialChronology={brief.chronology ?? null} />

            {/* Fees */}
            <h2 style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '40px 0 12px' }}>
              Fees
            </h2>
            {feesError ? (
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
                Fee tracking is not available yet — run the <code>fees</code> section of{' '}
                <code>supabase/schema.sql</code> in the Supabase SQL editor to enable it.
              </p>
            ) : (
              <FeesPanel briefId={brief.id} initialFees={fees} initialInvoiceNumber={brief.invoice_number ?? null} />
            )}

            {/* Share link */}
            <h2 style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '40px 0 12px' }}>
              Share with solicitor
            </h2>
            {sharesError ? (
              <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
                Share links are not available yet — run the <code>brief_shares</code> section
                of <code>supabase/schema.sql</code> in the Supabase SQL editor to enable them.
              </p>
            ) : (
              <SharePanel briefId={brief.id} initialShares={shares} />
            )}

          </div>

          {/* Right: actions */}
          <div style={{
            padding: '28px',
            border: '1px solid var(--rule)',
            borderRadius: '4px',
            background: 'rgba(var(--ink-rgb),0.02)',
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
