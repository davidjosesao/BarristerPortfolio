import { NextResponse } from 'next/server'
import { requireStaff } from '../../../../../../lib/staff-auth'
import { generateShareToken, expiryFromDays } from '../../../../../../lib/share-links'

export const runtime = 'nodejs'

const ALLOWED_EXPIRY_DAYS = new Set([7, 30, 90])

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const auth = await requireStaff()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('brief_shares')
    .select('id, token, created_at, created_by, expires_at, revoked_at, last_viewed_at, view_count')
    .eq('brief_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ shares: data })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const auth = await requireStaff()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown> = {}
  try {
    const text = await request.text()
    if (text) {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>
      }
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Expiry is chosen from a fixed set rather than accepted as an arbitrary
  // number, so a caller cannot mint a link expiring in the year 9999.
  let expiresAt: string | null = null
  if (body.expires_in_days !== undefined && body.expires_in_days !== null) {
    const days = body.expires_in_days
    if (typeof days !== 'number' || !ALLOWED_EXPIRY_DAYS.has(days)) {
      return NextResponse.json(
        { error: `expires_in_days must be one of: ${[...ALLOWED_EXPIRY_DAYS].join(', ')}` },
        { status: 400 }
      )
    }
    expiresAt = expiryFromDays(days)
  }

  // Confirm the brief is visible to this user before minting a credential for
  // it — otherwise a bad id would create a dangling share row.
  const { data: brief } = await auth.supabase
    .from('briefs')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  const { data, error } = await auth.supabase
    .from('brief_shares')
    .insert({
      brief_id: id,
      token: generateShareToken(),
      created_by: auth.email,
      expires_at: expiresAt,
    })
    .select('id, token, created_at, expires_at, revoked_at, view_count')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ share: data }, { status: 201 })
}
