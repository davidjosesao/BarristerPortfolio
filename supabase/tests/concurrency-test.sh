#!/bin/bash
# Verifies the claim in commit 2b209f1: that SELECT ... FOR UPDATE inside
# allocate_invoice_number() serialises concurrent callers, so two fast clicks
# cannot bill the same matter twice under different numbers.
#
# Each `docker exec psql -c` runs as its own autocommit transaction, so this is
# a genuine test of N independent clients racing for the same brief.
set -u
DB=supabase_db_BarristerPortfolio
PARALLEL=8

q() { docker exec -i "$DB" psql -U postgres -d postgres -t -A -c "$1"; }

echo "── setup ──────────────────────────────────────────"
q "delete from public.briefs where submission_id = 'concurrency-test';" >/dev/null
q "insert into public.briefs (submission_id, your_name, your_email, parties,
     court, jurisdiction, matter_type, urgency, key_facts)
   values ('concurrency-test','J','j@t.local','Race v Condition',
           'SCNSW','NSW','Commercial','Routine','x');" >/dev/null

BID=$(q "select id from public.briefs where submission_id = 'concurrency-test';")
SEQ_BEFORE=$(q "select last_value from public.invoice_number_seq;")
echo "brief id       : $BID"
echo "sequence before: $SEQ_BEFORE"

echo
echo "── firing $PARALLEL concurrent allocations ─────────────"
OUT=$(mktemp -d)
for i in $(seq 1 $PARALLEL); do
  ( q "select public.allocate_invoice_number('$BID');" > "$OUT/$i" ) &
done
wait

RESULTS=$(cat "$OUT"/* | tr -d ' ' | grep -v '^$' | sort)
echo "$RESULTS" | sort | uniq -c

DISTINCT=$(echo "$RESULTS" | sort -u | wc -l | tr -d ' ')
COUNT=$(echo "$RESULTS" | wc -l | tr -d ' ')
SEQ_AFTER=$(q "select last_value from public.invoice_number_seq;")

echo
echo "── results ────────────────────────────────────────"
echo "calls returning a number : $COUNT / $PARALLEL"
echo "distinct numbers issued  : $DISTINCT"
echo "sequence after           : $SEQ_AFTER (advanced by $((SEQ_AFTER - SEQ_BEFORE)))"

FAIL=0
[ "$COUNT" -eq "$PARALLEL" ] || { echo "FAIL: only $COUNT of $PARALLEL calls returned"; FAIL=1; }
[ "$DISTINCT" -eq 1 ] || { echo "FAIL: $DISTINCT distinct numbers — the matter was billed more than once"; FAIL=1; }
[ $((SEQ_AFTER - SEQ_BEFORE)) -le 1 ] || { echo "FAIL: sequence advanced by $((SEQ_AFTER - SEQ_BEFORE)), numbers were burned"; FAIL=1; }

echo
if [ "$FAIL" -eq 0 ]; then
  echo "PASS: $PARALLEL concurrent callers all received the same invoice number,"
  echo "      and exactly one number was consumed from the sequence."
else
  echo "CONCURRENCY TEST FAILED"
fi

echo
echo "── cleanup ────────────────────────────────────────"
q "delete from public.briefs where submission_id = 'concurrency-test';" >/dev/null
rm -rf "$OUT"
echo "done"
exit $FAIL
