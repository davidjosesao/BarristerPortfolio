# Barrister Portfolio — Web Application

A university project demonstrating a full-stack web application built for a barrister's professional practice. The project covers frontend design, serverless backend development, third-party API integration, and automated testing.

## Project Overview

This application gives a barrister a professional online presence and a streamlined way to receive brief submissions from solicitors and instructing clients. Rather than managing briefs by phone tag or ad-hoc email, the barrister gets a dedicated web form that validates submissions, generates an AI-assisted summary of the matter, and delivers a formatted brief to chambers — all automatically.

### What it does

**Portfolio page (`index.html`)** — A single-page profile showing the barrister's name, chambers affiliation, CV and chambers profile links, and a call-to-action to submit a brief.

**Brief submission page (`brief.html`)** — A structured form where solicitors provide:
- Their contact details (name, firm, email, phone)
- Matter details (parties, court/tribunal, matter type, urgency, hearing date)
- A plain-language description of what counsel is needed for

On submission the backend:
1. Rate-limits to prevent spam (5 submissions per IP per hour via Vercel KV)
2. Validates all required fields
3. Calls the Claude API to produce a 5-bullet AI summary of the brief
4. Emails the barrister a formatted HTML brief (with the AI summary + full details)
5. Emails the submitter a plain-text confirmation

## How a barrister uses this

A solicitor visits the site, fills out the brief form, and hits submit. Within seconds the barrister receives a clean, formatted email with an AI-generated summary at the top — so they can triage at a glance before reading the full brief. The solicitor gets a confirmation email immediately. No phone calls to arrange a call, no chasing acknowledgements.

The barrister can:
- Share the URL with solicitors instead of handing out an email address for brief enquiries
- Receive briefs in a consistent, structured format every time
- Use the AI summary to quickly assess urgency and matter type before opening the full email
- Have their clerk automatically BCCed on every brief (via `CLERK_EMAIL` env var)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML / CSS / JS |
| Backend | Node.js serverless function (Vercel) |
| AI summary | Anthropic Claude API (`claude-haiku-4-5-20251001`) |
| Email delivery | Resend |
| Rate limiting | Vercel KV |
| Testing | Jest 29 |

## Project Structure

```
├── index.html              # Main portfolio page
├── brief.html              # Brief submission form
├── uploads/                # Static assets (headshot)
├── api/
│   ├── submit-brief.js     # Serverless handler + helpers
│   └── submit-brief.test.js
├── package.json
├── vercel.json
└── .env.local.example      # Required environment variables
```

## Setup

```bash
npm install
```

Copy `.env.local.example` to `.env.local` and fill in your keys:

```
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
RECIPIENT_EMAIL=barrister@chambers.example
CLERK_EMAIL=clerk@chambers.example
FROM_EMAIL=briefs@yourdomain.example
```

Run locally with the Vercel dev server:

```bash
npx vercel dev
```

Run tests:

```bash
npm test
```

## Tests

37 unit tests covering all five helper functions and the main handler, including success paths, validation errors, rate limiting, Claude API failure fallback, and email delivery errors.

## Deployment

Deploy to Vercel:

```bash
npx vercel --prod
```

Set the environment variables in your Vercel project dashboard (do not commit them).
