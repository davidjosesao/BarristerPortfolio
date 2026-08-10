import {
  calculateInvoiceTotals,
  toCents,
  fromCents,
  formatMoney,
  describeQuantity,
  type FeeLine,
} from './invoice-totals'

/** Builds a line the way PostgREST would return it, with sane defaults. */
function line(over: Partial<FeeLine> = {}): FeeLine {
  return {
    fee_type: 'brief_fee',
    description: null,
    quantity: 1,
    unit_amount: 0,
    gst_applicable: true,
    amount_ex_gst: 0,
    gst_amount: 0,
    ...over,
  }
}

describe('toCents', () => {
  it('converts dollars to integer cents', () => {
    expect(toCents(12.34)).toBe(1234)
    expect(toCents(0)).toBe(0)
    expect(toCents(4500)).toBe(450000)
  })

  it('accepts the string form PostgREST may return for numeric', () => {
    expect(toCents('4500.00')).toBe(450000)
    expect(toCents('0.10')).toBe(10)
  })

  it('rounds half-cent values rather than truncating', () => {
    expect(toCents(0.005)).toBe(1)
    expect(toCents(10.994)).toBe(1099)
    expect(toCents(10.995)).toBe(1100)
  })

  it('treats null, undefined and garbage as zero rather than NaN', () => {
    expect(toCents(null)).toBe(0)
    expect(toCents(undefined)).toBe(0)
    expect(toCents('not a number')).toBe(0)
    expect(toCents(Infinity)).toBe(0)
  })
})

describe('fromCents', () => {
  it('round-trips with toCents', () => {
    for (const v of [0, 0.01, 1.5, 99.99, 4500, 123456.78]) {
      expect(fromCents(toCents(v))).toBeCloseTo(v, 10)
    }
  })
})

describe('calculateInvoiceTotals', () => {
  it('is zero for an empty invoice', () => {
    expect(calculateInvoiceTotals([])).toEqual({ subtotal: 0, gst: 0, total: 0 })
  })

  it('sums a single GST-bearing line', () => {
    const totals = calculateInvoiceTotals([
      line({ amount_ex_gst: 4500, gst_amount: 450 }),
    ])
    expect(totals).toEqual({ subtotal: 4500, gst: 450, total: 4950 })
  })

  it('sums several lines', () => {
    const totals = calculateInvoiceTotals([
      line({ fee_type: 'brief_fee',  amount_ex_gst: 5000, gst_amount: 500 }),
      line({ fee_type: 'daily_rate', amount_ex_gst: 4500, gst_amount: 450 }),
      line({ fee_type: 'hourly_rate', amount_ex_gst: 660, gst_amount: 66 }),
    ])
    expect(totals).toEqual({ subtotal: 10160, gst: 1016, total: 11176 })
  })

  it('excludes GST-free disbursements from the GST total but not the subtotal', () => {
    const totals = calculateInvoiceTotals([
      line({ fee_type: 'brief_fee', amount_ex_gst: 1000, gst_amount: 100 }),
      // A court filing fee: counts toward what is owed, carries no GST.
      line({ fee_type: 'disbursement', gst_applicable: false, amount_ex_gst: 145, gst_amount: 0 }),
    ])
    expect(totals.subtotal).toBe(1145)
    expect(totals.gst).toBe(100)
    expect(totals.total).toBe(1245)
  })

  it('handles string-encoded numerics from PostgREST', () => {
    const totals = calculateInvoiceTotals([
      line({ amount_ex_gst: '4500.00', gst_amount: '450.00' }),
      line({ amount_ex_gst: '145.50', gst_amount: '14.55' }),
    ])
    expect(totals.subtotal).toBe(4645.5)
    expect(totals.gst).toBe(464.55)
    expect(totals.total).toBe(5110.05)
  })

  /**
   * The reason this module sums in cents. Adding these as floats gives
   * 0.30000000000000004, and the error compounds across a long invoice until
   * the printed total is a cent out from the sum of the printed lines — the
   * kind of discrepancy that gets an invoice queried.
   */
  it('does not accumulate floating-point drift across many small lines', () => {
    const lines = Array.from({ length: 300 }, () =>
      line({ amount_ex_gst: 0.1, gst_amount: 0.01 })
    )
    const totals = calculateInvoiceTotals(lines)
    expect(totals.subtotal).toBe(30)
    expect(totals.gst).toBe(3)
    expect(totals.total).toBe(33)
  })

  it('keeps subtotal + gst exactly equal to total', () => {
    const totals = calculateInvoiceTotals([
      line({ amount_ex_gst: '333.33', gst_amount: '33.33' }),
      line({ amount_ex_gst: '666.67', gst_amount: '66.67' }),
    ])
    expect(totals.subtotal + totals.gst).toBeCloseTo(totals.total, 10)
    expect(totals.total).toBe(1100)
  })
})

describe('formatMoney', () => {
  it('formats as Australian dollars with two decimals', () => {
    expect(formatMoney(4950)).toBe('$4,950.00')
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(1234567.5)).toBe('$1,234,567.50')
  })
})

describe('describeQuantity', () => {
  it('labels days and hours', () => {
    expect(describeQuantity(line({ fee_type: 'daily_rate', quantity: 2 }))).toBe('2 days')
    expect(describeQuantity(line({ fee_type: 'hourly_rate', quantity: 3.5 }))).toBe('3.5 hours')
  })

  it('is blank for fee types charged once', () => {
    expect(describeQuantity(line({ fee_type: 'brief_fee', quantity: 1 }))).toBe('')
    expect(describeQuantity(line({ fee_type: 'disbursement', quantity: 1 }))).toBe('')
  })

  it('copes with a string quantity', () => {
    expect(describeQuantity(line({ fee_type: 'daily_rate', quantity: '1.5' }))).toBe('1.5 days')
  })
})
