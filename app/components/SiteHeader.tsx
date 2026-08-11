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
 * to match. rootMargin biases the "active" band to the upper third, which is
 * where a reader's attention actually sits.
 */
function useActiveSection() {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const targets = SECTIONS.map(s => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    )

    targets.forEach(el => observer.observe(el))
    return () => observer.disconnect()
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
