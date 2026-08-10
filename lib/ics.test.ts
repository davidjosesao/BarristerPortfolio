import { buildCalendar, escapeIcsText, foldLine, briefUid, IcsEvent } from './ics'

const OPTS = { calendarName: 'Chambers Hearings', prodId: '-//Chambers//Hearing Calendar//EN' }

function unfold(ics: string): string[] {
  // Reverse RFC 5545 folding so assertions can reason about logical lines.
  return ics.split('\r\n').reduce<string[]>((acc, raw) => {
    if (raw.startsWith(' ') && acc.length > 0) {
      acc[acc.length - 1] += raw.slice(1)
    } else if (raw.length > 0) {
      acc.push(raw)
    }
    return acc
  }, [])
}

describe('buildCalendar', () => {
  it('uses CRLF between every line', () => {
    const ics = buildCalendar([{ uid: 'a', date: '2026-09-14', summary: 'Hearing' }], OPTS)
    expect(ics).toContain('\r\n')
    expect(ics).not.toMatch(/[^\r]\n/) // no bare LF
    // every content line (before folding continuations) ends with CRLF
    const withoutFinalEmpty = ics.split('\r\n').filter((_, i, arr) => i < arr.length - 1)
    expect(withoutFinalEmpty.length).toBeGreaterThan(0)
  })

  it('produces a valid VCALENDAR skeleton for an empty event list', () => {
    const ics = buildCalendar([], OPTS)
    const lines = unfold(ics)
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines).toContain('CALSCALE:GREGORIAN')
    expect(lines).toContain('METHOD:PUBLISH')
    expect(lines).toContain('X-WR-CALNAME:Chambers Hearings')
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('includes required calendar and event properties', () => {
    const ics = buildCalendar(
      [{ uid: 'brief-1@chambers.example', date: '2026-09-14', summary: 'Smith v Jones' }],
      OPTS
    )
    const lines = unfold(ics)
    expect(lines).toContain('BEGIN:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines.some((l) => l.startsWith('PRODID:'))).toBe(true)
    expect(lines).toContain('CALSCALE:GREGORIAN')
    expect(lines).toContain('METHOD:PUBLISH')
    expect(lines).toContain('BEGIN:VEVENT')
    expect(lines).toContain('UID:brief-1@chambers.example')
    expect(lines.some((l) => l.startsWith('DTSTAMP:'))).toBe(true)
    expect(lines).toContain('SUMMARY:Smith v Jones')
    expect(lines).toContain('END:VEVENT')
    expect(lines).toContain('END:VCALENDAR')
  })

  it('emits all-day DTSTART with VALUE=DATE and no time/timezone component', () => {
    const ics = buildCalendar([{ uid: 'a', date: '2026-09-14', summary: 'Hearing' }], OPTS)
    const lines = unfold(ics)
    expect(lines).toContain('DTSTART;VALUE=DATE:20260914')
    expect(lines.find((l) => l.startsWith('DTSTART'))).not.toMatch(/T\d{6}/)
  })

  it('sets DTEND to the day after DTSTART (DTEND is exclusive)', () => {
    const ics = buildCalendar([{ uid: 'a', date: '2026-09-14', summary: 'Hearing' }], OPTS)
    const lines = unfold(ics)
    expect(lines).toContain('DTEND;VALUE=DATE:20260915')
  })

  it('rolls DTEND across a month boundary', () => {
    const ics = buildCalendar([{ uid: 'a', date: '2026-01-31', summary: 'Hearing' }], OPTS)
    const lines = unfold(ics)
    expect(lines).toContain('DTSTART;VALUE=DATE:20260131')
    expect(lines).toContain('DTEND;VALUE=DATE:20260201')
  })

  it('rolls DTEND across a year boundary', () => {
    const ics = buildCalendar([{ uid: 'a', date: '2026-12-31', summary: 'Hearing' }], OPTS)
    const lines = unfold(ics)
    expect(lines).toContain('DTSTART;VALUE=DATE:20261231')
    expect(lines).toContain('DTEND;VALUE=DATE:20270101')
  })

  it('rolls DTEND across a leap day', () => {
    const ics = buildCalendar([{ uid: 'a', date: '2028-02-28', summary: 'Hearing' }], OPTS)
    const lines = unfold(ics)
    expect(lines).toContain('DTSTART;VALUE=DATE:20280228')
    expect(lines).toContain('DTEND;VALUE=DATE:20280229')
  })

  it('does not roll DTEND past Feb 29 into Mar 1 incorrectly on a leap year', () => {
    const ics = buildCalendar([{ uid: 'a', date: '2028-02-29', summary: 'Hearing' }], OPTS)
    const lines = unfold(ics)
    expect(lines).toContain('DTEND;VALUE=DATE:20280301')
  })

  it('escapes commas, semicolons, backslashes and newlines in text fields', () => {
    const ev: IcsEvent = {
      uid: 'a',
      date: '2026-09-14',
      summary: 'Smith, Jones & Co v Brown',
      description: 'Line one\nLine two; with a \\ backslash, and a comma',
      location: 'Court; Room, 3',
    }
    const ics = buildCalendar([ev], OPTS)
    const lines = unfold(ics)
    expect(lines).toContain('SUMMARY:Smith\\, Jones & Co v Brown')
    expect(lines.find((l) => l.startsWith('DESCRIPTION:'))).toBe(
      'DESCRIPTION:Line one\\nLine two\\; with a \\\\ backslash\\, and a comma'
    )
    expect(lines).toContain('LOCATION:Court\\; Room\\, 3')
  })

  it('produces stable UIDs across repeated calls for the same brief', () => {
    const ev: IcsEvent = { uid: briefUid('brief-123', 'chambers.example'), date: '2026-09-14', summary: 'Hearing' }
    const first = buildCalendar([ev], OPTS)
    const second = buildCalendar([ev], OPTS)
    const uidOf = (ics: string) => unfold(ics).find((l) => l.startsWith('UID:'))
    expect(uidOf(first)).toBe(uidOf(second))
    expect(uidOf(first)).toBe('UID:brief-123@chambers.example')
  })

  it('produces different UIDs for different briefs', () => {
    expect(briefUid('brief-1', 'chambers.example')).not.toBe(briefUid('brief-2', 'chambers.example'))
  })
})

describe('escapeIcsText', () => {
  it('escapes backslash before other characters so escapes are not double-escaped', () => {
    expect(escapeIcsText('a\\;b')).toBe('a\\\\\\;b')
  })

  it('turns newlines into the literal two-character sequence \\n', () => {
    expect(escapeIcsText('a\nb')).toBe('a\\nb')
    expect(escapeIcsText('a\r\nb')).toBe('a\\nb')
  })

  it('escapes commas and semicolons', () => {
    expect(escapeIcsText('a,b;c')).toBe('a\\,b\\;c')
  })

  it('leaves plain text untouched', () => {
    expect(escapeIcsText('Smith v Jones')).toBe('Smith v Jones')
  })
})

describe('foldLine', () => {
  it('leaves short lines unfolded', () => {
    const short = 'SUMMARY:Smith v Jones'
    expect(foldLine(short)).toBe(short)
  })

  it('folds lines longer than 75 octets, continuation lines starting with a space', () => {
    const long = 'SUMMARY:' + 'A very long party name that goes on and on '.repeat(3)
    const folded = foldLine(long)
    expect(folded).toContain('\r\n ')
    const segments = folded.split('\r\n')
    // first segment at or under the fold limit
    expect(Buffer.byteLength(segments[0], 'utf8')).toBeLessThanOrEqual(75)
    // every continuation line starts with exactly one leading space
    for (const seg of segments.slice(1)) {
      expect(seg.startsWith(' ')).toBe(true)
    }
    // rejoining (stripping the fold) reconstructs the original content
    const rejoined = segments.map((s, i) => (i === 0 ? s : s.slice(1))).join('')
    expect(rejoined).toBe(long)
  })

  it('round-trips through buildCalendar for a long party name without corrupting content', () => {
    const longSummary = 'Smith, Jones, Robinson, Blackwood & Associates Pty Ltd v Brown, Green and Others (No 3)'
    const ics = buildCalendar([{ uid: 'a', date: '2026-09-14', summary: longSummary }], OPTS)
    const lines = unfold(ics)
    expect(lines).toContain('SUMMARY:' + escapeIcsSummaryForTest(longSummary))
  })
})

// local helper mirroring escapeIcsText, kept separate so the round-trip test
// doesn't just call the function under test on both sides
function escapeIcsSummaryForTest(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
}
