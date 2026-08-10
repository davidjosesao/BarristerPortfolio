'use client'

import { useState } from 'react'

const MAX_QUESTION_LENGTH = 500

const CARD: React.CSSProperties = {
  padding: '20px 24px',
  border: '1px solid rgba(232,229,223,0.12)',
  borderRadius: '4px',
  background: 'rgba(232,229,223,0.03)',
}

export default function ChronologyPanel({
  briefId,
  initialChronology,
}: {
  briefId: string
  initialChronology: string | null
}) {
  const [chronology, setChronology] = useState(initialChronology)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState(false)

  async function post(body: object) {
    const res = await fetch(`/api/staff/briefs/${briefId}/chronology`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) throw new Error(payload?.error ?? 'The AI request failed')
    return payload
  }

  async function generate() {
    setGenerating(true)
    setError('')
    try {
      const payload = await post({})
      setChronology(payload.chronology)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AI request failed')
    } finally {
      setGenerating(false)
    }
  }

  async function ask() {
    const q = question.trim()
    if (!q) return
    setAsking(true)
    setError('')
    setAnswer('')
    try {
      const payload = await post({ question: q })
      setAnswer(payload.answer)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AI request failed')
    } finally {
      setAsking(false)
    }
  }

  return (
    <div>
      {/* Chronology */}
      <div style={{ ...CARD, marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', marginBottom: chronology ? '14px' : '0' }}>
          <span style={{
            fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--gold)',
          }}>
            Chronology
          </span>
          <button
            onClick={generate}
            disabled={generating}
            style={{
              background: 'none', border: '1px solid var(--rule)', borderRadius: '3px',
              color: 'var(--muted)', fontSize: '11px', letterSpacing: '0.06em',
              textTransform: 'uppercase', padding: '7px 13px',
              cursor: generating ? 'default' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {generating ? 'Generating…' : chronology ? 'Regenerate' : 'Generate'}
          </button>
        </div>

        {chronology ? (
          <div style={{ fontSize: '14px', color: 'var(--cream)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
            {chronology}
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7, marginTop: '10px' }}>
            Builds a dated timeline from the key facts. Events without a date in
            the brief are listed as undated rather than guessed at.
          </p>
        )}
      </div>

      {/* Ask a question */}
      <div style={CARD}>
        <span style={{
          display: 'block', fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '12px',
        }}>
          Ask about this matter
        </span>

        <div className="field" style={{ margin: 0 }}>
          <input
            type="text"
            value={question}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder="e.g. When was the contract terminated?"
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !asking) ask() }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '12px' }}>
          <button
            className="btn-submit"
            onClick={ask}
            disabled={asking || !question.trim()}
            style={{ padding: '9px 20px', fontSize: '13px' }}
          >
            {asking ? 'Thinking…' : 'Ask'}
          </button>
          <span style={{ fontSize: '11px', color: 'var(--dim)' }}>
            Answers come only from this brief.
          </span>
        </div>

        {answer && (
          <div style={{
            marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--rule)',
            fontSize: '14px', color: 'var(--cream)', lineHeight: 1.8, whiteSpace: 'pre-wrap',
          }}>
            {answer}
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontSize: '13px', color: '#D97C7C', marginTop: '12px' }}>{error}</p>
      )}

      <p style={{ fontSize: '11px', color: 'var(--dim)', lineHeight: 1.7, marginTop: '14px' }}>
        AI-generated from the brief text. Check anything you intend to rely on
        against the brief itself.
      </p>
    </div>
  )
}
