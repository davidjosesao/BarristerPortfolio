'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function BriefRow({
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
        gridTemplateColumns: '140px 1fr 160px 110px 90px 100px 32px',
        gap: '16px',
        padding: '16px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--rule)',
        textDecoration: 'none',
        alignItems: 'center',
        transition: 'background 0.2s',
        background: hovered ? 'rgba(255,255,255,0.025)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}
