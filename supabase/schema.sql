-- Schema for the brief submission portal.
-- Run in Supabase → SQL Editor. Safe to re-run.
--
-- Column set is derived from the insert in lib/submit-brief.js and the selects
-- in app/staff/briefs/*.

-- ── Staff allowlist ─────────────────────────────────────────────────────────
-- Being able to authenticate is not the same as being allowed to read briefs.
-- Membership here is what grants access; add the barrister and clerk only.
create table if not exists public.staff (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- Staff may see the roster (so the app can check itself); nobody may edit it
-- from the client. Manage rows from the Supabase dashboard.
drop policy if exists "staff can read roster" on public.staff;
create policy "staff can read roster" on public.staff
  for select to authenticated
  using (auth.jwt() ->> 'email' in (select email from public.staff));

-- ── Briefs ──────────────────────────────────────────────────────────────────
create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),

  -- Deduplicates retries of the same submission; the API relies on the unique
  -- violation (23505) to update instead of inserting a second row.
  submission_id text not null unique,

  created_at timestamptz not null default now(),

  -- Submitter
  your_name  text not null,
  firm_name  text,
  your_email text not null,
  your_phone text,

  -- Matter
  parties      text not null,
  court        text not null,
  jurisdiction text not null,
  matter_type  text not null,
  urgency      text not null,
  hearing_date date,
  key_facts    text not null,

  -- Generated + staff-managed
  ai_summary  text,
  status      text not null default 'new'
                check (status in ('new', 'reviewed', 'accepted', 'declined')),
  staff_notes text
);

create index if not exists briefs_created_at_idx on public.briefs (created_at desc);
create index if not exists briefs_status_idx     on public.briefs (status);

alter table public.briefs enable row level security;

-- No policy is needed for submissions: the API writes with the service role
-- key, which bypasses RLS. Without the policies below, an authenticated user
-- who is not staff sees nothing — which is the point.
drop policy if exists "staff can read briefs" on public.briefs;
create policy "staff can read briefs" on public.briefs
  for select to authenticated
  using (auth.jwt() ->> 'email' in (select email from public.staff));

drop policy if exists "staff can update briefs" on public.briefs;
create policy "staff can update briefs" on public.briefs
  for update to authenticated
  using (auth.jwt() ->> 'email' in (select email from public.staff))
  with check (auth.jwt() ->> 'email' in (select email from public.staff));

-- ── Seed your staff accounts ────────────────────────────────────────────────
-- Replace these before running, then create matching users under
-- Authentication → Users (tick auto-confirm).
--
-- insert into public.staff (email) values
--   ('barrister@example.com'),
--   ('clerk@example.com')
-- on conflict (email) do nothing;
