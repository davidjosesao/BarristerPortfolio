import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'
import {
  calculateInvoiceTotals, formatMoney, describeQuantity,
  FEE_TYPE_LABELS, type FeeLine,
} from './invoice-totals'
import {
  CHAMBERS, COSTS_DISCLOSURE, PAYMENT_TERMS, INVOICE_TITLE, GST_LABEL,
} from './invoice-notice'
import { formatChambersDate, formatHearingDate } from './chambers-time'

export type InvoiceBrief = {
  id: string
  parties: string
  court: string | null
  jurisdiction: string | null
  matter_type: string | null
  hearing_date: string | null
  your_name: string
  firm_name: string | null
  your_email: string | null
  invoice_number: string
  invoiced_at: string
}

// Only the 14 built-in PDF fonts are used. Registering a webfont would need a
// network fetch at render time, which is exactly what a serverless invoice
// route should not depend on.
const styles = StyleSheet.create({
  page: {
    paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48,
    fontFamily: 'Times-Roman', fontSize: 10, color: '#1a1a1a', lineHeight: 1.5,
  },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  barristerName: { fontFamily: 'Times-Bold', fontSize: 16 },
  barristerTitle: { fontSize: 9, color: '#555', marginTop: 2 },
  chambersLine: { fontSize: 9, color: '#555' },

  invoiceTitle: { fontFamily: 'Times-Bold', fontSize: 13, textAlign: 'right' },
  invoiceMetaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  invoiceMetaLabel: { fontSize: 9, color: '#555' },
  invoiceMetaValue: { fontSize: 9, marginLeft: 6 },

  rule: { borderBottomWidth: 1, borderBottomColor: '#c9c4bc', marginBottom: 18 },

  sectionLabel: {
    fontFamily: 'Helvetica-Bold', fontSize: 7, letterSpacing: 1,
    color: '#666', marginBottom: 5, textTransform: 'uppercase',
  },
  twoCol: { flexDirection: 'row', gap: 40, marginBottom: 26 },
  col: { flex: 1 },

  tableHead: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
    paddingBottom: 5, marginBottom: 2,
  },
  tableHeadCell: { fontFamily: 'Helvetica-Bold', fontSize: 7, letterSpacing: 0.8, color: '#333' },
  row: {
    flexDirection: 'row', paddingVertical: 7,
    borderBottomWidth: 0.5, borderBottomColor: '#ddd',
  },
  cellDesc: { flex: 1, paddingRight: 10 },
  cellQty: { width: 70 },
  cellUnit: { width: 80, textAlign: 'right' },
  cellAmount: { width: 80, textAlign: 'right' },
  lineDesc: { fontSize: 9.5 },
  lineSub: { fontSize: 8, color: '#666', marginTop: 1 },

  totals: { marginTop: 14, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', width: 230, justifyContent: 'space-between', paddingVertical: 3 },
  totalRowFinal: {
    flexDirection: 'row', width: 230, justifyContent: 'space-between',
    paddingTop: 7, marginTop: 4, borderTopWidth: 1, borderTopColor: '#1a1a1a',
  },
  totalLabel: { fontSize: 9.5, color: '#444' },
  totalValue: { fontSize: 9.5 },
  totalLabelFinal: { fontFamily: 'Times-Bold', fontSize: 11 },
  totalValueFinal: { fontFamily: 'Times-Bold', fontSize: 11 },

  notice: { marginTop: 34, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: '#c9c4bc' },
  noticeText: { fontSize: 7.5, color: '#555', lineHeight: 1.55 },
  terms: { fontSize: 8.5, marginTop: 12 },

  pageNumber: {
    position: 'absolute', bottom: 28, left: 48, right: 48,
    textAlign: 'center', fontSize: 7.5, color: '#888',
  },
})

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.invoiceMetaRow}>
      <Text style={styles.invoiceMetaLabel}>{label}</Text>
      <Text style={styles.invoiceMetaValue}>{value}</Text>
    </View>
  )
}

export function InvoiceDocument({
  brief,
  fees,
}: {
  brief: InvoiceBrief
  fees: FeeLine[]
}) {
  const totals = calculateInvoiceTotals(fees)

  return (
    <Document
      title={`${brief.invoice_number} — ${brief.parties}`}
      author={CHAMBERS.name}
      subject={INVOICE_TITLE}
    >
      <Page size="A4" style={styles.page}>

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.barristerName}>{CHAMBERS.name}</Text>
            <Text style={styles.barristerTitle}>{CHAMBERS.title}</Text>
            {CHAMBERS.chambers ? <Text style={styles.chambersLine}>{CHAMBERS.chambers}</Text> : null}
            {CHAMBERS.address ? <Text style={styles.chambersLine}>{CHAMBERS.address}</Text> : null}
            {CHAMBERS.abn ? <Text style={styles.chambersLine}>ABN {CHAMBERS.abn}</Text> : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>{INVOICE_TITLE}</Text>
            <MetaRow label="Invoice no." value={brief.invoice_number} />
            <MetaRow label="Date" value={formatChambersDate(brief.invoiced_at)} />
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Billed to</Text>
            <Text>{brief.your_name}</Text>
            {brief.firm_name ? <Text>{brief.firm_name}</Text> : null}
            {brief.your_email ? <Text style={styles.lineSub}>{brief.your_email}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>Matter</Text>
            <Text>{brief.parties}</Text>
            {brief.court ? <Text style={styles.lineSub}>{brief.court}</Text> : null}
            {brief.matter_type ? <Text style={styles.lineSub}>{brief.matter_type}</Text> : null}
            {brief.hearing_date ? (
              <Text style={styles.lineSub}>Hearing {formatHearingDate(brief.hearing_date)}</Text>
            ) : null}
          </View>
        </View>

        {/* Fee lines */}
        <View style={styles.tableHead}>
          <Text style={[styles.tableHeadCell, styles.cellDesc]}>Description</Text>
          <Text style={[styles.tableHeadCell, styles.cellQty]}>Quantity</Text>
          <Text style={[styles.tableHeadCell, styles.cellUnit]}>Rate</Text>
          <Text style={[styles.tableHeadCell, styles.cellAmount]}>Amount</Text>
        </View>

        {fees.map((fee, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <View style={styles.cellDesc}>
              <Text style={styles.lineDesc}>
                {FEE_TYPE_LABELS[fee.fee_type] ?? fee.fee_type}
              </Text>
              {fee.description ? <Text style={styles.lineSub}>{fee.description}</Text> : null}
              {!fee.gst_applicable ? <Text style={styles.lineSub}>GST-free</Text> : null}
            </View>
            <Text style={[styles.lineDesc, styles.cellQty]}>{describeQuantity(fee)}</Text>
            <Text style={[styles.lineDesc, styles.cellUnit]}>
              {formatMoney(Number(fee.unit_amount) || 0)}
            </Text>
            <Text style={[styles.lineDesc, styles.cellAmount]}>
              {formatMoney(Number(fee.amount_ex_gst) || 0)}
            </Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal (excl. GST)</Text>
            <Text style={styles.totalValue}>{formatMoney(totals.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{GST_LABEL}</Text>
            <Text style={styles.totalValue}>{formatMoney(totals.gst)}</Text>
          </View>
          <View style={styles.totalRowFinal}>
            <Text style={styles.totalLabelFinal}>Total due</Text>
            <Text style={styles.totalValueFinal}>{formatMoney(totals.total)}</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.terms}>{PAYMENT_TERMS}</Text>
          <Text style={[styles.noticeText, { marginTop: 10 }]}>{COSTS_DISCLOSURE}</Text>
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}

/** Renders the invoice to a PDF buffer for download or email attachment. */
export async function renderInvoicePdf(
  brief: InvoiceBrief,
  fees: FeeLine[]
): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument brief={brief} fees={fees} />)
}
