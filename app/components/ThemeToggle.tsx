'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'theme'

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem(STORAGE_KEY, theme)
}

/**
 * Reads the theme the blocking script in layout.tsx already stamped onto
 * <html data-theme> before paint — this just mirrors it into state so the
 * button can render the right icon without a hydration flash.
 */
function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const current = document.documentElement.dataset.theme
    setTheme(current === 'light' ? 'light' : 'dark')
  }, [])

  const toggle = () => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }

  return { theme, toggle }
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggle}
      className={`theme-toggle ${className}`.trim()}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      aria-pressed={isLight}
    >
      {isLight ? (
        // Moon — shown when light is active, signalling "switch to dark".
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <path
            d="M12.9 9.5a5.6 5.6 0 0 1-7.4-7.4A6 6 0 1 0 12.9 9.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Sun — shown when dark is active, signalling "switch to light".
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <circle cx="7.5" cy="7.5" r="3.2" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M7.5 0.8v1.7M7.5 12.5v1.7M14.2 7.5h-1.7M2.5 7.5H0.8M12.3 2.7l-1.2 1.2M3.9 11.1l-1.2 1.2M12.3 12.3l-1.2-1.2M3.9 3.9 2.7 2.7"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
