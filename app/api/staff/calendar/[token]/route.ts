import { buildCalendar, briefUid, IcsEvent } from '../../../../../lib/ics'
import { createServiceClient } from '../../../../../lib/supabase/service'

export const runtime = 'nodejs'

// Calendar apps (Apple/Google/Outlook) poll this URL directly and cannot
// send an Authorization header, so the token in the path *is* the auth —
// treat it like a bearer credential throughout this handler.
const MIN_TOKEN_LENGTH = 20

// Used to build stable per-brief UIDs (see lib/ics.ts) and has no bearing
// on deliverability — this feed is never emailed, only subscribed to.
const UID_DOMAIN = 'chambers-calendar.local'

function notFound(): Response {
  // Deliberately the same response whether the token never existed or was
  // rotated away — distinguishing the two would let someone probe for
  // previously-valid tokens.
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < MIN_TOKEN_LENGTH) {
    return notFound()
  }

  // A calendar poll has no signed-in user, so this must run under the
  // service role — the caller's own RLS-scoped client (as staff-auth.ts
  // uses) isn't available here at all.
  const supabase = createServiceClient()

  // `staff` is keyed by email — there is no id column. Selecting one made
  // every lookup error out, and because a failed lookup is indistinguishable
  // from an unknown token here, the feed returned 404 for valid tokens too.
  const { data: staffRow } = await supabase
    .from('staff')
    .select('email')
    .eq('calendar_token', token)
    .maybeSingle()

  if (!staffRow) {
    return notFound()
  }

  const { data: briefs, error } = await supabase
    .from('briefs')
    .select('id, hearing_date, parties, court, matter_type')
    .not('hearing_date', 'is', null)
    .neq('status', 'declined')
    .order('hearing_date', { ascending: true })

  if (error || !briefs) {
    return new Response('Internal error', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
    })
  }

  const events: IcsEvent[] = briefs.map((b) => ({
    uid: briefUid(b.id, UID_DOMAIN),
    date: b.hearing_date as string,
    summary: `${b.parties} — ${b.court}`,
    description: b.matter_type ?? undefined,
    location: b.court ?? undefined,
  }))

  const ics = buildCalendar(events, {
    calendarName: 'Chambers Hearings',
    prodId: '-//Chambers//Hearing Calendar//EN',
  })

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // Never let a shared cache (proxy, CDN) hold onto someone else's diary.
      'Cache-Control': 'private, no-store',
    },
  })
}
