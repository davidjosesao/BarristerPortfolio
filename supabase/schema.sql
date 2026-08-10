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

-- A policy ON staff must never itself query staff — that recurses forever
-- ("infinite recursion detected in policy for relation staff"). Comparing the
-- row's own column to the JWT touches no other row, so it terminates.
drop policy if exists "staff can read roster" on public.staff;
drop policy if exists "staff can read own row" on public.staff;
create policy "staff can read own row" on public.staff
  for select to authenticated
  using (email = auth.jwt() ->> 'email');

-- Membership test for use in OTHER tables' policies. SECURITY DEFINER runs it
-- as the owner, so the staff lookup inside bypasses RLS — without this, every
-- policy that consults staff would re-enter staff's own policy and recurse.
create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.staff where email = auth.jwt() ->> 'email'
  );
$$;

revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

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
  using (public.is_staff());

drop policy if exists "staff can update briefs" on public.briefs;
create policy "staff can update briefs" on public.briefs
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── Fees ────────────────────────────────────────────────────────────────────
-- Fee line items recorded against a brief: the brief fee itself, refreshers
-- charged per day, hourly work, fixed-fee items, and disbursements paid out on
-- the client's behalf. Summed to produce a memorandum of fees / tax invoice.
create table if not exists public.fees (
  id       uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete cascade,

  created_at timestamptz not null default now(),

  fee_type text not null
             check (fee_type in ('brief_fee', 'daily_rate', 'hourly_rate',
                                 'fixed_fee', 'disbursement')),
  description text,

  -- Days for a refresher, hours for hourly work, 1 for anything charged once.
  -- Fractional by design: half-day refreshers and 0.2h attendances are normal.
  quantity    numeric(10,2) not null default 1 check (quantity > 0),

  -- Always GST-EXCLUSIVE. Storing tax-inclusive amounts anywhere makes the
  -- invoice subtotal unreconcilable once mixed with GST-free disbursements.
  unit_amount numeric(12,2) not null check (unit_amount >= 0),

  -- Court filing fees and similar statutory outlays carry no GST, so this is
  -- per-line rather than a global setting.
  gst_applicable boolean not null default true,

  -- The rate is stored on the row, not hardcoded at render time, so that a
  -- future change to the GST rate cannot silently restate fees already billed.
  gst_rate numeric(5,4) not null default 0.1000
             check (gst_rate >= 0 and gst_rate <= 1),

  -- Derived here rather than in TypeScript so every consumer — invoice PDF,
  -- staff UI, any later report — agrees on the arithmetic and the rounding.
  -- Generated columns may reference only plain stored columns, hence the
  -- repeated (quantity * unit_amount) rather than referencing amount_ex_gst.
  amount_ex_gst numeric(14,2)
    generated always as (round(quantity * unit_amount, 2)) stored,
  gst_amount    numeric(14,2)
    generated always as (
      case when gst_applicable
           then round(quantity * unit_amount * gst_rate, 2)
           else 0
      end
    ) stored
);

create index if not exists fees_brief_id_idx on public.fees (brief_id);

alter table public.fees enable row level security;

-- Unlike briefs, there is no public write path here: fees are only ever
-- created by staff from the dashboard, so all four verbs are staff-gated.
drop policy if exists "staff can read fees" on public.fees;
create policy "staff can read fees" on public.fees
  for select to authenticated
  using (public.is_staff());

drop policy if exists "staff can insert fees" on public.fees;
create policy "staff can insert fees" on public.fees
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists "staff can update fees" on public.fees;
create policy "staff can update fees" on public.fees
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff can delete fees" on public.fees;
create policy "staff can delete fees" on public.fees
  for delete to authenticated
  using (public.is_staff());

-- ── Seed your staff accounts ────────────────────────────────────────────────
-- Replace these before running, then create matching users under
-- Authentication → Users (tick auto-confirm).
--
-- insert into public.staff (email) values
--   ('barrister@example.com'),
--   ('clerk@example.com')
-- on conflict (email) do nothing;
