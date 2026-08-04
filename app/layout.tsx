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

const SITE_URL = 'https://michaelklooster.com.au'
const DESCRIPTION =
  'Michael Klooster, barrister at 8th Floor Garfield Barwick Chambers, Sydney. Admitted 2005, called to the NSW Bar in 2010. Submit a brief or enquire about availability.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Michael Klooster — Barrister',
  description: DESCRIPTION,
  openGraph: {
    title: 'Michael Klooster — Barrister',
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Michael Klooster',
    locale: 'en_AU',
    type: 'profile',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Michael Klooster — Barrister',
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
}

/**
 * Lets search engines render the practice as an entity — name, chambers,
 * address and contact points — rather than inferring them from copy.
 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Attorney',
  name: 'Michael Klooster',
  jobTitle: 'Barrister',
  url: SITE_URL,
  description: DESCRIPTION,
  telephone: '+61282393256',
  email: 'mklooster@chambers.net.au',
  areaServed: 'AU-NSW',
  memberOf: {
    '@type': 'Organization',
    name: '8th Floor Garfield Barwick Chambers',
    url: 'https://www.8garfieldbarwick.com.au',
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Level 8, 53 Martin Place',
    addressLocality: 'Sydney',
    addressRegion: 'NSW',
    postalCode: '2000',
    addressCountry: 'AU',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${garamond.variable} ${inter.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  )
}
