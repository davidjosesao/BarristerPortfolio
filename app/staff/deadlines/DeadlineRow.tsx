'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function DeadlineRow({
  href,
  isLast,
  children,
}: {
  href: string
  isLast: boolean
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      style={{
        display: 'grid',
        gridTemplateColumns: '190px 1fr 160px 110px 100px 32px',
        gap: '16px',
        padding: '16px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--rule)',
        textDecoration: 'none',
        alignItems: 'center',
        transition: 'background 0.2s',
        background: hovered ? 'rgba(var(--ink-rgb),0.025)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}
