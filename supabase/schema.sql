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

-- RLS filters rows; it cannot grant access to the table in the first place.
-- Without an explicit GRANT the policies below can never match, because the
-- role is refused at the table level before any policy is consulted. Hosted
-- Supabase projects usually have ambient default privileges that mask this,
-- but relying on them makes the schema unreproducible — running it against a
-- fresh database produced "permission denied for table briefs".
-- Each grant is limited to the verbs that table actually has a policy for.
grant select on public.staff to authenticated;

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

-- No insert or delete: briefs arrive through the API's service-role client and
-- are never removed from the dashboard, so those verbs are withheld entirely.
grant select, update on public.briefs to authenticated;

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

-- All four verbs here, matching the four policies above.
grant select, insert, update, delete on public.fees to authenticated;

-- ── Invoicing ───────────────────────────────────────────────────────────────
-- An invoice is not a separate document here: a brief becomes invoiced when it
-- is assigned a number. The PDF is rendered on demand from the fee lines, so
-- there is nothing to keep in sync.
alter table public.briefs
  add column if not exists invoice_number text,
  add column if not exists invoiced_at    timestamptz;

-- Numbers must be unique across chambers; the constraint is the backstop that
-- makes the allocation function below safe rather than merely likely-correct.
-- (Nulls do not collide, so un-invoiced briefs are unaffected.)
create unique index if not exists briefs_invoice_number_idx
  on public.briefs (invoice_number)
  where invoice_number is not null;

create sequence if not exists public.invoice_number_seq start 1;

-- Allocating a number has to be atomic and idempotent:
--   * atomic, or two clicks in quick succession bill the same matter twice
--     under different numbers;
--   * idempotent, or simply re-downloading a PDF burns a fresh number and
--     leaves gaps in the sequence, which an auditor will ask about.
-- The SELECT ... FOR UPDATE locks the brief row so concurrent callers queue
-- behind it and the second one sees the number the first assigned.
create or replace function public.allocate_invoice_number(p_brief_id uuid)
returns text
language plpgsql
as $$
declare
  v_existing text;
  v_number   text;
begin
  select invoice_number into v_existing
    from public.briefs
   where id = p_brief_id
     for update;

  if not found then
    raise exception 'Brief % not found', p_brief_id using errcode = 'no_data_found';
  end if;

  if v_existing is not null then
    return v_existing;
  end if;

  v_number := 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0');

  update public.briefs
     set invoice_number = v_number,
         invoiced_at    = now()
   where id = p_brief_id;

  return v_number;
end;
$$;

-- Deliberately NOT security definer: it runs as the caller, so the existing
-- "staff can update briefs" policy still decides who may invoice.
revoke all on function public.allocate_invoice_number(uuid) from public, anon;
grant execute on function public.allocate_invoice_number(uuid) to authenticated;
grant usage on sequence public.invoice_number_seq to authenticated;

-- ── AI chronology ───────────────────────────────────────────────────────────
-- Cached output of the on-demand chronology generation, so opening a brief
-- does not re-bill the AI provider on every page view. Null means "not
-- generated yet"; staff can regenerate to overwrite.
alter table public.briefs
  add column if not exists chronology            text,
  add column if not exists chronology_created_at timestamptz;

-- ── Calendar feed tokens ────────────────────────────────────────────────────
-- Calendar apps (Apple, Google, Outlook) poll a URL on a schedule and cannot
-- perform an interactive login, so the .ics feed cannot use the session
-- cookie. Each staff member gets a long random bearer token in the URL
-- instead. It is effectively a password: anyone holding it can read hearing
-- dates, which is why it is per-user and can be rotated.
alter table public.staff
  add column if not exists calendar_token text;

create unique index if not exists staff_calendar_token_idx
  on public.staff (calendar_token)
  where calendar_token is not null;

-- ── Brief share links ───────────────────────────────────────────────────────
-- A read-only link the barrister can send an instructing solicitor so they can
-- check progress without an account. The token is the entire credential, so:
--   * it is generated server-side from a CSPRNG, never derived from the
--     brief id (which would make every link guessable from any other);
--   * it can be expired and revoked independently of the brief;
--   * the public page reads a deliberately narrow column set — staff_notes and
--     fees are never exposed through it.
create table if not exists public.brief_shares (
  id       uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs(id) on delete cascade,

  token text not null unique,

  created_at timestamptz not null default now(),
  created_by text,
  expires_at timestamptz,
  revoked_at timestamptz,

  -- Observability for the barrister: "has the solicitor actually opened this?"
  last_viewed_at timestamptz,
  view_count     integer not null default 0
);

create index if not exists brief_shares_brief_id_idx on public.brief_shares (brief_id);

alter table public.brief_shares enable row level security;

-- Staff manage links from the dashboard. The public page does NOT read this
-- table as `anon` — it goes through the service role in a server route that
-- checks expiry and revocation itself, so no anon policy exists here and none
-- should be added. Granting anon read here would expose every token at once.
drop policy if exists "staff can read shares" on public.brief_shares;
create policy "staff can read shares" on public.brief_shares
  for select to authenticated
  using (public.is_staff());

drop policy if exists "staff can create shares" on public.brief_shares;
create policy "staff can create shares" on public.brief_shares
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists "staff can update shares" on public.brief_shares;
create policy "staff can update shares" on public.brief_shares
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

grant select, insert, update on public.brief_shares to authenticated;

-- ── Seed your staff accounts ────────────────────────────────────────────────
-- Replace these before running, then create matching users under
-- Authentication → Users (tick auto-confirm).
--
-- insert into public.staff (email) values
--   ('barrister@example.com'),
--   ('clerk@example.com')
-- on conflict (email) do nothing;
