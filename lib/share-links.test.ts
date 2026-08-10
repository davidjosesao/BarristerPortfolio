import {
  generateShareToken, checkShare, expiryFromDays,
  MIN_TOKEN_LENGTH, SHARE_VISIBLE_COLUMNS,
} from './share-links'

describe('generateShareToken', () => {
  it('is long enough to be unguessable', () => {
    const token = generateShareToken()
    // 32 random bytes in base64url ≈ 43 chars.
    expect(token.length).toBeGreaterThanOrEqual(43)
    expect(token.length).toBeGreaterThan(MIN_TOKEN_LENGTH)
  })

  it('is URL-path safe', () => {
    // base64url must not emit +, / or = — all of which would need escaping
    // and could be mangled by an intermediary before reaching the route.
    for (let i = 0; i < 50; i++) {
      expect(generateShareToken()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('does not repeat', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(generateShareToken())
    expect(seen.size).toBe(1000)
  })
})

describe('checkShare', () => {
  const now = new Date('2026-08-10T00:00:00Z')

  it('accepts a link with no expiry and no revocation', () => {
    expect(checkShare({ expires_at: null, revoked_at: null }, now)).toEqual({ valid: true })
  })

  it('accepts a link expiring in the future', () => {
    expect(checkShare({ expires_at: '2026-09-01T00:00:00Z', revoked_at: null }, now))
      .toEqual({ valid: true })
  })

  it('rejects a revoked link even when the expiry is still in the future', () => {
    expect(checkShare(
      { expires_at: '2026-09-01T00:00:00Z', revoked_at: '2026-08-05T00:00:00Z' }, now
    )).toEqual({ valid: false, reason: 'revoked' })
  })

  it('rejects a link whose expiry has passed', () => {
    expect(checkShare({ expires_at: '2026-08-09T23:59:59Z', revoked_at: null }, now))
      .toEqual({ valid: false, reason: 'expired' })
  })

  it('treats the exact expiry instant as expired', () => {
    // Boundary: at the moment of expiry the link is no longer valid.
    expect(checkShare({ expires_at: '2026-08-10T00:00:00Z', revoked_at: null }, now))
      .toEqual({ valid: false, reason: 'expired' })
  })

  /**
   * Fail closed. A corrupt or unparseable timestamp must deny access, not be
   * silently skipped — the alternative is that bad data quietly turns an
   * expiring link into a permanent one.
   */
  it('rejects an unparseable expiry rather than ignoring it', () => {
    expect(checkShare({ expires_at: 'not-a-date', revoked_at: null }, now))
      .toEqual({ valid: false, reason: 'expired' })
  })

  it('rejects a revoked link with no expiry', () => {
    expect(checkShare({ expires_at: null, revoked_at: '2026-01-01T00:00:00Z' }, now))
      .toEqual({ valid: false, reason: 'revoked' })
  })
})

describe('expiryFromDays', () => {
  const now = new Date('2026-08-10T12:00:00Z')

  it('returns null for a non-expiring link', () => {
    expect(expiryFromDays(null, now)).toBeNull()
  })

  it('adds the requested number of days', () => {
    expect(expiryFromDays(7, now)).toBe('2026-08-17T12:00:00.000Z')
    expect(expiryFromDays(30, now)).toBe('2026-09-09T12:00:00.000Z')
  })

  it('produces a value checkShare still accepts', () => {
    const expires = expiryFromDays(7, now)
    expect(checkShare({ expires_at: expires, revoked_at: null }, now)).toEqual({ valid: true })
  })

  it('produces a value that has expired once the period passes', () => {
    const expires = expiryFromDays(7, now)
    const later = new Date('2026-08-18T12:00:00Z')
    expect(checkShare({ expires_at: expires, revoked_at: null }, later))
      .toEqual({ valid: false, reason: 'expired' })
  })
})

describe('SHARE_VISIBLE_COLUMNS', () => {
  /**
   * A guard, not a formality. Adding a column to this list is how privileged
   * material would end up on a public page, so each of these must fail loudly
   * if someone widens the select without thinking about who can read it.
   */
  it.each(['staff_notes', 'ai_summary', 'key_facts', 'your_email', 'your_phone', 'firm_name', 'your_name'])(
    'never exposes %s through a share link',
    (column) => {
      expect(SHARE_VISIBLE_COLUMNS).not.toContain(column)
    }
  )

  it('does expose the progress fields the link exists to show', () => {
    for (const column of ['parties', 'court', 'matter_type', 'status', 'hearing_date']) {
      expect(SHARE_VISIBLE_COLUMNS).toContain(column)
    }
  })
})
