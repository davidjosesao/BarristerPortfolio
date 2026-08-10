import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireStaff } from '../../../../../lib/staff-auth'
import { createServiceClient } from '../../../../../lib/supabase/service'

// node:crypto is unavailable on the edge runtime.
export const runtime = 'nodejs'

export async function POST() {
  // requireStaff() is the sole gate on *who* may call this: it proves the
  // caller is signed in and on the staff allowlist. Its RLS-scoped client
  // can only SELECT the staff table (see supabase/schema.sql — there is no
  // UPDATE policy on `staff`, deliberately, so an ordinary session can never
  // write it), so the write below goes through the service role, tightly
  // scoped to the row `.eq('email', auth.email)` already picked out.
  const auth = await requireStaff()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // CSPRNG, not Math.random() — this token is a bearer credential for a
  // barrister's diary and needs to be unguessable.
  const token = randomBytes(32).toString('base64url')

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('staff')
    .update({ calendar_token: token })
    .eq('email', auth.email)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ token })
}
