import { renderInvoicePdf, type InvoiceBrief } from './invoice-pdf'
import type { FeeLine } from './invoice-totals'

// Rendering a real PDF is slower than a unit test; the layout work happens once.
jest.setTimeout(30000)

const brief: InvoiceBrief = {
  id: '11111111-2222-3333-4444-555555555555',
  parties: 'Smith v Jones',
  court: 'Supreme Court of NSW',
  jurisdiction: 'NSW',
  matter_type: 'Commercial',
  hearing_date: '2026-09-14',
  your_name: 'Jane Solicitor',
  firm_name: 'Solicitor & Co',
  your_email: 'jane@example.com',
  invoice_number: 'INV-00001',
  invoiced_at: '2026-08-10T23:30:00Z',
}

const fees: FeeLine[] = [
  {
    fee_type: 'brief_fee', description: 'Brief to appear', quantity: 1,
    unit_amount: 5000, gst_applicable: true, amount_ex_gst: 5000, gst_amount: 500,
  },
  {
    fee_type: 'daily_rate', description: 'Refresher, days 2-3', quantity: 2,
    unit_amount: 3000, gst_applicable: true, amount_ex_gst: 6000, gst_amount: 600,
  },
  {
    fee_type: 'disbursement', description: 'Court filing fee', quantity: 1,
    unit_amount: 145, gst_applicable: false, amount_ex_gst: 145, gst_amount: 0,
  },
]

describe('renderInvoicePdf', () => {
  it('produces a valid, non-trivial PDF file', async () => {
    const pdf = await renderInvoicePdf(brief, fees)

    expect(Buffer.isBuffer(pdf)).toBe(true)
    // Every PDF begins with the %PDF- magic bytes and ends with %%EOF.
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(pdf.subarray(-1024).toString('latin1')).toContain('%%EOF')
    // A page of real content, not an empty document.
    expect(pdf.length).toBeGreaterThan(2000)
  })

  it('renders with no fee lines without throwing', async () => {
    // The route refuses to invoice an empty brief, but the renderer itself
    // must not be the thing that blows up if it is ever called that way.
    const pdf = await renderInvoicePdf(brief, [])
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('renders when every optional matter field is missing', async () => {
    const sparse: InvoiceBrief = {
      ...brief,
      court: null, jurisdiction: null, matter_type: null,
      hearing_date: null, firm_name: null, your_email: null,
    }
    const pdf = await renderInvoicePdf(sparse, fees)
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(2000)
  })

  it('renders string-encoded numerics from PostgREST', async () => {
    const stringFees: FeeLine[] = [{
      fee_type: 'hourly_rate', description: 'Advice in conference', quantity: '1.5',
      unit_amount: '440.00', gst_applicable: true,
      amount_ex_gst: '660.00', gst_amount: '66.00',
    }]
    const pdf = await renderInvoicePdf(brief, stringFees)
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  it('paginates a long invoice rather than truncating it', async () => {
    const many: FeeLine[] = Array.from({ length: 60 }, (_, i) => ({
      fee_type: 'hourly_rate', description: `Attendance ${i + 1}`, quantity: 1,
      unit_amount: 440, gst_applicable: true, amount_ex_gst: 440, gst_amount: 44,
    }))
    const pdf = await renderInvoicePdf(brief, many)
    const text = pdf.toString('latin1')
    // More than one /Type /Page object means the content flowed onto a second page.
    const pageCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length
    expect(pageCount).toBeGreaterThan(1)
  })
})
