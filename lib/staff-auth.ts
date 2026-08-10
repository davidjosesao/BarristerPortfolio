import { createClient } from './supabase/server'

type Client = Awaited<ReturnType<typeof createClient>>

export type StaffAuth =
  | { ok: true; supabase: Client; email: string }
  | { ok: false; status: 401 | 403; error: string }

/**
 * The single place that decides who counts as staff.
 *
 * Authenticating proves who you are; it does not prove you are chambers. The
 * `staff` table is the allowlist, and it is consulted through the caller's own
 * RLS-scoped client (the "staff can read own row" policy) — never the service
 * role — so a signed-in stranger reads back nothing and is refused.
 *
 * Returns the same client it authenticated with, so callers issue their
 * subsequent queries under RLS rather than reaching for elevated credentials.
 */
export async function requireStaff(): Promise<StaffAuth> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return { ok: false, status: 401, error: 'Unauthorised' }
  }

  const { data: staffRow } = await supabase
    .from('staff')
    .select('email')
    .eq('email', user.email)
    .maybeSingle()

  if (!staffRow) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  return { ok: true, supabase, email: user.email }
}
