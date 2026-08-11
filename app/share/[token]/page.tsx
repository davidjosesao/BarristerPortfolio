import type { Metadata } from 'next'
import { createServiceClient } from '../../../lib/supabase/service'
import {
  checkShare, MIN_TOKEN_LENGTH, SHARE_VISIBLE_COLUMNS,
} from '../../../lib/share-links'
import { formatChambersDate, formatHearingDate } from '../../../lib/chambers-time'

// Every request must hit the database: a cached render would keep showing a
// revoked link's contents, and the view stamp would stop being recorded.
export const dynamic = 'force-dynamic'

// A brief's existence is not for search engines. This is belt and braces
// alongside the noindex header set in proxy/middleware-level config.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

const STATUS_COPY: Record<string, { label: string; color: string; blurb: string }> = {
  new:      { label: 'Received',  color: 'var(--status-warning)', blurb: 'The brief has been received and is awaiting review.' },
  reviewed: { label: 'Reviewed',  color: 'var(--gold)', blurb: 'The brief has been reviewed by chambers.' },
  accepted: { label: 'Accepted',  color: 'var(--status-success)', blurb: 'Counsel has accepted the brief.' },
  declined: { label: 'Declined',  color: 'var(--error)', blurb: 'Counsel is unable to accept this brief.' },
}

/**
 * What a visitor sees when a link is wrong, withdrawn or lapsed.
 *
 * Deliberately identical in all three cases. Distinguishing them would let
 * someone probing tokens learn which ones were once real, and telling a
 * recipient their link was "revoked" discloses a chambers decision that is not
 * theirs to read.
 */
function LinkUnavailable() {
  return (
    <main style={{ maxWidth: '560px', margin: '0 auto', padding: '120px 32px' }}>
      <span className="section-label">Brief status</span>
      <h1 style={{
        fontFamily: 'var(--font-garamond, EB Garamond, Georgia, serif)',
        fontSize: '32px', fontWeight: 400, fontStyle: 'italic',
        color: 'var(--cream)', lineHeight: 1.2, marginBottom: '18px',
      }}>
        This link is not available
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.8 }}>
        The link may have expired, been withdrawn, or been typed incorrectly.
        Please contact chambers if you need an up-to-date status.
      </p>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '150px 1fr', gap: '16px',
      padding: '12px 0', borderBottom: '1px solid var(--rule)', alignItems: 'start',
    }}>
      <span style={{
        fontSize: '12px', fontWeight: 500, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--muted)', paddingTop: '2px',
      }}>
        {label}
      </span>
      <span style={{ fontSize: '14px', color: 'var(--cream)', lineHeight: 1.65 }}>{value}</span>
    </div>
  )
}

export default async function SharedBriefPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Reject obvious junk before touching the database.
  if (!token || token.length < MIN_TOKEN_LENGTH) {
    return <LinkUnavailable />
  }

  // No user is logged in here, so RLS has nobody to filter for; the service
  // client is scoped by the token lookup and the checks immediately below.
  const supabase = createServiceClient()

  const { data: share } = await supabase
    .from('brief_shares')
    .select('id, brief_id, expires_at, revoked_at, view_count')
    .eq('token', token)
    .maybeSingle()

  if (!share) return <LinkUnavailable />

  const check = checkShare(share)
  if (!check.valid) return <LinkUnavailable />

  const { data: brief } = await supabase
    .from('briefs')
    .select(SHARE_VISIBLE_COLUMNS)
    .eq('id', share.brief_id)
    .maybeSingle<{
      id: string
      parties: string
      court: string | null
      jurisdiction: string | null
      matter_type: string | null
      urgency: string | null
      hearing_date: string | null
      status: string
      created_at: string
    }>()

  if (!brief) return <LinkUnavailable />

  // Fire-and-forget: the barrister wants to know whether the solicitor has
  // opened this, but a failure to record it must never stop the page
  // rendering. The count is read-modify-write and so may undercount if two
  // people open the link in the same instant — acceptable for a "has this
  // been seen" signal, and not worth a migration to fix.
  void supabase
    .from('brief_shares')
    .update({
      last_viewed_at: new Date().toISOString(),
      view_count: (share.view_count ?? 0) + 1,
    })
    .eq('id', share.id)
    .then(undefined, () => {})

  const status = STATUS_COPY[brief.status] ?? STATUS_COPY.reviewed

  return (
    <main style={{ maxWidth: '680px', margin: '0 auto', padding: '80px 32px 100px' }}>

      <div style={{ marginBottom: '40px' }}>
        <span className="section-label">Brief status</span>
        <h1 style={{
          fontFamily: 'var(--font-garamond, EB Garamond, Georgia, serif)',
          fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 400, fontStyle: 'italic',
          color: 'var(--cream)', lineHeight: 1.15, marginBottom: '10px',
        }}>
          {brief.parties}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Submitted {formatChambersDate(brief.created_at)}
        </p>
      </div>

      <div style={{
        padding: '22px 26px', borderRadius: '4px', marginBottom: '36px',
        border: `1px solid ${status.color}40`, background: `${status.color}0f`,
      }}>
        <span style={{
          display: 'block', fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: status.color, marginBottom: '8px',
        }}>
          {status.label}
        </span>
        <p style={{ fontSize: '14px', color: 'var(--cream)', lineHeight: 1.7 }}>
          {status.blurb}
        </p>
      </div>

      <h2 style={{
        fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px',
      }}>
        Matter
      </h2>
      <div style={{ marginBottom: '36px' }}>
        <Row label="Parties" value={brief.parties} />
        <Row label="Court" value={brief.court} />
        <Row label="Jurisdiction" value={brief.jurisdiction} />
        <Row label="Matter type" value={brief.matter_type} />
        <Row label="Urgency" value={brief.urgency} />
        <Row
          label="Hearing date"
          value={brief.hearing_date ? formatHearingDate(brief.hearing_date) : 'Not set'}
        />
      </div>

      <p style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.75 }}>
        This is a read-only summary provided by chambers. It shows the progress
        of the brief only — it is not the brief itself, and does not include
        chambers&rsquo; notes or fees. Please contact chambers directly with any
        questions.
      </p>

    </main>
  )
}
