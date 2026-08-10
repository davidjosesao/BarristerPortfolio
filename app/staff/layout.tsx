import type { Metadata } from 'next'

// Keeps the staff area out of search results. The footer link is nofollow, but
// that only discourages crawling — this is what actually prevents indexing.
export const metadata: Metadata = {
  title: 'Chambers Staff',
  robots: { index: false, follow: false },
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
