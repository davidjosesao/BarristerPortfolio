'use client'

import { useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { Intro, useIntro } from './components/Intro'
import { SiteHeader } from './components/SiteHeader'
import {
  CONTACT,
  COURTS,
  EXPERIENCE,
  IDENTITY,
  MATTERS,
  MEMBERSHIPS,
  PRACTICE_AREAS,
} from './content/profile'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

// ── Scroll-reveal wrapper ────────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.1 })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.85, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { introPlaying, introDecided } = useIntro()
  // Hero content waits for the intro to hand off, but never for the decision
  // itself — a returning visitor sees the hero immediately.
  const heroReady = introDecided && !introPlaying

  return (
    <>
      {/* Fixed watermark */}
      <div className="hero-monogram" aria-hidden="true">
        <span className="mono-letter mono-letter-m">M</span>
        <span className="mono-letter mono-letter-k">K</span>
      </div>

      <SiteHeader showBrand={!introPlaying} />

      <main>
        {/* ── Hero ── */}
        <section id="hero" aria-label="Introduction">
          <div className="col">
            <div className="hero-inner">
              <div>
                <motion.p
                  className="hero-kicker"
                  initial={{ opacity: 0, y: 14 }}
                  animate={heroReady ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 1.05, ease: EASE, delay: 0.06 }}
                >
                  New South Wales Bar · Sydney
                </motion.p>

                <motion.h1
                  className="hero-name"
                  initial={{ opacity: 0, y: 14 }}
                  animate={heroReady ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 1.05, ease: EASE, delay: 0.20 }}
                >
                  Michael Klooster
                </motion.h1>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={heroReady ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 1.05, ease: EASE, delay: 0.33 }}
                >
                  <p className="hero-title">Barrister</p>
                  <p className="hero-chambers">
                    <a href={IDENTITY.chambersUrl} target="_blank" rel="noopener noreferrer">
                      {IDENTITY.chambers}
                    </a>
                  </p>
                </motion.div>

                <motion.div
                  className="hero-foot"
                  initial={{ opacity: 0, y: 14 }}
                  animate={heroReady ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 1.05, ease: EASE, delay: 0.48 }}
                >
                  <Link href="/brief" className="btn-outline">
                    Submit a brief <span className="btn-arrow" aria-hidden="true">→</span>
                  </Link>
                  <div className="contact-block">
                    <div className="contact-row">
                      <span className="contact-lbl">Direct</span>
                      <a href={`tel:${CONTACT.direct.tel}`}>{CONTACT.direct.display}</a>
                      <span className="contact-dot" aria-hidden="true">·</span>
                      <a href={`mailto:${CONTACT.direct.email}`}>{CONTACT.direct.email}</a>
                    </div>
                    <div className="contact-row">
                      <span className="contact-lbl">Clerk</span>
                      <a href={`tel:${CONTACT.clerk.tel}`}>{CONTACT.clerk.display}</a>
                      <span className="contact-dot" aria-hidden="true">·</span>
                      <a href={`mailto:${CONTACT.clerk.email}`}>{CONTACT.clerk.email}</a>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Photo — clip-path reveal */}
              <motion.div
                className="hero-photo"
                initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
                animate={heroReady ? { opacity: 1, clipPath: 'inset(0 0 0% 0)' } : {}}
                transition={{ duration: 1.2, ease: EASE, delay: 0.28 }}
              >
                <Image
                  src="/uploads/photo-1780994244649.png"
                  alt="Michael Klooster"
                  fill
                  priority
                  sizes="(max-width: 640px) 148px, 232px"
                  style={{ objectFit: 'cover', objectPosition: 'center top' }}
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Profile ── */}
        <section id="profile" aria-labelledby="profile-heading">
          <div className="col">
            <div className="row">
              <Reveal>
                <h2 className="row-label" id="profile-heading">Profile</h2>
              </Reveal>
              <Reveal delay={0.13}>
                <div className="profile-links">
                  <a
                    href={`mailto:${CONTACT.clerk.email}?subject=${encodeURIComponent(`CV request — ${IDENTITY.name}`)}`}
                    className="profile-link-row"
                  >
                    <div>
                      <div className="profile-link-label">Curriculum Vitae</div>
                      {/* No PDF held yet — the clerk sends it on request. Swap this
                          row for a direct link once one exists. */}
                      <div className="profile-link-sub">Available on request from the clerk</div>
                    </div>
                    <span className="profile-link-arrow arrow-out" aria-hidden="true">↗</span>
                  </a>
                  <a
                    href={IDENTITY.chambersProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="profile-link-row"
                  >
                    <div>
                      <div className="profile-link-label">Chambers Profile</div>
                      <div className="profile-link-sub">{IDENTITY.chambers}</div>
                    </div>
                    <span className="profile-link-arrow arrow-out" aria-hidden="true">↗</span>
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Areas of practice ── */}
        <section id="practice" aria-labelledby="practice-heading">
          <div className="col">
            <div className="row">
              <Reveal>
                <h2 className="row-label" id="practice-heading">Practice</h2>
              </Reveal>
              <Reveal delay={0.13}>
                <ul className="practice-list" role="list">
                  {PRACTICE_AREAS.map((area, i) => (
                    <li key={i}>{area}</li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Courts & tribunals ── */}
        <section id="courts" aria-labelledby="courts-heading">
          <div className="col">
            <div className="row">
              <Reveal>
                <h2 className="row-label" id="courts-heading">Courts</h2>
              </Reveal>
              <Reveal delay={0.13}>
                <ul className="plain-list" role="list">
                  {COURTS.map((court, i) => (
                    <li key={i}>{court}</li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Experience ── Renders only once there is verified history to show. */}
        {EXPERIENCE.length > 0 && (
          <section id="experience" aria-labelledby="experience-heading">
            <div className="col">
              <div className="row">
                <Reveal>
                  <h2 className="row-label" id="experience-heading">Experience</h2>
                </Reveal>
                <Reveal delay={0.13}>
                  <ol className="timeline" role="list">
                    {EXPERIENCE.map((entry, i) => (
                      <li key={i}>
                        <span className="timeline-year">{entry.period}</span>
                        <div>
                          <span className="timeline-detail">{entry.role}</span>
                          {entry.detail && <p className="timeline-note">{entry.detail}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Reveal>
              </div>
            </div>
          </section>
        )}

        {/* ── Selected matters ── Off until matters can properly be disclosed. */}
        {MATTERS.length > 0 && (
          <section id="matters" aria-labelledby="matters-heading">
            <div className="col">
              <div className="row">
                <Reveal>
                  <h2 className="row-label" id="matters-heading">Matters</h2>
                </Reveal>
                <Reveal delay={0.13}>
                  <div className="practice-grid practice-grid-single">
                    {MATTERS.map((matter, i) => (
                      <div className="practice-item" key={i}>
                        <h3 className="practice-name">{matter.title}</h3>
                        <p className="practice-desc">{matter.description}</p>
                        {(matter.court || matter.role || matter.year) && (
                          <p className="matter-meta">
                            {[matter.court, matter.role, matter.year].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Reveal>
              </div>
            </div>
          </section>
        )}

        {/* ── Memberships ── */}
        {MEMBERSHIPS.length > 0 && (
          <section id="memberships" aria-labelledby="memberships-heading">
            <div className="col">
              <div className="row">
                <Reveal>
                  <h2 className="row-label" id="memberships-heading">Memberships</h2>
                </Reveal>
                <Reveal delay={0.13}>
                  <ul className="plain-list" role="list">
                    {MEMBERSHIPS.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </Reveal>
              </div>
            </div>
          </section>
        )}

        {/* ── Brief CTA ── */}
        <section id="brief-cta" aria-labelledby="brief-heading">
          <div className="col" style={{ position: 'relative', zIndex: 1 }}>
            <div className="row">
              <Reveal>
                <h2 className="row-label" id="brief-heading">Brief</h2>
              </Reveal>
              <Reveal delay={0.13}>
                <div className="brief-cta-row">
                  <div className="brief-cta-text">
                    <p>To instruct Michael or enquire about availability, use the brief form.</p>
                  </div>
                  <Link href="/brief" className="btn-outline">
                    Submit a brief <span className="btn-arrow" aria-hidden="true">→</span>
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer id="contact" aria-label="Contact">
        <div className="col">
          <div className="row">
            <Reveal>
              <h2 className="row-label">Contact</h2>
            </Reveal>
            <div>
              <Reveal delay={0.13}>
                <div className="footer-grid">
                  <div className="footer-left">
                    <strong>{IDENTITY.name}</strong>
                    <p>
                      {IDENTITY.role} · {IDENTITY.chambers}<br />
                      {IDENTITY.address[0]}<br />
                      {IDENTITY.address[1]}
                    </p>
                  </div>
                  <div className="footer-right">
                    <a href={`tel:${CONTACT.direct.tel}`}>Direct: {CONTACT.direct.display}</a>
                    <a href={`mailto:${CONTACT.direct.email}`}>{CONTACT.direct.email}</a>
                    <a href={`tel:${CONTACT.clerk.tel}`} style={{ marginTop: '10px' }}>Clerk: {CONTACT.clerk.display}</a>
                    <a href={`mailto:${CONTACT.clerk.email}`}>{CONTACT.clerk.email}</a>
                    <a
                      href={IDENTITY.chambersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-chambers-link"
                    >
                      {IDENTITY.chambers} ↗
                    </a>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </footer>
      <p className="footer-bottom">
        <span>
          © 2026 Michael Klooster · Barrister
          <span className="footer-sep" aria-hidden="true">·</span>
          {/* Discreet by design — chambers staff only, and not worth signposting
              to the solicitors this page is actually for. */}
          <Link href="/staff/login" className="staff-link" rel="nofollow">Staff</Link>
        </span>
        <span>Liability limited by a scheme approved under Professional Standards Legislation</span>
      </p>

      {/* ── Intro ── */}
      <AnimatePresence>{introPlaying && <Intro key="intro" />}</AnimatePresence>
    </>
  )
}
