import { randomBytes } from 'node:crypto'

/**
 * Read-only share links for instructing solicitors.
 *
 * The token in the URL is the entire credential — there is no password and no
 * account behind it. Everything here is written on that assumption:
 *
 *   * tokens come from a CSPRNG and are never derived from the brief id, so
 *     holding one link tells you nothing about any other;
 *   * every refusal looks identical from outside, so the page cannot be used
 *     to probe which tokens exist;
 *   * the validity rules live in a pure function so they can be tested without
 *     a database, rather than being buried in a route handler.
 */

/** 32 bytes = 256 bits. base64url so it survives a URL path unescaped. */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Shortest token we will even look up. A real token is ~43 characters; this
 * rejects obviously junk paths before they reach the database.
 */
export const MIN_TOKEN_LENGTH = 20

export type ShareRow = {
  expires_at: string | null
  revoked_at: string | null
}

export type ShareCheck =
  | { valid: true }
  | { valid: false; reason: 'revoked' | 'expired' }

/**
 * Whether a share row may still be viewed.
 *
 * Revocation is checked before expiry only so the reason is stable for
 * logging; callers must not surface either reason to the visitor, because
 * "expired" confirms the token was once real and "not found" does not.
 */
export function checkShare(share: ShareRow, now: Date = new Date()): ShareCheck {
  if (share.revoked_at !== null) {
    return { valid: false, reason: 'revoked' }
  }

  if (share.expires_at !== null) {
    const expires = new Date(share.expires_at)
    // An unparseable timestamp is treated as expired rather than ignored:
    // failing closed is the only safe direction for an access check.
    if (Number.isNaN(expires.getTime()) || expires.getTime() <= now.getTime()) {
      return { valid: false, reason: 'expired' }
    }
  }

  return { valid: true }
}

/** Expiry options offered in the UI. `null` means the link does not expire. */
export const EXPIRY_CHOICES = [
  { label: '7 days',  days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'No expiry', days: null },
] as const

export function expiryFromDays(days: number | null, now: Date = new Date()): string | null {
  if (days === null) return null
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * The only brief columns a share link may expose.
 *
 * Everything omitted here is omitted deliberately: `staff_notes` and
 * `ai_summary` are chambers' internal assessment of the matter, `key_facts`
 * is privileged detail, and fees are a billing matter between chambers and
 * the solicitor rather than something to publish behind a link that may be
 * forwarded on. A share link answers "where is this up to", nothing more.
 */
export const SHARE_VISIBLE_COLUMNS =
  'id, parties, court, jurisdiction, matter_type, urgency, hearing_date, status, created_at'
