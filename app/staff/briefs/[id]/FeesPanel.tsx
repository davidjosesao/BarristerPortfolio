'use client'

import { useState } from 'react'

export type Fee = {
  id: string
  fee_type: string
  description: string | null
  quantity: number | string
  unit_amount: number | string
  gst_applicable: boolean
  gst_rate: number | string
  amount_ex_gst: number | string
  gst_amount: number | string
}

const FEE_TYPES: { value: string; label: string; unit: string | null }[] = [
  { value: 'brief_fee',    label: 'Brief fee',            unit: null },
  { value: 'daily_rate',   label: 'Refresher (per day)',  unit: 'days' },
  { value: 'hourly_rate',  label: 'Hourly rate',          unit: 'hours' },
  { value: 'fixed_fee',    label: 'Fixed fee',            unit: null },
  { value: 'disbursement', label: 'Disbursement',         unit: null },
]

const FEE_TYPE_LABELS: Record<string, string> =
  Object.fromEntries(FEE_TYPES.map(t => [t.value, t.label]))

const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

/**
 * PostgREST may serialise `numeric` as a string to preserve precision, so no
 * arithmetic here may assume the JSON type. Coercing once at the boundary keeps
 * `'1200.00' + '300.00'` from quietly becoming string concatenation in a total.
 */
function num(value: number | string): number {
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 500, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px',
}

export default function FeesPanel({
  briefId,
  initialFees,
}: {
  briefId: string
  initialFees: Fee[]
}) {
  const [fees, setFees] = useState<Fee[]>(initialFees)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [feeType, setFeeType] = useState('brief_fee')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitAmount, setUnitAmount] = useState('')
  const [gstApplicable, setGstApplicable] = useState(true)

  const selectedType = FEE_TYPES.find(t => t.value === feeType)

  const subtotal = fees.reduce((sum, f) => sum + num(f.amount_ex_gst), 0)
  const gstTotal = fees.reduce((sum, f) => sum + num(f.gst_amount), 0)

  function resetForm() {
    setFeeType('brief_fee')
    setDescription('')
    setQuantity('1')
    setUnitAmount('')
    setGstApplicable(true)
  }

  async function addFee() {
    const q = parseFloat(quantity)
    const amount = parseFloat(unitAmount)

    // Caught here so a typo gives an inline message rather than a round-trip
    // and a generic failure; the API validates these again regardless.
    if (!Number.isFinite(q) || q <= 0) {
      setError('Quantity must be greater than 0.')
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Amount must be a number.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/staff/briefs/${briefId}/fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fee_type: feeType,
          description: description.trim() || null,
          quantity: q,
          unit_amount: amount,
          gst_applicable: gstApplicable,
        }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) throw new Error(payload?.error ?? 'Could not add fee')

      setFees(current => [...current, payload.fee])
      resetForm()
      setAdding(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add fee')
    } finally {
      setBusy(false)
    }
  }

  async function removeFee(feeId: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/staff/briefs/${briefId}/fees/${feeId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Could not remove fee')
      setFees(current => current.filter(f => f.id !== feeId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove fee')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {fees.length === 0 && !adding && (
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>
          No fees recorded against this brief yet.
        </p>
      )}

      {fees.length > 0 && (
        <div style={{ border: '1px solid var(--rule)', borderRadius: '4px', marginBottom: '20px' }}>
          {fees.map((fee, i) => {
            const q = num(fee.quantity)
            const unit = FEE_TYPES.find(t => t.value === fee.fee_type)?.unit
            return (
              <div
                key={fee.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 110px 28px',
                  gap: '16px',
                  alignItems: 'center',
                  padding: '14px 18px',
                  borderBottom: i === fees.length - 1 ? 'none' : '1px solid var(--rule)',
                }}
              >
                <div>
                  <span style={{ fontSize: '14px', color: 'var(--cream)', display: 'block' }}>
                    {FEE_TYPE_LABELS[fee.fee_type] ?? fee.fee_type}
                  </span>
                  {fee.description && (
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{fee.description}</span>
                  )}
                </div>
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {unit ? `${q} ${unit} ×` : ''} {money.format(num(fee.unit_amount))}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--cream)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {money.format(num(fee.amount_ex_gst))}
                  {!fee.gst_applicable && (
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--dim)' }}>no GST</span>
                  )}
                </span>
                <button
                  onClick={() => removeFee(fee.id)}
                  disabled={busy}
                  aria-label="Remove fee"
                  style={{
                    background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer',
                    color: 'var(--dim)', fontSize: '16px', lineHeight: 1, padding: '4px',
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}

          {/* Totals */}
          <div style={{ borderTop: '1px solid var(--rule)', padding: '14px 18px', background: 'rgba(255,255,255,0.02)' }}>
            {[
              ['Subtotal (ex GST)', subtotal],
              ['GST', gstTotal],
            ].map(([label, value]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{label as string}</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {money.format(value as number)}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--rule)' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--cream)' }}>Total (inc GST)</span>
              <span style={{ fontSize: '15px', color: 'var(--cream)', fontVariantNumeric: 'tabular-nums' }}>
                {money.format(subtotal + gstTotal)}
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: '13px', color: '#D97C7C', marginBottom: '12px' }}>{error}</p>
      )}

      {!adding && (
        <button
          onClick={() => { setAdding(true); setError('') }}
          style={{
            background: 'none', border: '1px solid var(--rule)', borderRadius: '3px',
            color: 'var(--muted)', fontSize: '12px', letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: '9px 16px', cursor: 'pointer',
          }}
        >
          + Add fee
        </button>
      )}

      {adding && (
        <div style={{ border: '1px solid var(--rule)', borderRadius: '4px', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <span style={LABEL_STYLE}>Fee type</span>
              <div className="field" style={{ margin: 0 }}>
                <select value={feeType} onChange={e => setFeeType(e.target.value)}>
                  {FEE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <span style={LABEL_STYLE}>
                {selectedType?.unit ? `Quantity (${selectedType.unit})` : 'Quantity'}
              </span>
              <div className="field" style={{ margin: 0 }}>
                <input
                  type="number" min="0" step="0.25" inputMode="decimal"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <span style={LABEL_STYLE}>Description</span>
            <div className="field" style={{ margin: 0 }}>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Directions hearing, 14 August"
              />
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <span style={LABEL_STYLE}>Amount (ex GST)</span>
            <div className="field" style={{ margin: 0, maxWidth: '200px' }}>
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={unitAmount}
                onChange={e => setUnitAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '20px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={gstApplicable}
              onChange={e => setGstApplicable(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
              GST applies (uncheck for court filing fees and other GST-free outlays)
            </span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn-submit"
              onClick={addFee}
              disabled={busy}
              style={{ padding: '10px 24px', fontSize: '13px' }}
            >
              {busy ? 'Adding…' : 'Add fee'}
            </button>
            <button
              onClick={() => { setAdding(false); resetForm(); setError('') }}
              disabled={busy}
              style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: '13px', cursor: 'pointer', padding: '10px 4px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
