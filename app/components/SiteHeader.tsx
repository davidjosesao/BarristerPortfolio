'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useMotionValueEvent, useSpring } from 'motion/react'
import { BRAND_LAYOUT_ID } from './Intro'
import { ThemeToggle } from './ThemeToggle'

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'brief-cta', label: 'Brief' },
  { id: 'contact', label: 'Contact' },
] as const

/**
 * Tracks which section owns the viewport so the header can move its underline
 * to match. Picks the last section (in document order) whose top has crossed
 * the vertical CENTER of the viewport — a plain scrollspy comparison rather
 * than IntersectionObserver bands, which fell apart on this page: Brief and
 * Contact sit close enough together near the bottom that a reference point
 * near the top of the viewport always favours Brief (it's the one nearer
 * the top), even once you've scrolled all the way down and Contact is
 * plainly the section on screen. Using the viewport's centre as the
 * reference — the standard scrollspy heuristic — resolves that without a
 * separate "near bottom" special case: at max scroll the centre point falls
 * inside Contact's range, so it wins on its own.
 */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const targets = SECTIONS.map(s => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (targets.length === 0) return

    let ticking = false
    const update = () => {
      ticking = false
      const reference = window.scrollY + window.innerHeight / 2

      let current = targets[0].id
      for (const el of targets) {
        if (el.offsetTop <= reference) current = el.id
      }

      setActive(current)
    }
    const onScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(update)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return active
}

export function SiteHeader({ showBrand }: { showBrand: boolean }) {
  const { scrollY, scrollYProgress } = useScroll()
  const [condensed, setCondensed] = useState(false)
  const activeSection = useActiveSection()

  // Smooth the raw progress so the rule under the header eases rather than
  // tracking every wheel tick.
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  })

  useMotionValueEvent(scrollY, 'change', current => {
    setCondensed(current > 40)
  })

  return (
    <motion.header
      className={`site-header${condensed ? ' is-condensed' : ''}`}
      aria-label="Main navigation"
    >
      <div className="col">
        <div className="header-inner">
          {/* Rendered only once the intro has handed the mark over. */}
          {showBrand ? (
            <motion.a
              href="#hero"
              layoutId={BRAND_LAYOUT_ID}
              className="brand-mark header-brand"
              transition={{ type: 'spring', stiffness: 60, damping: 16, mass: 1 }}
            >
              Michael Klooster
            </motion.a>
          ) : (
            // Reserve the space so the nav links don't shift when the mark lands.
            <span className="brand-mark header-brand" aria-hidden="true" style={{ opacity: 0 }}>
              Michael Klooster
            </span>
          )}

          <div className="header-nav-group">
            <nav>
              <ul className="nav-links" role="list">
                {SECTIONS.map(section => {
                  const isActive = activeSection === section.id
                  const isBrief = section.id === 'brief-cta'
                  return (
                    <li key={section.id}>
                      {isBrief ? (
                        <Link
                          href="/brief"
                          className={`nav-link${isActive ? ' is-active' : ''}`}
                          aria-current={isActive ? 'true' : undefined}
                        >
                          {section.label}
                        </Link>
                      ) : (
                        <a
                          href={`#${section.id}`}
                          className={`nav-link${isActive ? ' is-active' : ''}`}
                          aria-current={isActive ? 'true' : undefined}
                        >
                          {section.label}
                        </a>
                      )}
                      {isActive && (
                        <motion.span
                          layoutId="nav-underline"
                          className="nav-underline"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <motion.div
        className="header-progress"
        style={{ scaleX: progress }}
        aria-hidden="true"
      />
    </motion.header>
  )
}
