'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { animate, motion, AnimatePresence, useReducedMotion, useInView, useMotionValue } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

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
  const prefersReducedMotion = useReducedMotion()

  // Splash visibility
  const [showSplash, setShowSplash] = useState(true)
  // Hero entrance animations trigger after splash
  const [heroReady, setHeroReady] = useState(false)

  // Splash text state
  const [firstText, setFirstText] = useState('M')
  const [lastText, setLastText] = useState('K')
  const [firstVisible, setFirstVisible] = useState(false)
  const [lastVisible, setLastVisible] = useState(false)
  const [showCursorFirst, setShowCursorFirst] = useState(false)
  const [showCursorLast, setShowCursorLast] = useState(false)
  const [lastMarginTop, setLastMarginTop] = useState('0.18em')

  // Spring motion values for the FLIP transition
  const splashX = useMotionValue(0)
  const splashY = useMotionValue(0)
  const splashScale = useMotionValue(1)
  const splashBgOpacity = useMotionValue(1)

  // DOM refs for measuring
  const splashNamesRef = useRef<HTMLDivElement>(null)
  const navMarkRef = useRef<HTMLAnchorElement>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const addTimeout = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay)
    timeoutsRef.current.push(id)
    return id
  }, [])

  const finishSplash = useCallback(() => {
    setShowSplash(false)
    document.body.style.overflow = ''
    sessionStorage.setItem('splashDone', '1')
    setHeroReady(true)
  }, [])

  const doFlip = useCallback(() => {
    const namesEl = splashNamesRef.current
    const navEl = navMarkRef.current
    if (!namesEl || !navEl) { finishSplash(); return }

    const fromRect = namesEl.getBoundingClientRect()
    const toRect = navEl.getBoundingClientRect()

    const targetScale = toRect.height / fromRect.height
    const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2)
    const dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2)

    // Hide the real nav mark — the animated splash text stands in for it
    navEl.style.opacity = '0'

    const springOpts = { type: 'spring' as const, stiffness: 68, damping: 15, mass: 1 }

    animate(splashX, dx, springOpts)
    animate(splashY, dy, springOpts)
    animate(splashScale, targetScale, {
      ...springOpts,
      onComplete: () => {
        finishSplash()
        // Restore nav mark after swap (element is stationary so switch is invisible)
        if (navEl) navEl.style.opacity = ''
      },
    })

    // Background dissolves as the FLIP plays
    animate(splashBgOpacity, 0, { duration: 0.75, delay: 0.12 })
  }, [splashX, splashY, splashScale, splashBgOpacity, finishSplash])

  useEffect(() => {
    const skip = prefersReducedMotion || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('splashDone'))
    if (skip) {
      setShowSplash(false)
      setHeroReady(true)
      return
    }

    document.body.style.overflow = 'hidden'

    const LAST = 'Klooster'
    const rnd = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

    // Phase 1 — drop-in
    addTimeout(() => setFirstVisible(true), 180)
    addTimeout(() => setLastVisible(true), 420)

    // Phase 2 — type M.
    addTimeout(() => {
      setFirstText('M.')
      setShowCursorFirst(true)

      // Dismiss first cursor, then start last
      addTimeout(() => {
        setShowCursorFirst(false)
        addTimeout(() => {
          setShowCursorLast(true)

          // Phase 3 — type Klooster char by char
          let idx = 1
          const typeNext = () => {
            setLastText(LAST.slice(0, idx + 1))
            idx++
            if (idx < LAST.length) {
              addTimeout(typeNext, rnd(115, 195))
            } else {
              // Phase 4 — dismiss cursor, collapse stagger, FLIP
              addTimeout(() => {
                setShowCursorLast(false)
                setLastMarginTop('0')
                addTimeout(doFlip, 800)
              }, 350)
            }
          }
          typeNext()
        }, 160)
      }, 350)
    }, 1500)

    return () => { timeoutsRef.current.forEach(clearTimeout) }
  }, [addTimeout, doFlip, prefersReducedMotion])

  return (
    <>
      {/* Fixed watermark */}
      <div className="hero-monogram" aria-hidden="true">
        <span className="mono-letter mono-letter-m">M</span>
        <span className="mono-letter mono-letter-k">K</span>
      </div>

      {/* ── Nav ── */}
      <nav aria-label="Main navigation" style={{ position: 'relative', zIndex: 1 }}>
        <div className="col">
          <div className="nav-inner">
            <a href="#hero" ref={navMarkRef} className="nav-mark">M. Klooster</a>
            <ul className="nav-links" role="list">
              <li><a href="#profile">Profile</a></li>
              <li><Link href="/brief">Brief</Link></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
        </div>
      </nav>

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
                  sizes="(max-width: 640px) 148px, 232px"
                  style={{ objectFit: 'cover', objectPosition: 'center top', filter: 'grayscale(18%) contrast(1.02)', transform: 'scale(1.04)', transition: 'transform 1.2s var(--ease), filter 0.6s' }}
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
                  <motion.a
                    href="#"
                    className="profile-link-row"
                    aria-label="Download CV"
                    whileHover={{ backgroundColor: 'rgba(232,229,223,0.03)' }}
                    transition={{ duration: 0.35 }}
                  >
                    <div>
                      <div className="profile-link-label">Curriculum Vitae</div>
                      <div className="profile-link-sub">Admitted 2005 · Called to the NSW Bar 2010</div>
                    </div>
                    <motion.span
                      className="profile-link-arrow arrow-down"
                      aria-hidden="true"
                      whileHover={{ y: 3, color: 'var(--text)' }}
                      transition={{ duration: 0.35, ease: EASE }}
                    >↓</motion.span>
                  </motion.a>
                  <motion.a
                    href="https://www.8garfieldbarwick.com.au/barrister.html?id=klooster"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="profile-link-row"
                    aria-label="View chambers profile"
                    whileHover={{ backgroundColor: 'rgba(232,229,223,0.03)' }}
                    transition={{ duration: 0.35 }}
                  >
                    <div>
                      <div className="profile-link-label">Chambers Profile</div>
                      <div className="profile-link-sub">8th Floor Garfield Barwick Chambers</div>
                    </div>
                    <motion.span
                      className="profile-link-arrow arrow-out"
                      aria-hidden="true"
                      whileHover={{ x: 2, y: -2, color: 'var(--text)' }}
                      transition={{ duration: 0.35, ease: EASE }}
                    >↗</motion.span>
                  </motion.a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Brief CTA ── */}
        <section id="brief-cta" aria-labelledby="brief-heading">
          <div className="col" style={{ position: 'relative', zIndex: 1 }}>
            <div className="brief-monogram" aria-hidden="true">
              <span className="brief-monogram-text">MK</span>
            </div>
            <div className="row">
              <Reveal>
                <p className="row-label" id="brief-heading">Instructions</p>
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
        <span>© 2026 Michael Klooster · Barrister</span>
        <span>Liability limited by a scheme approved under Professional Standards Legislation</span>
      </p>

      {/* ── Cinematic splash ── */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            id="splash"
            aria-hidden="true"
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
          >
            <motion.div id="splash-bg" style={{ opacity: splashBgOpacity }} />
            <div id="splash-glow" />
            <motion.div
              id="splash-names"
              ref={splashNamesRef}
              style={{ x: splashX, y: splashY, scale: splashScale }}
            >
              <motion.span
                id="sn-first"
                initial={{ opacity: 0, y: -28 }}
                animate={firstVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.9, ease: EASE }}
              >
                {firstText}
                {showCursorFirst && <span className="splash-cursor" />}
              </motion.span>
              <motion.span
                id="sn-last"
                initial={{ opacity: 0, y: -28 }}
                animate={lastVisible ? { opacity: 1, y: 0, marginTop: lastMarginTop } : { marginTop: lastMarginTop }}
                transition={{
                  opacity: { duration: 0.9, ease: EASE },
                  y: { duration: 0.9, ease: EASE },
                  marginTop: { duration: 0.45, ease: EASE },
                }}
              >
                {lastText}
                {showCursorLast && <span className="splash-cursor" />}
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
