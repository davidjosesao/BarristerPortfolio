import type { Metadata } from 'next'
import { EB_Garamond, Inter } from 'next/font/google'
import './globals.css'

const garamond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-garamond',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Michael Klooster — Barrister',
  description: 'Michael Klooster — Barrister, 8th Floor Garfield Barwick Chambers, Sydney NSW.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${garamond.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  )
}
