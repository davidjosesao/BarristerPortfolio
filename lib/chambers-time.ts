/**
 * Dates in this app are only ever meaningful in the chambers' own timezone.
 *
 * Server rendering happens in UTC on Vercel, so `new Date()` there is not
 * "today" for a barrister in Sydney: at 9am on the 11th locally it is still
 * 11pm on the 10th in UTC. Anything that decides whether a hearing is overdue
 * has to ask what the date is *in chambers*, not on the server.
 */
export const CHAMBERS_TZ = 'Australia/Sydney'

/**
 * Today's calendar date in chambers, as a Date at local midnight — the same
 * shape `parseHearingDate` returns, so the two are directly comparable.
 */
export function todayInChambers(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: CHAMBERS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return new Date(get('year'), get('month') - 1, get('day'))
}

/**
 * Parse a Postgres `date` value ('YYYY-MM-DD') as local midnight.
 *
 * `new Date('2026-08-15')` parses as UTC midnight, which formats as the
 * previous day anywhere east of Greenwich. Building from the parts sidesteps
 * that entirely — a `date` column carries no time, so there is nothing to
 * convert.
 */
export function parseHearingDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Format a `timestamptz` (e.g. briefs.created_at) as a date in chambers.
 *
 * Without an explicit timeZone, toLocaleDateString formats in the *server's*
 * zone, so a brief submitted at 9am Sydney renders as the previous day once
 * deployed to a UTC host.
 */
export function formatChambersDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-AU', {
    timeZone: CHAMBERS_TZ,
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

/** As above, with the time — used where the exact moment of receipt matters. */
export function formatChambersDateTime(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-AU', {
    timeZone: CHAMBERS_TZ,
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
}

/**
 * Format a `date` column ('YYYY-MM-DD'). No timeZone is passed here because
 * parseHearingDate already produced local midnight — supplying one would
 * reintroduce the very conversion it exists to avoid.
 */
export function formatHearingDate(value: string): string {
  return parseHearingDate(value).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

/** Whole days from today-in-chambers to `date`. Negative means past. */
export function daysUntil(date: Date, today: Date = todayInChambers()): number {
  const DAY_MS = 24 * 60 * 60 * 1000
  // Both operands are local midnight, so rounding absorbs any DST hour shift
  // between them rather than truncating a 23-hour day down to zero.
  return Math.round((date.getTime() - today.getTime()) / DAY_MS)
}
