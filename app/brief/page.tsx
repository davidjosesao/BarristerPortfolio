'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import Link from 'next/link'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, { once: true, amount: 0.08 })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

const NSW_COURTS = ['Supreme Court of NSW', 'NSW Court of Appeal', 'District Court of NSW', 'Local Court of NSW', 'NCAT', "Children's Court of NSW", 'Coroners Court of NSW']
const FEDERAL_COURTS = ['High Court of Australia', 'Federal Court of Australia', 'Federal Circuit and Family Court', 'AAT', 'Fair Work Commission']

function deriveJurisdiction(court: string) {
  if (NSW_COURTS.includes(court)) return 'NSW'
  if (FEDERAL_COURTS.includes(court)) return 'Federal'
  return 'Other'
}

interface FormState {
  yourName: string; firmName: string; yourEmail: string; yourPhone: string
  parties: string; court: string; matterType: string; urgency: string
  hearingDate: string; keyFacts: string
}

const EMPTY_FORM: FormState = {
  yourName: '', firmName: '', yourEmail: '', yourPhone: '',
  parties: '', court: '', matterType: '', urgency: '',
  hearingDate: '', keyFacts: '',
}

export default function Brief() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [charCount, setCharCount] = useState(0)
  const todayMin = new Date().toISOString().split('T')[0]

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value
      setForm(f => ({ ...f, [field]: value }))
      if (errors[field]) setErrors(err => ({ ...err, [field]: undefined }))
      if (field === 'keyFacts') setCharCount(value.length)
    }
  }

  function validate(): boolean {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const next: typeof errors = {}
    if (!form.yourName.trim()) next.yourName = 'Please enter your name.'
    if (!form.yourEmail.trim() || !emailRe.test(form.yourEmail)) next.yourEmail = 'Please enter a valid email address.'
    if (!form.parties.trim()) next.parties = 'Please enter the parties.'
    if (!form.court) next.court = 'Please select a court or tribunal.'
    if (!form.matterType) next.matterType = 'Please select a matter type.'
    if (!form.urgency) next.urgency = 'Please select an urgency level.'
    if (!form.keyFacts.trim()) next.keyFacts = 'Please describe the matter.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError('')
    if (!validate()) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/submit-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, jurisdiction: deriveJurisdiction(form.court) }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Server error')
      }
      setSubmitted(true)
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  // Stagger form fields into view
  const formRef = useRef<HTMLFormElement>(null)
  const formInView = useInView(formRef as React.RefObject<Element>, { once: true, amount: 0.05 })

  const fieldVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.5, ease: EASE, delay: i * 0.05 },
    }),
  }

  return (
    <>
      <div className="page-monogram" aria-hidden="true">
        <span className="mono-letter mono-letter-m">M</span>
        <span className="mono-letter mono-letter-k">K</span>
      </div>

      <div className="nav-brief-inner" aria-label="Site navigation">
        <div className="col-narrow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" className="nav-back" aria-label="Back to Michael Klooster">
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
              <path d="M5 1L1 5l4 4M1 5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Michael Klooster
          </Link>
          <span className="nav-name">Submit a Brief</span>
        </div>
      </div>

      <main>
        <div className="brief-header">
          <div className="col-narrow">
            <Reveal>
              <span className="section-label">Brief</span>
              <h1 className="brief-title">Submit a Brief</h1>
              <p className="brief-intro">
                To instruct Michael directly or to enquire about availability, complete the form below.
                You&apos;ll receive a confirmation by email and a member of chambers will be in touch.
              </p>
            </Reveal>
          </div>
        </div>

        <div className="brief-form-wrap">
          <div className="col-narrow">

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  className="form-success"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: EASE }}
                  role="alert"
                  aria-live="polite"
                >
                  <div className="form-success-icon" aria-hidden="true">
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                      <path d="M1 6l4.5 4.5L15 1" stroke="#B4B0A9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h3>Brief received</h3>
                  <p>
                    Thank you — your brief has been received.<br />
                    You&apos;ll get a confirmation at <strong>{form.yourEmail}</strong>.<br />
                    A member of chambers will be in touch shortly.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  ref={formRef}
                  onSubmit={handleSubmit}
                  noValidate
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.3 } }}
                >
                  <div className="form-grid">

                    {/* Contact fields */}
                    <motion.div className="field" custom={0} variants={fieldVariants} initial="hidden" animate={formInView ? 'visible' : 'hidden'}>
                      <label htmlFor="f-yourName">Your name</label>
                      <input id="f-yourName" type="text" name="yourName" autoComplete="name" placeholder="Full name" required
                        value={form.yourName} onChange={set('yourName')} className={errors.yourName ? 'invalid' : ''} />
                      {errors.yourName && <span className="field-error visible">{errors.yourName}</span>}
                    </motion.div>

                    <motion.div className="field" custom={1} variants={fieldVariants} initial="hidden" animate={formInView ? 'visible' : 'hidden'}>
                      <label htmlFor="f-firmName">Firm / organisation <span className="opt-tag">(optional)</span></label>
                      <input id="f-firmName" type="text" name="firmName" autoComplete="organization" placeholder="Firm or company name"
                        value={form.firmName} onChange={set('firmName')} />
                    </motion.div>

                    <motion.div className="field" custom={2} variants={fieldVariants} initial="hidden" animate={formInView ? 'visible' : 'hidden'}>
                      <label htmlFor="f-yourEmail">Your email</label>
                      <input id="f-yourEmail" type="email" name="yourEmail" autoComplete="email" placeholder="you@example.com" required
                        value={form.yourEmail} onChange={set('yourEmail')} className={errors.yourEmail ? 'invalid' : ''} />
                      {errors.yourEmail && <span className="field-error visible">{errors.yourEmail}</span>}
                    </motion.div>

                    <motion.div className="field" custom={3} variants={fieldVariants} initial="hidden" animate={formInView ? 'visible' : 'hidden'}>
                      <label htmlFor="f-yourPhone">Your phone <span className="opt-tag">(optional)</span></label>
                      <input id="f-yourPhone" type="tel" name="yourPhone" autoComplete="tel" placeholder="(02) XXXX XXXX"
                        value={form.yourPhone} onChange={set('yourPhone')} />
                    </motion.div>

                    <motion.div
                      className="form-divider"
                      aria-hidden="true"
                      custom={4}
                      variants={fieldVariants}
                      initial="hidden"
                      animate={formInView ? 'visible' : 'hidden'}
                    />

                    {/* Matter fields */}
                    <motion.div
                      className="field full"
                      custom={5}
                      variants={fieldVariants}
                      initial="hidden"
                      animate={formInView ? 'visible' : 'hidden'}
                    >
                      <label htmlFor="f-parties">Parties to the matter</label>
                      <input id="f-parties" type="text" name="parties" required placeholder="e.g. Smith v Jones"
                        value={form.parties} onChange={set('parties')} className={errors.parties ? 'invalid' : ''} />
                      {errors.parties && <span className="field-error visible">{errors.parties}</span>}
                    </motion.div>

                    <motion.div
                      className="field full"
                      custom={6}
                      variants={fieldVariants}
                      initial="hidden"
                      animate={formInView ? 'visible' : 'hidden'}
                    >
                      <label htmlFor="f-court">Court / tribunal</label>
                      <select id="f-court" name="court" required value={form.court} onChange={set('court')}
                        className={errors.court ? 'invalid' : ''}>
                        <option value="">Select…</option>
                        <optgroup label="NSW">
                          {NSW_COURTS.map(c => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                        <optgroup label="Federal">
                          {FEDERAL_COURTS.map(c => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                        <optgroup label="Other">
                          <option value="Other">Other</option>
                        </optgroup>
                      </select>
                      {errors.court && <span className="field-error visible">{errors.court}</span>}
                    </motion.div>

                    <motion.div className="field" custom={7} variants={fieldVariants} initial="hidden" animate={formInView ? 'visible' : 'hidden'}>
                      <label htmlFor="f-matterType">Matter type</label>
                      <select id="f-matterType" name="matterType" required value={form.matterType} onChange={set('matterType')} className={errors.matterType ? 'invalid' : ''}>
                        <option value="">Select…</option>
                        {['Commercial','Construction','Employment','Administrative','Criminal','Family','Property','Defamation','Intellectual Property','Costs','Other'].map(o =>
                          <option key={o} value={o}>{o}</option>
                        )}
                      </select>
                      {errors.matterType && <span className="field-error visible">{errors.matterType}</span>}
                    </motion.div>

                    <motion.div className="field" custom={8} variants={fieldVariants} initial="hidden" animate={formInView ? 'visible' : 'hidden'}>
                      <label htmlFor="f-urgency">Urgency</label>
                      <select id="f-urgency" name="urgency" required value={form.urgency} onChange={set('urgency')} className={errors.urgency ? 'invalid' : ''}>
                        <option value="">Select…</option>
                        <option value="Standard">Standard</option>
                        <option value="Urgent">Urgent — within 2 weeks</option>
                        <option value="Immediate">Immediate — this week</option>
                      </select>
                      {errors.urgency && <span className="field-error visible">{errors.urgency}</span>}
                    </motion.div>

                    <motion.div
                      className="field"
                      custom={9}
                      variants={fieldVariants}
                      initial="hidden"
                      animate={formInView ? 'visible' : 'hidden'}
                    >
                      <label htmlFor="f-hearing">Hearing date <span className="opt-tag">(if set)</span></label>
                      <input id="f-hearing" type="date" name="hearingDate" min={todayMin}
                        value={form.hearingDate} onChange={set('hearingDate')} />
                    </motion.div>

                    <motion.div
                      className="form-divider"
                      aria-hidden="true"
                      custom={10}
                      variants={fieldVariants}
                      initial="hidden"
                      animate={formInView ? 'visible' : 'hidden'}
                    />

                    <motion.div
                      className="field full"
                      custom={11}
                      variants={fieldVariants}
                      initial="hidden"
                      animate={formInView ? 'visible' : 'hidden'}
                    >
                      <label htmlFor="f-facts">Briefly describe the matter and what you need counsel for</label>
                      <textarea
                        id="f-facts"
                        name="keyFacts"
                        required
                        maxLength={1000}
                        placeholder="Outline the key facts, the issues in dispute, and what you require counsel for…"
                        value={form.keyFacts}
                        onChange={set('keyFacts')}
                        className={errors.keyFacts ? 'invalid' : ''}
                      />
                      <div
                        className={`char-counter${charCount >= 1000 ? ' over' : charCount >= 800 ? ' warn' : ''}`}
                        aria-live="polite"
                      >
                        {charCount} / 1000
                      </div>
                      {errors.keyFacts && <span className="field-error visible">{errors.keyFacts}</span>}
                    </motion.div>

                    {serverError && (
                      <motion.p
                        className="form-error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        role="alert"
                      >
                        {serverError} Please email{' '}
                        <a href="mailto:mklooster@chambers.net.au">mklooster@chambers.net.au</a> directly.
                      </motion.p>
                    )}

                    <motion.div
                      className="form-actions"
                      custom={12}
                      variants={fieldVariants}
                      initial="hidden"
                      animate={formInView ? 'visible' : 'hidden'}
                    >
                      <button type="submit" className="btn-submit" disabled={submitting}>
                        {submitting ? 'Sending…' : 'Submit brief →'}
                      </button>
                      <p className="form-note">All fields required unless marked optional.</p>
                    </motion.div>

                  </div>
                </motion.form>
              )}
            </AnimatePresence>

          </div>
        </div>
      </main>

      <footer className="brief-footer">
        <div className="col-narrow">
          <div className="brief-footer-inner">
            <p>© 2026 Michael Klooster · Barrister</p>
            <Link href="/">michaelklooster.com.au</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
