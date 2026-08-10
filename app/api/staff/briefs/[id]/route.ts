import { NextResponse } from 'next/server'
import { requireStaff } from '../../../../../lib/staff-auth'

const ALLOWED_STATUSES = new Set(['new', 'reviewed', 'accepted', 'declined'])
const MAX_NOTES_LENGTH = 4000

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const auth = await requireStaff()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    const parsed = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid body')
    }
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const update: Record<string, string> = {}

  if (typeof body.status === 'string') {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}` },
        { status: 400 }
      )
    }
    update.status = body.status
  }

  if (typeof body.staff_notes === 'string') {
    if (body.staff_notes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json(
        { error: `staff_notes must not exceed ${MAX_NOTES_LENGTH} characters` },
        { status: 400 }
      )
    }
    update.staff_notes = body.staff_notes
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await auth.supabase
    .from('briefs')
    .update(update)
    .eq('id', id)
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
