/**
 * Every piece of professional information the public site states about
 * Michael lives here, so it can be corrected in one file rather than hunted
 * across components.
 *
 * Source of truth is the chambers profile — 8garfieldbarwick.com.au serves it
 * from `barristers-data.js`, keyed `klooster`. Everything below is taken from
 * there. Nothing here is inferred: if the chambers profile does not state it,
 * it is not on this page.
 *
 * The site carries no prose biography by request — the sections speak for
 * themselves. Michael's degrees (LLB (Hons), UTS; Masters in Environmental
 * Law, Sydney) are therefore stated nowhere on the site; they are on the
 * chambers profile, which the Profile section links out to.
 *
 * ── Empty sections ──────────────────────────────────────────────────────────
 * The arrays that are empty below (selected matters, memberships) are wired
 * into the page but do not render at all while empty — the chambers profile
 * lists nothing for either. Add entries and the section appears; nothing else
 * needs changing.
 */

export const IDENTITY = {
  name: 'Michael Klooster',
  role: 'Barrister',
  bar: 'New South Wales Bar',
  chambers: '8th Floor Garfield Barwick Chambers',
  chambersUrl: 'https://www.8garfieldbarwick.com.au',
  chambersProfileUrl: 'https://www.8garfieldbarwick.com.au/barrister.html?id=klooster',
  address: ['Level 8 · 53 Martin Place', 'Sydney NSW 2000'],
} as const

export const CONTACT = {
  direct: { tel: '+61282393256', display: '(02) 8239 3256', email: 'mklooster@chambers.net.au' },
  clerk: { tel: '+61282393200', display: '(02) 8239 3200', email: 'reception@8gbc.com.au' },
} as const

/** As listed on the chambers profile, in its order. */
export const PRACTICE_AREAS: string[] = [
  'Commercial',
  'Corporations Law',
  'Equity',
  'Property',
  'Building and Construction',
  'Bankruptcy/Insolvency',
  'Trade Practices and Competition',
  'Succession/Family Provision',
  'Appellate',
]

/**
 * Drawn from the forums named in the chambers biography — not from an
 * assumption that a NSW barrister appears everywhere in NSW.
 *
 * NOTE: the biography names the CTTT, which was abolished in 2014 and its
 * jurisdiction moved to NCAT. Listed here as NCAT with the former name, since
 * that is the tribunal a solicitor would be briefing him in today — worth
 * confirming with Michael before this goes live.
 */
export const COURTS: string[] = [
  'Supreme Court of New South Wales',
  'District Court of New South Wales',
  'Local Court of New South Wales',
  'NSW Civil and Administrative Tribunal (formerly the CTTT)',
  'Mediation and arbitration',
]

export type ExperienceEntry = { period: string; role: string; detail?: string }

export const EXPERIENCE: ExperienceEntry[] = [
  {
    period: '2010—',
    role: 'Barrister',
    detail: '8th Floor Garfield Barwick Chambers — principally general commercial litigation.',
  },
  {
    period: '2009—10',
    role: 'Bartier Perry',
    detail: 'Solicitor, general commercial division.',
  },
  {
    period: '2008',
    role: 'Somerville & Co',
    detail: 'Solicitor, commercial litigation.',
  },
  {
    period: '2005—07',
    role: 'Russel C Byrnes',
    detail: 'Employed solicitor, Surry Hills — a diverse general practice.',
  },
]

export type Matter = { title: string; description: string; court?: string; role?: string; year?: string }

/**
 * Empty → the Selected Matters section does not render. The chambers profile
 * lists none. Only matters that can properly be disclosed belong here.
 */
export const MATTERS: Matter[] = []

/** Empty → the Memberships section does not render. None listed on the chambers profile. */
export const MEMBERSHIPS: string[] = []
