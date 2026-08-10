#!/bin/bash
# End-to-end test of the public share page against the local Supabase stack.
#
# Checks the two things that actually matter for this route:
#   1. a valid token renders the progress summary;
#   2. NOTHING privileged appears in the HTML — the seeded canary strings for
#      key_facts, ai_summary, staff_notes and the solicitor's contact details
#      must be absent;
#   3. revoked, expired, unknown and junk tokens are all refused identically.
set -u
cd /Users/david/SENG/michael/BarristerPortfolio

PORT=3210
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

echo "── building + starting production server on :$PORT ─"
npx next build > /tmp/share-e2e-build.log 2>&1 || { echo "BUILD FAILED"; tail -20 /tmp/share-e2e-build.log; exit 1; }
npx next start -p $PORT > /tmp/share-e2e-server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null' EXIT

for i in $(seq 1 60); do
  curl -s -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null && break
  sleep 1
done
echo "server up (pid $SERVER_PID)"

fetch() { curl -s "http://127.0.0.1:$PORT/share/$1"; }

FAIL=0
check_absent() {  # $1 = html, $2 = canary, $3 = description
  if echo "$1" | grep -q "$2"; then
    echo "  ✗ LEAK: $3 ('$2') appeared in the public page"; FAIL=1
  else
    echo "  ✓ $3 not present"
  fi
}

echo
echo "── 1. valid token ─────────────────────────────────"
HTML=$(fetch 'e2e-valid-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa')
if echo "$HTML" | grep -q "Smith v Jones"; then
  echo "  ✓ renders the matter (Smith v Jones)"
else
  echo "  ✗ did not render the matter"; FAIL=1
fi
echo "$HTML" | grep -q "Accepted" && echo "  ✓ shows status" || { echo "  ✗ no status"; FAIL=1; }

if [ -z "$HTML" ]; then
  echo "  ✗ EMPTY RESPONSE — server not reachable; absence checks below would be vacuous"
  echo "--- server log ---"; tail -20 /tmp/share-e2e-server.log
  exit 1
fi

echo
echo "── 2. privileged data must NOT appear ─────────────"
check_absent "$HTML" "PRIVILEGED-KEY-FACTS-CANARY" "key_facts"
check_absent "$HTML" "AI-SUMMARY-CANARY"           "ai_summary"
check_absent "$HTML" "STAFF-NOTES-CANARY"          "staff_notes"
check_absent "$HTML" "jane@secret.example"         "solicitor email"
check_absent "$HTML" "0400000000"                  "solicitor phone"
check_absent "$HTML" "Solicitor &amp; Co"          "firm name"

echo
echo "── 3. refusals ────────────────────────────────────"
for spec in \
  "e2e-revoked-token-bbbbbbbbbbbbbbbbbbbbbbbbbb|revoked" \
  "e2e-expired-token-cccccccccccccccccccccccc|expired" \
  "e2e-nonexistent-token-zzzzzzzzzzzzzzzzzzzz|unknown" \
  "short|too short"
do
  TOKEN="${spec%%|*}"; DESC="${spec##*|}"
  BODY=$(fetch "$TOKEN")
  if echo "$BODY" | grep -q "This link is not available"; then
    echo "  ✓ $DESC token refused"
  else
    echo "  ✗ $DESC token was NOT refused"; FAIL=1
  fi
  # The refusal must be byte-identical whatever the cause. Comparing the
  # bodies is the real test: the page's generic copy does mention "expired"
  # as one possibility, so grepping for the word proves nothing — what
  # matters is that a revoked token and an unknown one are indistinguishable.
  # Next echoes the requested token back inside its router payload. That is
  # the visitor's own token, not a disclosure, so normalise it out before
  # comparing — what must match is everything else.
  # Compare the rendered <main> only. The surrounding document carries Next's
  # router payload, which necessarily embeds the requested token and so can
  # never be byte-identical across different tokens. What must be
  # indistinguishable is what the visitor is actually shown.
  NORM=$(echo "$BODY" | tr -d '\n' | grep -oE '<main.*</main>' | sed "s/$TOKEN/TOKEN/g")
  if [ -z "${FIRST_REFUSAL:-}" ]; then
    FIRST_REFUSAL="$NORM"
  elif [ "$NORM" != "$FIRST_REFUSAL" ]; then
    echo "  ✗ refusal body DIFFERS from the others — the cause is distinguishable"; FAIL=1
  fi
  # And must never leak the other brief's details.
  echo "$BODY" | grep -q "Brown v Green" && { echo "  ✗ refusal leaked matter name"; FAIL=1; }
done

echo
echo "── 4. must not be indexable ───────────────────────"
if echo "$HTML" | grep -qi 'name="robots"'; then
  echo "  ✓ robots meta present: $(echo "$HTML" | grep -oi '<meta name="robots"[^>]*>' | head -1)"
else
  echo "  ✗ no robots meta tag — shared briefs could be indexed"; FAIL=1
fi

echo
echo "── 5. view tracking ───────────────────────────────"
sleep 1
VIEWS=$(docker exec -i supabase_db_BarristerPortfolio psql -U postgres -d postgres -t -A \
  -c "select view_count from public.brief_shares where token='e2e-valid-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';")
if [ "${VIEWS:-0}" -gt 0 ]; then
  echo "  ✓ view recorded (count = $VIEWS)"
else
  echo "  ✗ view was not recorded (count = ${VIEWS:-unset})"; FAIL=1
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "════ SHARE PAGE E2E PASSED ════"
else
  echo "════ SHARE PAGE E2E FAILED ════"
  echo "--- server log tail ---"; tail -20 /tmp/share-e2e-server.log
fi
exit $FAIL
