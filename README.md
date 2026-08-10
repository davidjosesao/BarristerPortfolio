# Barrister Portfolio — Web Application

A full-stack web application built for a barrister's professional practice: a public profile site with a brief-submission form, and an authenticated staff portal for triaging incoming briefs. Covers frontend design, Next.js App Router architecture, Supabase auth/RLS, third-party API integration, and automated testing.

## Project Overview

The site gives a barrister a professional online presence and a structured way to receive briefs from solicitors, replacing ad-hoc phone/email. A solicitor fills out a form; the backend validates it, generates an AI summary of the matter, emails a formatted brief to chambers, and confirms receipt to the submitter. Chambers staff then triage, update status, and add notes from a dedicated dashboard.

### What it does

**Public site** (`app/page.tsx`, `app/brief/page.tsx`) — the barrister's profile and a structured brief submission form covering the submitter's contact details, matter details (parties, court, jurisdiction, matter type, urgency, hearing date), and a plain-language description of what counsel is needed for.

On submission (`app/api/submit-brief/route.js` → `lib/submit-brief.js`):
1. Rate-limits by IP (5 submissions/hour via Vercel KV)
2. Validates all fields (required fields, length limits, email format)
3. Calls the Gemini API to produce a 5-bullet AI summary of the brief
4. Saves the brief to Supabase (via the service-role key, bypassing RLS — this is the only write path)
5. Emails the barrister (and optionally the clerk, via BCC) a formatted HTML brief with the summary up top
6. Emails the submitter a plain-text confirmation

**Staff portal** (`app/staff/*`) — a Supabase-authenticated dashboard at `/staff/briefs` listing incoming briefs, with a detail view (`/staff/briefs/[id]`) for reading the full submission and updating status (`new` / `reviewed` / `accepted` / `declined`) and internal notes.

Access control is layered, not just a single check:
- `proxy.ts` (Next middleware) redirects unauthenticated visitors away from `/staff/*`
- Every read of `briefs`/`staff` goes through the Supabase anon-key client, so Postgres Row Level Security is the actual authority — a `staff` allowlist table plus a `SECURITY DEFINER` `is_staff()` function decide who can read or update brief data (see `supabase/schema.sql`)
- `app/api/staff/briefs/[id]/route.ts` (the update endpoint) independently re-checks session + staff membership server-side rather than trusting the middleware alone

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Auth & data | Supabase (Postgres + Auth + Row Level Security) |
| AI summary | Google Gemini (`gemini-1.5-flash`) |
| Email delivery | Resend |
| Rate limiting | Vercel KV |
| Animation | Motion |
| Testing | Jest 29 |
| Linting | ESLint 9 (`eslint-config-next`) |

## Project Structure

```
├── app/
│   ├── page.tsx                    # Public portfolio page
│   ├── brief/page.tsx              # Brief submission form
│   ├── api/
│   │   ├── submit-brief/route.js       # POST /api/submit-brief
│   │   └── staff/briefs/[id]/route.ts  # PATCH — staff-only, status/notes updates
│   └── staff/                      # Authenticated staff dashboard
│       ├── login/page.tsx
│       ├── briefs/page.tsx             # Brief list
│       └── briefs/[id]/page.tsx        # Brief detail + actions
├── lib/
│   ├── submit-brief.js             # Validation, AI summary, save, email — + tests
│   └── supabase/                   # Browser + server Supabase client factories
├── proxy.ts                        # Middleware — redirects unauthenticated /staff/* traffic
├── supabase/schema.sql             # Tables + RLS policies
├── package.json
├── vercel.json
└── .env.local.example              # Required environment variables
```

## Setup

```bash
npm install
```

Copy `.env.local.example` to `.env.local` and fill in your keys (Resend, Gemini, Supabase, Vercel KV — see the file for the full list and where to get each one).

Run the Supabase schema (`supabase/schema.sql`) in the Supabase SQL editor, then create your staff accounts under Authentication → Users and add their emails to the `staff` table.

```bash
npm run dev     # start the dev server
npm run lint    # ESLint
npm test        # Jest — 46 tests covering validation, rate limiting, AI summary,
                 # email delivery, Supabase persistence, and the full request handler
```

## Deployment

Deploy to Vercel:

```bash
npx vercel --prod
```

Set the environment variables in the Vercel project dashboard (never commit them — `.env.local` is gitignored).
