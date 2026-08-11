'use client'

import { useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { Intro, useIntro } from './components/Intro'
import { SiteHeader } from './components/SiteHeader'

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
                    <a href="https://www.8garfieldbarwick.com.au" target="_blank" rel="noopener noreferrer">
                      8th Floor Garfield Barwick Chambers
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
                      <a href="tel:+61282393256">(02) 8239 3256</a>
                      <span className="contact-dot" aria-hidden="true">·</span>
                      <a href="mailto:mklooster@chambers.net.au">mklooster@chambers.net.au</a>
                    </div>
                    <div className="contact-row">
                      <span className="contact-lbl">Clerk</span>
                      <a href="tel:+61282393200">(02) 8239 3200</a>
                      <span className="contact-dot" aria-hidden="true">·</span>
                      <a href="mailto:reception@8gbc.com.au">reception@8gbc.com.au</a>
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
                <p className="row-label" id="profile-heading">Profile</p>
              </Reveal>
              <Reveal delay={0.13}>
                <div className="profile-links">
                  <a
                    href="mailto:reception@8gbc.com.au?subject=CV%20request%20%E2%80%94%20Michael%20Klooster"
                    className="profile-link-row"
                  >
                    <div>
                      <div className="profile-link-label">Curriculum Vitae</div>
                      <div className="profile-link-sub">Admitted 2005 · Called to the NSW Bar 2010 · Available on request</div>
                    </div>
                    <span className="profile-link-arrow arrow-out" aria-hidden="true">↗</span>
                  </a>
                  <a
                    href="https://www.8garfieldbarwick.com.au/barrister.html?id=klooster"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="profile-link-row"
                  >
                    <div>
                      <div className="profile-link-label">Chambers Profile</div>
                      <div className="profile-link-sub">8th Floor Garfield Barwick Chambers</div>
                    </div>
                    <span className="profile-link-arrow arrow-out" aria-hidden="true">↗</span>
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Brief CTA ── */}
        <section id="brief-cta" aria-labelledby="brief-heading">
          <div className="col" style={{ position: 'relative', zIndex: 1 }}>
            <div className="row">
              <Reveal>
                <p className="row-label" id="brief-heading">Brief</p>
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
              <p className="row-label">Contact</p>
            </Reveal>
            <div>
              <Reveal delay={0.13}>
                <div className="footer-grid">
                  <div className="footer-left">
                    <strong>Michael Klooster</strong>
                    <p>
                      Barrister · 8th Floor Garfield Barwick Chambers<br />
                      Level 8 · 53 Martin Place<br />
                      Sydney NSW 2000
                    </p>
                  </div>
                  <div className="footer-right">
                    <a href="tel:+61282393256">Direct: (02) 8239 3256</a>
                    <a href="mailto:mklooster@chambers.net.au">mklooster@chambers.net.au</a>
                    <a href="tel:+61282393200" style={{ marginTop: '10px' }}>Clerk: (02) 8239 3200</a>
                    <a href="mailto:reception@8gbc.com.au">reception@8gbc.com.au</a>
                    <a
                      href="https://www.8garfieldbarwick.com.au"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-chambers-link"
                    >
                      8th Floor Garfield Barwick Chambers ↗
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
