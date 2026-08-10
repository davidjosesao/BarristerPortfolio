import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. **Bypasses Row Level Security entirely.**
 *
 * Never import this from a Client Component or anything that ships to the
 * browser — `SUPABASE_SERVICE_ROLE_KEY` is unprefixed precisely so it stays on
 * the server, and leaking it hands over the whole database.
 *
 * It exists for the two places with no logged-in user to authenticate as:
 * the public share page and the calendar feed. Both are reached by an
 * unguessable token, and because RLS is not filtering anything for them, each
 * caller is responsible for scoping its own query and checking the token is
 * still valid.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    // Fail loudly rather than constructing a client that silently 401s later.
    throw new Error(
      'Supabase service credentials are not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
