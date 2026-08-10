import { NextResponse } from 'next/server'
import { requireStaff } from '../../../../../../lib/staff-auth'

const ALLOWED_FEE_TYPES = new Set([
  'brief_fee', 'daily_rate', 'hourly_rate', 'fixed_fee', 'disbursement',
])

const MAX_DESCRIPTION_LENGTH = 500

// Ceilings exist to catch a slipped decimal point before it reaches an invoice,
// not because chambers could never bill this much.
const MAX_UNIT_AMOUNT = 1_000_000
const MAX_QUANTITY = 10_000

/** Rejects NaN/Infinity, which JSON.parse happily produces from bad input. */
function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

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
    .from('fees')
    .select('id, fee_type, description, quantity, unit_amount, gst_applicable, gst_rate, amount_ex_gst, gst_amount, created_at')
    .eq('brief_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fees: data })
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

  if (typeof body.fee_type !== 'string' || !ALLOWED_FEE_TYPES.has(body.fee_type)) {
    return NextResponse.json(
      { error: `fee_type must be one of: ${[...ALLOWED_FEE_TYPES].join(', ')}` },
      { status: 400 }
    )
  }

  const quantity = finiteNumber(body.quantity ?? 1)
  if (quantity === null || quantity <= 0 || quantity > MAX_QUANTITY) {
    return NextResponse.json(
      { error: `quantity must be a number greater than 0 and at most ${MAX_QUANTITY}` },
      { status: 400 }
    )
  }

  const unitAmount = finiteNumber(body.unit_amount)
  if (unitAmount === null || unitAmount < 0 || unitAmount > MAX_UNIT_AMOUNT) {
    return NextResponse.json(
      { error: `unit_amount must be a number between 0 and ${MAX_UNIT_AMOUNT}` },
      { status: 400 }
    )
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      return NextResponse.json({ error: 'description must be a string' }, { status: 400 })
    }
    if (body.description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `description must not exceed ${MAX_DESCRIPTION_LENGTH} characters` },
        { status: 400 }
      )
    }
  }

  if (body.gst_applicable !== undefined && typeof body.gst_applicable !== 'boolean') {
    return NextResponse.json({ error: 'gst_applicable must be a boolean' }, { status: 400 })
  }

  // The brief must exist and be visible to this user. Without this check a bad
  // brief id fails as an opaque foreign-key 500 instead of an honest 404.
  const { data: brief } = await auth.supabase
    .from('briefs')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  // gst_rate is deliberately not taken from the request — the rate is a
  // property of the tax system, not something a client gets to choose. The
  // column default supplies it.
  const { data, error } = await auth.supabase
    .from('fees')
    .insert({
      brief_id: id,
      fee_type: body.fee_type,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      // Rounded here so the stored value matches what the user typed rather
      // than whatever numeric(_,2) would have silently truncated it to.
      quantity: Math.round(quantity * 100) / 100,
      unit_amount: Math.round(unitAmount * 100) / 100,
      gst_applicable: body.gst_applicable ?? true,
    })
    .select('id, fee_type, description, quantity, unit_amount, gst_applicable, gst_rate, amount_ex_gst, gst_amount, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fee: data }, { status: 201 })
}
