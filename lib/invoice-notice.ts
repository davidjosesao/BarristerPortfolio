/**
 * Boilerplate printed on every invoice.
 *
 * ⚠️  REVIEW BEFORE USING FOR REAL BILLING.
 *
 * The wording below is a PLACEHOLDER written to sit in the right place on the
 * page. It is not verified statutory text and has not been settled by a
 * costs lawyer. Australian legal costs disclosure is governed by the Legal
 * Profession Uniform Law (NSW), and the obligations differ with the amount
 * billed and whether disclosure has already been given.
 *
 * Replace `COSTS_DISCLOSURE` and `PAYMENT_TERMS` with the wording the
 * barrister actually uses — it is deliberately isolated in this one module so
 * that is a single edit, with no need to touch the PDF layout.
 */

export const CHAMBERS = {
  name: 'Michael Klooster',
  title: 'Barrister-at-Law',
  chambers: '',
  address: '',
  abn: '',
  email: '',
  phone: '',
} as const

/** Australian GST, shown on the invoice so the rate on the page is explicit. */
export const GST_LABEL = 'GST (10%)'

export const COSTS_DISCLOSURE = `Costs disclosure — PLACEHOLDER, TO BE SETTLED BY THE BARRISTER

This memorandum of fees is rendered in accordance with the costs agreement and
costs disclosure provided to the instructing solicitor. You may request an
itemised bill within 30 days of receiving this memorandum. You have the right
to seek a costs assessment, to discuss these costs with the barrister, and to
seek independent legal advice about them.`

export const PAYMENT_TERMS = `Payment is due within 30 days of the date of this memorandum.`

/**
 * A tax invoice must be identifiable as one. Kept here so the heading and the
 * disclosure that justifies it stay together.
 */
export const INVOICE_TITLE = 'Tax Invoice — Memorandum of Fees'
