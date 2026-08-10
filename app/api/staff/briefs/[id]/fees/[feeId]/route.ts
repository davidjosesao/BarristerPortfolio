import { NextResponse } from 'next/server'
import { requireStaff } from '../../../../../../../lib/staff-auth'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  const { id, feeId } = await params

  const auth = await requireStaff()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Postgres raises a type error (22P02) on a malformed uuid, which would
  // surface as a 500. A shape check keeps that a plain 400.
  if (!UUID_RE.test(feeId)) {
    return NextResponse.json({ error: 'Invalid fee id' }, { status: 400 })
  }

  // Matching on brief_id as well as id means a fee cannot be deleted through
  // another brief's URL, even though both are staff-only today.
  const { data, error } = await auth.supabase
    .from('fees')
    .delete()
    .eq('id', feeId)
    .eq('brief_id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Fee not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
