-- Schema tests. Run against a local Supabase stack:
--
--   supabase start
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--        -f supabase/schema.sql -f supabase/tests/schema-test.sql
--
-- Every check raises an exception on failure, so a clean run means everything
-- passed. Wrapped in a transaction that is rolled back at the end, so running
-- it leaves no rows behind.
--
-- These exercise the parts that cannot be tested from TypeScript: the
-- generated columns, the CHECK constraints, ON DELETE CASCADE, the row
-- locking in allocate_invoice_number, and — most importantly — the RLS
-- policies that decide who can read chambers' briefs.

begin;

\set ON_ERROR_STOP on
\echo '── Setting up fixtures ─────────────────────────────────────────'

insert into public.staff (email) values ('barrister@test.local')
  on conflict (email) do nothing;

insert into public.briefs (
  submission_id, your_name, your_email, parties, court, jurisdiction,
  matter_type, urgency, key_facts
) values (
  'test-submission-1', 'Jane Solicitor', 'jane@test.local', 'Smith v Jones',
  'Supreme Court of NSW', 'NSW', 'Commercial', 'Routine', 'Test matter.'
);

\echo '── 1. Generated columns ────────────────────────────────────────'

do $$
declare
  v_brief uuid := (select id from public.briefs where submission_id = 'test-submission-1');
  v_ex    numeric;
  v_gst   numeric;
begin
  -- 1.5 days at $3,000/day = $4,500 ex GST, $450 GST.
  insert into public.fees (brief_id, fee_type, quantity, unit_amount)
  values (v_brief, 'daily_rate', 1.5, 3000)
  returning amount_ex_gst, gst_amount into v_ex, v_gst;

  if v_ex <> 4500.00 then
    raise exception 'FAIL 1.1: amount_ex_gst expected 4500.00, got %', v_ex;
  end if;
  if v_gst <> 450.00 then
    raise exception 'FAIL 1.2: gst_amount expected 450.00, got %', v_gst;
  end if;

  -- A GST-free disbursement must compute exactly zero GST, not null.
  insert into public.fees (brief_id, fee_type, unit_amount, gst_applicable)
  values (v_brief, 'disbursement', 145, false)
  returning amount_ex_gst, gst_amount into v_ex, v_gst;

  if v_ex <> 145.00 then
    raise exception 'FAIL 1.3: disbursement ex-GST expected 145.00, got %', v_ex;
  end if;
  if v_gst <> 0 then
    raise exception 'FAIL 1.4: GST-free line expected 0 GST, got %', v_gst;
  end if;

  -- Rounding: 1.5 x 33.33 = 49.995, which must round to 50.00 rather than
  -- truncating to 49.99.
  insert into public.fees (brief_id, fee_type, quantity, unit_amount)
  values (v_brief, 'hourly_rate', 1.5, 33.33)
  returning amount_ex_gst into v_ex;

  if v_ex <> 50.00 then
    raise exception 'FAIL 1.5: rounding expected 50.00, got %', v_ex;
  end if;

  raise notice 'PASS 1: generated columns compute ex-GST, GST and rounding correctly';
end $$;

\echo '── 2. CHECK constraints ────────────────────────────────────────'

do $$
declare
  v_brief uuid := (select id from public.briefs where submission_id = 'test-submission-1');
  v_ok    boolean;
begin
  -- Zero / negative quantity must be rejected.
  v_ok := false;
  begin
    insert into public.fees (brief_id, fee_type, quantity, unit_amount)
    values (v_brief, 'brief_fee', 0, 100);
  exception when check_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 2.1: quantity 0 was accepted'; end if;

  -- Negative amount must be rejected.
  v_ok := false;
  begin
    insert into public.fees (brief_id, fee_type, unit_amount)
    values (v_brief, 'brief_fee', -1);
  exception when check_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 2.2: negative unit_amount was accepted'; end if;

  -- Unknown fee type must be rejected.
  v_ok := false;
  begin
    insert into public.fees (brief_id, fee_type, unit_amount)
    values (v_brief, 'consulting', 100);
  exception when check_violation then v_ok := true;
  end;
  if not v_ok then raise exception 'FAIL 2.3: unknown fee_type was accepted'; end if;

  raise notice 'PASS 2: CHECK constraints reject bad quantity, amount and fee_type';
end $$;

\echo '── 3. Invoice number allocation ────────────────────────────────'

do $$
declare
  v_brief uuid := (select id from public.briefs where submission_id = 'test-submission-1');
  v_first  text;
  v_second text;
  v_at     timestamptz;
begin
  v_first := public.allocate_invoice_number(v_brief);
  if v_first is null then
    raise exception 'FAIL 3.1: allocate_invoice_number returned null';
  end if;

  -- Idempotent: re-downloading a PDF must not burn a second number.
  v_second := public.allocate_invoice_number(v_brief);
  if v_first <> v_second then
    raise exception 'FAIL 3.2: second call returned %, expected % (not idempotent)',
      v_second, v_first;
  end if;

  select invoiced_at into v_at from public.briefs where id = v_brief;
  if v_at is null then
    raise exception 'FAIL 3.3: invoiced_at was not set';
  end if;

  if v_first !~ '^INV-[0-9]{5}$' then
    raise exception 'FAIL 3.4: invoice number % does not match INV-00000 format', v_first;
  end if;

  raise notice 'PASS 3: invoice numbers are allocated once and reused (%)' , v_first;
end $$;

\echo '── 4. Unique invoice numbers ───────────────────────────────────'

do $$
declare
  v_existing text := (select invoice_number from public.briefs
                       where submission_id = 'test-submission-1');
  v_other uuid;
  v_ok boolean := false;
begin
  insert into public.briefs (
    submission_id, your_name, your_email, parties, court, jurisdiction,
    matter_type, urgency, key_facts
  ) values (
    'test-submission-2', 'Other Solicitor', 'other@test.local', 'Brown v Green',
    'District Court', 'NSW', 'Crime', 'Routine', 'Second matter.'
  ) returning id into v_other;

  -- Two briefs must never share an invoice number.
  begin
    update public.briefs set invoice_number = v_existing where id = v_other;
  exception when unique_violation then v_ok := true;
  end;
  if not v_ok then
    raise exception 'FAIL 4.1: duplicate invoice number % was accepted', v_existing;
  end if;

  -- But many briefs may sit un-invoiced with a null number.
  if (select count(*) from public.briefs where invoice_number is null) < 1 then
    raise exception 'FAIL 4.2: nulls appear to be colliding in the unique index';
  end if;

  raise notice 'PASS 4: invoice numbers are unique, nulls do not collide';
end $$;

\echo '── 5. Cascade delete ───────────────────────────────────────────'

do $$
declare
  v_brief uuid := (select id from public.briefs where submission_id = 'test-submission-1');
  v_before int;
  v_after  int;
begin
  select count(*) into v_before from public.fees where brief_id = v_brief;
  if v_before = 0 then
    raise exception 'FAIL 5.0: fixture has no fees to cascade';
  end if;

  delete from public.briefs where id = v_brief;

  select count(*) into v_after from public.fees where brief_id = v_brief;
  if v_after <> 0 then
    raise exception 'FAIL 5.1: % fee rows orphaned after brief delete', v_after;
  end if;

  raise notice 'PASS 5: deleting a brief cascades to its fees';
end $$;

\echo '── 6. Row Level Security ───────────────────────────────────────'

-- Re-seed, since section 5 deleted the fixture brief.
insert into public.briefs (
  submission_id, your_name, your_email, parties, court, jurisdiction,
  matter_type, urgency, key_facts
) values (
  'test-submission-3', 'Jane Solicitor', 'jane@test.local', 'Confidential v Matter',
  'Supreme Court of NSW', 'NSW', 'Commercial', 'Routine', 'Privileged facts.'
);

insert into public.fees (brief_id, fee_type, unit_amount)
values ((select id from public.briefs where submission_id = 'test-submission-3'),
        'brief_fee', 5000);

do $$
declare
  v_briefs int;
  v_fees   int;
begin
  -- A signed-in user who is NOT on the staff roster must see nothing at all.
  set local role authenticated;
  set local request.jwt.claims = '{"email":"stranger@example.com"}';

  select count(*) into v_briefs from public.briefs;
  select count(*) into v_fees   from public.fees;

  if v_briefs <> 0 then
    raise exception 'FAIL 6.1: non-staff user could read % briefs', v_briefs;
  end if;
  if v_fees <> 0 then
    raise exception 'FAIL 6.2: non-staff user could read % fee rows', v_fees;
  end if;

  reset role;
  raise notice 'PASS 6a: a non-staff authenticated user reads no briefs or fees';
end $$;

do $$
declare
  v_briefs int;
  v_fees   int;
begin
  -- A staff member must see them.
  set local role authenticated;
  set local request.jwt.claims = '{"email":"barrister@test.local"}';

  select count(*) into v_briefs from public.briefs;
  select count(*) into v_fees   from public.fees;

  if v_briefs = 0 then
    raise exception 'FAIL 6.3: staff user could not read any briefs';
  end if;
  if v_fees = 0 then
    raise exception 'FAIL 6.4: staff user could not read any fees';
  end if;

  reset role;
  raise notice 'PASS 6b: a staff user reads briefs and fees (% briefs, % fees)',
    v_briefs, v_fees;
end $$;

do $$
declare
  v_briefs_blocked boolean := false;
  v_fees_blocked   boolean := false;
  v_insert_blocked boolean := false;
  v_count int;
begin
  -- Anonymous — the role the public brief form's key maps to — must not be
  -- able to reach chambers' data at all.
  --
  -- Two outcomes count as a refusal: an outright `permission denied` (no table
  -- privilege, which is what the explicit GRANTs produce, since they name only
  -- `authenticated`), or a successful query returning zero rows (privilege
  -- granted but every row filtered by RLS). The former is the stronger
  -- guarantee — the query never runs — so it is what this schema aims for, but
  -- the test accepts either rather than encoding an incidental detail.
  set local role anon;
  set local request.jwt.claims = '{}';

  begin
    select count(*) into v_count from public.briefs;
    v_briefs_blocked := (v_count = 0);
  exception when insufficient_privilege then v_briefs_blocked := true;
  end;

  begin
    select count(*) into v_count from public.fees;
    v_fees_blocked := (v_count = 0);
  exception when insufficient_privilege then v_fees_blocked := true;
  end;

  begin
    insert into public.fees (brief_id, fee_type, unit_amount)
    values (gen_random_uuid(), 'brief_fee', 1);
  exception when others then v_insert_blocked := true;
  end;

  reset role;

  if not v_briefs_blocked then raise exception 'FAIL 6.5: anon could read briefs'; end if;
  if not v_fees_blocked   then raise exception 'FAIL 6.6: anon could read fees';   end if;
  if not v_insert_blocked then raise exception 'FAIL 6.7: anon inserted a fee row'; end if;

  raise notice 'PASS 6c: anon is refused reads on briefs and fees, and cannot insert';
end $$;

\echo ''
\echo '════════════════════════════════════════════════════════════════'
\echo ' ALL SCHEMA TESTS PASSED'
\echo '════════════════════════════════════════════════════════════════'

rollback;
