'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/**
 * The brand mark is rendered in exactly one place at a time — inside the intro
 * while it plays, then inside the header. Both carry `layoutId="brand-mark"`,
 * so Motion measures the two positions and interpolates between them itself.
 * That replaces the old hand-rolled FLIP (getBoundingClientRect + manual
 * transforms), which could never land precisely because it measured the nav
 * mark before layout had settled.
 */
export const BRAND_LAYOUT_ID = 'brand-mark'

/** Skip the intro for anyone who has seen it in the last six hours. */
const SEEN_KEY = 'mk:intro-seen'
const SEEN_WINDOW_MS = 6 * 60 * 60 * 1000

const EXPO_OUT = [0.19, 1, 0.22, 1] as const

function hasSeenIntro() {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    if (!raw) return false
    return Date.now() - Number(raw) < SEEN_WINDOW_MS
  } catch {
    return false
  }
}

function markIntroSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()))
  } catch {
    /* private mode — replay next time, no harm done */
  }
}

/** Each word sits in an overflow-hidden clip so it wipes up from its own baseline. */
function MaskWord({ children, delay }: { children: string; delay: number }) {
  return (
    <span className="mask-line">
      <motion.span
        className="mask-line-inner"
        initial={{ y: '110%' }}
        animate={{ y: '0%' }}
        transition={{ duration: 1.1, ease: EXPO_OUT, delay }}
      >
        {children}
      </motion.span>
    </span>
  )
}

export function useIntro() {
  const prefersReducedMotion = useReducedMotion()
  // Start hidden so the server-rendered markup matches the first client paint;
  // the effect below decides whether to actually play it.
  const [playing, setPlaying] = useState(false)
  const [decided, setDecided] = useState(false)

  // `hasSeenIntro()` reads localStorage, which only exists on the client — the
  // decision has to happen in an effect (not during render) so the first client
  // render still matches the server-rendered (hidden) markup before this runs.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (prefersReducedMotion || hasSeenIntro()) {
      setDecided(true)
      return
    }
    setPlaying(true)
    setDecided(true)
    document.body.style.overflow = 'hidden'
  }, [prefersReducedMotion])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!playing) return
    const id = window.setTimeout(() => {
      setPlaying(false)
      markIntroSeen()
      document.body.style.overflow = ''
    }, 2300)
    return () => window.clearTimeout(id)
  }, [playing])

  return { introPlaying: playing, introDecided: decided }
}

export function Intro() {
  return (
    <motion.div
      id="intro"
      aria-hidden="true"
      // The backdrop fades on its own while the mark travels, so the mark is
      // never hidden behind a dissolving panel mid-flight.
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
    >
      <div id="intro-glow" />
      <motion.div
        layoutId={BRAND_LAYOUT_ID}
        className="brand-mark intro-brand"
        transition={{ type: 'spring', stiffness: 60, damping: 16, mass: 1 }}
      >
        {/* Word spacing comes from the flex gap, not a text node. */}
        <MaskWord delay={0.15}>Michael</MaskWord>
        <MaskWord delay={0.28}>Klooster</MaskWord>
      </motion.div>
    </motion.div>
  )
}
