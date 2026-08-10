/**
 * Pure iCalendar (RFC 5545) serialisation. No DB, no auth, no Next.js —
 * kept separate from the route handler so the fiddly parts (line folding,
 * text escaping, exclusive DTEND arithmetic) are unit-testable without a
 * database or a request/response cycle.
 */

const CRLF = '\r\n'
const FOLD_LIMIT = 75 // octets per RFC 5545 §3.1 (excluding the CRLF itself)

export interface IcsEvent {
  /** Stable identifier for this event — same brief must always yield the same uid. */
  uid: string
  /** Postgres date string, 'YYYY-MM-DD'. Hearings are calendar days, not instants. */
  date: string
  summary: string
  description?: string
  location?: string
  url?: string
}

export interface BuildCalendarOptions {
  /** Shown as the calendar's display name in Apple/Google/Outlook. */
  calendarName: string
  /** Identifies the product per RFC 5545 §3.7.3, e.g. '-//Chambers//Hearing Calendar//EN'. */
  prodId: string
}

/**
 * Escapes TEXT-valued properties per RFC 5545 §3.3.11: backslash, semicolon
 * and comma are literal separators/escapes in the format and must be
 * backslash-escaped, and newlines become the two-character sequence `\n`
 * (not a real line break — that would be indistinguishable from folding).
 * Order matters: backslash must be escaped first, or the escapes just
 * inserted would themselves get re-escaped.
 */
export function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Folds a single unfolded content line to FOLD_LIMIT octets per line,
 * continuation lines prefixed with a single space (RFC 5545 §3.1). Folding
 * is byte-based, so multi-byte UTF-8 characters are counted by their
 * encoded length, not by JS string length, to avoid splitting mid-character.
 */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= FOLD_LIMIT) return line

  const parts: string[] = []
  let start = 0
  let limit = FOLD_LIMIT
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length)
    // Never split a multi-byte UTF-8 sequence: back off while the next byte
    // is a continuation byte (top two bits `10`).
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--
    }
    parts.push(bytes.subarray(start, end).toString('utf8'))
    start = end
    // Every continuation line after the first starts with a leading space,
    // which itself counts against that line's budget.
    limit = FOLD_LIMIT - 1
  }
  return parts.join(CRLF + ' ')
}

/** Formats a Date's UTC calendar parts as `YYYYMMDD`, for VALUE=DATE properties. */
function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0')
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = d.getUTCDate().toString().padStart(2, '0')
  return `${y}${m}${day}`
}

/**
 * DTEND is exclusive per RFC 5545 §3.8.2.2, so an all-day event's end is the
 * calendar day *after* its start. Parsed as UTC midnight so month/year
 * rollovers and leap days are handled by Date's own arithmetic rather than
 * hand-rolled month-length tables.
 */
function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return formatDateOnly(dt)
}

function dateOnlyStamp(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return formatDateOnly(new Date(Date.UTC(y, m - 1, d)))
}

/** Current instant as a UTC `DTSTAMP` value, e.g. `20260810T120000Z`. */
function nowStamp(): string {
  const d = new Date()
  const y = d.getUTCFullYear().toString().padStart(4, '0')
  const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const da = d.getUTCDate().toString().padStart(2, '0')
  const h = d.getUTCHours().toString().padStart(2, '0')
  const mi = d.getUTCMinutes().toString().padStart(2, '0')
  const s = d.getUTCSeconds().toString().padStart(2, '0')
  return `${y}${mo}${da}T${h}${mi}${s}Z`
}

function line(content: string): string {
  return foldLine(content) + CRLF
}

/**
 * Builds a full VCALENDAR document from a list of all-day events. Callers
 * (the feed route) are responsible for filtering which briefs to include —
 * this function just serialises whatever it's given.
 */
export function buildCalendar(events: IcsEvent[], opts: BuildCalendarOptions): string {
  const stamp = nowStamp()

  const head = [
    line('BEGIN:VCALENDAR'),
    line('VERSION:2.0'),
    line(`PRODID:${escapeIcsText(opts.prodId)}`),
    line('CALSCALE:GREGORIAN'),
    line('METHOD:PUBLISH'),
    line(`X-WR-CALNAME:${escapeIcsText(opts.calendarName)}`),
  ].join('')

  const body = events.map((ev) => {
    const lines = [
      line('BEGIN:VEVENT'),
      line(`UID:${escapeIcsText(ev.uid)}`),
      line(`DTSTAMP:${stamp}`),
      line(`DTSTART;VALUE=DATE:${dateOnlyStamp(ev.date)}`),
      line(`DTEND;VALUE=DATE:${nextDay(ev.date)}`),
      line(`SUMMARY:${escapeIcsText(ev.summary)}`),
    ]
    if (ev.description) lines.push(line(`DESCRIPTION:${escapeIcsText(ev.description)}`))
    if (ev.location) lines.push(line(`LOCATION:${escapeIcsText(ev.location)}`))
    if (ev.url) lines.push(line(`URL:${escapeIcsText(ev.url)}`))
    lines.push(line('END:VEVENT'))
    return lines.join('')
  }).join('')

  const tail = line('END:VCALENDAR')

  return head + body + tail
}

/** Stable per-brief UID so regenerating the feed updates events instead of duplicating them. */
export function briefUid(briefId: string, domain: string): string {
  return `${briefId}@${domain}`
}
