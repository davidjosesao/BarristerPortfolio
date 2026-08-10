import Link from 'next/link'
import { signOut } from './actions'

/**
 * The one staff header. Every /staff page under authentication renders this —
 * font, sizing and position come from a single place instead of being
 * hand-copied per page, which is how the list and detail pages drifted apart.
 *
 * `back` adds a secondary breadcrumb row underneath for pages nested below
 * the briefs list (e.g. a single brief). Omit it on the list page itself.
 */
export function StaffHeader({
  email,
  back,
}: {
  email: string
  back?: { href: string; label: string }
}) {
  return (
    <div className="staff-header">
      <div className="staff-header-inner">
        <div className="col">
          <div className="staff-header-row">
            <div className="staff-header-brand-group">
              <Link href="/staff/briefs" className="staff-brand">
                Chambers Staff
              </Link>
              <nav className="staff-nav">
                <Link href="/staff/briefs" className="staff-nav-link">Briefs</Link>
                <Link href="/staff/deadlines" className="staff-nav-link">Deadlines</Link>
              </nav>
            </div>
            <div className="staff-header-account">
              <span className="staff-email">{email}</span>
              <span className="staff-header-sep" aria-hidden="true">·</span>
              <form action={signOut} style={{ display: 'contents' }}>
                <button type="submit" className="staff-signout">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {back && (
        <div className="staff-subnav">
          <div className="col">
            <Link href={back.href} className="nav-back">
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                <path d="M5 1L1 5l4 4M1 5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {back.label}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
