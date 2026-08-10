/**
 * Invoice arithmetic, deliberately separate from the PDF layout so it can be
 * tested without rendering anything.
 *
 * Postgres already computed each line's `amount_ex_gst` and `gst_amount` (see
 * the generated columns in supabase/schema.sql). This module only *sums* them
 * — it must never recompute a line, or the invoice could disagree with the
 * database about what was billed.
 */

export type FeeLine = {
  fee_type: string
  description: string | null
  quantity: number | string
  unit_amount: number | string
  gst_applicable: boolean
  amount_ex_gst: number | string
  gst_amount: number | string
}

export type InvoiceTotals = {
  subtotal: number
  gst: number
  total: number
}

export const FEE_TYPE_LABELS: Record<string, string> = {
  brief_fee:    'Brief fee',
  daily_rate:   'Refresher',
  hourly_rate:  'Hourly rate',
  fixed_fee:    'Fixed fee',
  disbursement: 'Disbursement',
}

/** Units shown against a quantity; null means the quantity is just a count. */
export const FEE_TYPE_UNITS: Record<string, string | null> = {
  brief_fee:    null,
  daily_rate:   'days',
  hourly_rate:  'hours',
  fixed_fee:    null,
  disbursement: null,
}

/**
 * Money as an integer number of cents.
 *
 * PostgREST may serialise `numeric` as a string to preserve precision, so the
 * JSON type cannot be assumed. Converting to cents up front also keeps the
 * summation exact: adding 0.1 + 0.2 in floating point gives 0.30000000000000004,
 * and across enough lines that drift reaches the printed total.
 */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/** Cents back to dollars for display. */
export function fromCents(cents: number): number {
  return cents / 100
}

export function calculateInvoiceTotals(lines: FeeLine[]): InvoiceTotals {
  let subtotalCents = 0
  let gstCents = 0

  for (const line of lines) {
    subtotalCents += toCents(line.amount_ex_gst)
    gstCents += toCents(line.gst_amount)
  }

  return {
    subtotal: fromCents(subtotalCents),
    gst: fromCents(gstCents),
    total: fromCents(subtotalCents + gstCents),
  }
}

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export function formatMoney(value: number): string {
  return AUD.format(value)
}

/** The quantity column as it reads on the page: "1.5 days", "3 hours", or "". */
export function describeQuantity(line: FeeLine): string {
  const unit = FEE_TYPE_UNITS[line.fee_type]
  if (!unit) return ''
  const qty = typeof line.quantity === 'number' ? line.quantity : parseFloat(line.quantity)
  if (!Number.isFinite(qty)) return ''
  // Trim a trailing .00 so whole days read "2 days", not "2.00 days".
  const pretty = Number.isInteger(qty) ? String(qty) : String(qty)
  return `${pretty} ${unit}`
}
