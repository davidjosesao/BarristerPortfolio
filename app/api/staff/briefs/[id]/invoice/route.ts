import { NextResponse } from 'next/server'
import { requireStaff } from '../../../../../../lib/staff-auth'
import { renderInvoicePdf, type InvoiceBrief } from '../../../../../../lib/invoice-pdf'
import type { FeeLine } from '../../../../../../lib/invoice-totals'

// @react-pdf/renderer needs Node APIs; it cannot run on the edge runtime.
export const runtime = 'nodejs'

const FEE_COLUMNS =
  'fee_type, description, quantity, unit_amount, gst_applicable, amount_ex_gst, gst_amount'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const auth = await requireStaff()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: brief, error: briefError } = await auth.supabase
    .from('briefs')
    .select('id, parties, court, jurisdiction, matter_type, hearing_date, your_name, firm_name, your_email, invoice_number, invoiced_at')
    .eq('id', id)
    .maybeSingle()

  if (briefError) {
    return NextResponse.json({ error: briefError.message }, { status: 500 })
  }
  if (!brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  const { data: feesData, error: feesError } = await auth.supabase
    .from('fees')
    .select(FEE_COLUMNS)
    .eq('brief_id', id)
    .order('created_at', { ascending: true })

  if (feesError) {
    return NextResponse.json({ error: feesError.message }, { status: 500 })
  }

  const fees = (feesData ?? []) as FeeLine[]

  // An invoice with no lines is not a document anyone wants to send, and
  // producing one would burn an invoice number on an empty memorandum.
  if (fees.length === 0) {
    return NextResponse.json(
      { error: 'Add at least one fee before generating an invoice.' },
      { status: 400 }
    )
  }

  // Atomic and idempotent — see allocate_invoice_number in supabase/schema.sql.
  // Re-downloading an invoice returns the number already assigned rather than
  // allocating a new one.
  const { data: invoiceNumber, error: numberError } = await auth.supabase
    .rpc('allocate_invoice_number', { p_brief_id: id })

  if (numberError || !invoiceNumber) {
    return NextResponse.json(
      { error: numberError?.message ?? 'Could not allocate an invoice number' },
      { status: 500 }
    )
  }

  // Re-read rather than trusting the pre-allocation snapshot: on the first
  // invoice `brief.invoiced_at` was still null when it was selected above.
  const { data: invoiced } = await auth.supabase
    .from('briefs')
    .select('invoiced_at')
    .eq('id', id)
    .maybeSingle()

  const invoiceBrief: InvoiceBrief = {
    ...brief,
    invoice_number: invoiceNumber as string,
    invoiced_at: invoiced?.invoiced_at ?? new Date().toISOString(),
  }

  let pdf: Buffer
  try {
    pdf = await renderInvoicePdf(invoiceBrief, fees)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not render the invoice' },
      { status: 500 }
    )
  }

  const filename = `${invoiceNumber}.pdf`

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.length),
      // The number is echoed so the client can update its UI without parsing
      // the Content-Disposition header.
      'X-Invoice-Number': invoiceNumber as string,
      'Cache-Control': 'no-store',
    },
  })
}
