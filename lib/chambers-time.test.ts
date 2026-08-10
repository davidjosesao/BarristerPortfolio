import { todayInChambers, parseHearingDate, daysUntil, CHAMBERS_TZ } from './chambers-time'

/**
 * These assertions are deliberately independent of the machine's own timezone.
 *
 * `todayInChambers` derives its calendar date through Intl in CHAMBERS_TZ and
 * then rebuilds a local Date from those parts, so reading it back with
 * getFullYear/getMonth/getDate round-trips exactly wherever the test runs.
 * `parseHearingDate` builds local midnight the same way, so the difference
 * between the two is a whole number of days regardless of process TZ.
 *
 * Run under both `TZ=UTC` (what Vercel does) and `TZ=Australia/Sydney` to
 * confirm — see the npm `test:tz` script.
 */

/** Readable assertion helper: a Date's local Y/M/D as a plain tuple. */
function ymd(d: Date): [number, number, number] {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
}

describe('CHAMBERS_TZ', () => {
  it('is an Australian timezone', () => {
    expect(CHAMBERS_TZ).toBe('Australia/Sydney')
  })
})

describe('parseHearingDate', () => {
  it("reads a Postgres date string as that same calendar day", () => {
    expect(ymd(parseHearingDate('2026-08-15'))).toEqual([2026, 8, 15])
  })

  it('does not shift the day backwards the way Date.parse does', () => {
    // The bug this guards: new Date('2026-08-15') is UTC midnight, which is
    // 2026-08-14 in any timezone west of Greenwich and formats as the 14th.
    const parsed = parseHearingDate('2026-08-15')
    expect(parsed.getDate()).toBe(15)
    expect(parsed.getHours()).toBe(0)
  })

  it('handles the first and last day of a month', () => {
    expect(ymd(parseHearingDate('2026-01-01'))).toEqual([2026, 1, 1])
    expect(ymd(parseHearingDate('2026-12-31'))).toEqual([2026, 12, 31])
  })

  it('handles a leap day', () => {
    expect(ymd(parseHearingDate('2028-02-29'))).toEqual([2028, 2, 29])
  })
})

describe('todayInChambers', () => {
  it('returns the Sydney date, not the server date, late in the UTC day', () => {
    // 23:30 UTC on the 10th is already 09:30 on the 11th in Sydney (UTC+10).
    // A server thinking in UTC would call this the 10th; chambers calls it the 11th.
    const now = new Date('2026-08-10T23:30:00Z')
    expect(ymd(todayInChambers(now))).toEqual([2026, 8, 11])
  })

  it('agrees with the server early in the UTC day', () => {
    // 02:00 UTC on the 11th is midday on the 11th in Sydney — same date.
    const now = new Date('2026-08-11T02:00:00Z')
    expect(ymd(todayInChambers(now))).toEqual([2026, 8, 11])
  })

  it('rolls over the year boundary in chambers before it does in UTC', () => {
    // 2026-12-31T14:00Z is 2027-01-01 01:00 in Sydney (AEDT, UTC+11).
    const now = new Date('2026-12-31T14:00:00Z')
    expect(ymd(todayInChambers(now))).toEqual([2027, 1, 1])
  })

  it('returns a date at local midnight so it is comparable to a hearing date', () => {
    const today = todayInChambers(new Date('2026-08-10T23:30:00Z'))
    expect([today.getHours(), today.getMinutes(), today.getSeconds()]).toEqual([0, 0, 0])
  })
})

describe('daysUntil', () => {
  const now = new Date('2026-08-10T23:30:00Z') // 11 Aug, 09:30 in Sydney
  const today = todayInChambers(now)

  it('is 0 for a hearing today in chambers', () => {
    expect(daysUntil(parseHearingDate('2026-08-11'), today)).toBe(0)
  })

  it('is negative for a hearing that has already passed', () => {
    expect(daysUntil(parseHearingDate('2026-08-10'), today)).toBe(-1)
  })

  it('is positive for a future hearing', () => {
    expect(daysUntil(parseHearingDate('2026-08-18'), today)).toBe(7)
    expect(daysUntil(parseHearingDate('2026-09-01'), today)).toBe(21)
  })

  /**
   * The regression test for the bug this module exists to fix.
   *
   * With `today` taken as server-local midnight under UTC, a hearing on 10 Aug
   * came out as 0 days away and rendered as "This week" — telling the
   * barrister a hearing was upcoming when it had already been heard. It must
   * be strictly negative so the page shows "Overdue".
   */
  it('marks yesterday-in-chambers as past even when UTC still calls it today', () => {
    const serverNaiveToday = new Date(now)
    serverNaiveToday.setHours(0, 0, 0, 0)

    const hearing = parseHearingDate('2026-08-10')
    const correct = daysUntil(hearing, todayInChambers(now))

    expect(correct).toBeLessThan(0)

    // Demonstrate the old behaviour differed, but only when the process really
    // is running in UTC — otherwise there is nothing to contrast against.
    if (process.env.TZ === 'UTC') {
      expect(daysUntil(hearing, serverNaiveToday)).toBe(0)
      expect(correct).not.toBe(daysUntil(hearing, serverNaiveToday))
    }
  })

  it('counts whole days across a Sydney daylight-saving transition', () => {
    // AEDT starts on the first Sunday of October (4 Oct 2026), when local time
    // jumps 02:00 -> 03:00 and the day is only 23 hours long. Truncating that
    // division would report one day fewer than the calendar shows.
    const from = parseHearingDate('2026-10-03')
    const to = parseHearingDate('2026-10-05')
    expect(daysUntil(to, from)).toBe(2)
  })

  it('counts whole days across the end of daylight saving', () => {
    // AEDT ends on the first Sunday of April (5 Apr 2026) — a 25-hour day.
    const from = parseHearingDate('2026-04-04')
    const to = parseHearingDate('2026-04-06')
    expect(daysUntil(to, from)).toBe(2)
  })

  it('defaults its reference point to today when none is given', () => {
    expect(daysUntil(todayInChambers())).toBe(0)
  })
})
