import { NextResponse } from 'next/server'
import { requireStaff } from '../../../../../../../lib/staff-auth'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Revokes a share link.
 *
 * The row is kept and stamped rather than deleted: the barrister should still
 * be able to see that a link existed, who created it and whether it was ever
 * opened, after withdrawing it.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const { id, shareId } = await params

  const auth = await requireStaff()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!UUID_RE.test(shareId)) {
    return NextResponse.json({ error: 'Invalid share id' }, { status: 400 })
  }

  // Matching brief_id too means a link cannot be revoked through another
  // brief's URL. `is('revoked_at', null)` makes a second revoke a no-op rather
  // than moving the timestamp forward.
  const { data, error } = await auth.supabase
    .from('brief_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId)
    .eq('brief_id', id)
    .is('revoked_at', null)
    .select('id, revoked_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    // Either it does not exist or it was already revoked; both leave the
    // caller in the state they asked for.
    return NextResponse.json({ success: true, alreadyRevoked: true })
  }

  return NextResponse.json({ success: true, revoked_at: data.revoked_at })
}
