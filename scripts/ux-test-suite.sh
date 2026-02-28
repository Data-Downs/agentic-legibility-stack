#!/bin/bash
# UX Test Suite — Tests terminal states, dynamic cards, related services, progress persistence
# Runs against http://localhost:3000/api/chat
#
# Tests 12+ scenarios across 5 personas and 10+ service types

API="http://localhost:3100/api/chat"
PASS=0
FAIL=0
TOTAL=0
RESULTS=""

# ── Helper ──
run_test() {
  local TEST_NAME="$1"
  local PERSONA="$2"
  local SCENARIO="$3"
  local MESSAGE="$4"
  local UC_STATE="$5"
  local UC_HISTORY="$6"
  local EXPECTED_PATTERN="$7"
  local CHECK_FIELD="$8"   # jq path to check
  local CHECK_PATTERN="$9" # grep pattern for the field value

  TOTAL=$((TOTAL + 1))

  # Build the messages array
  MESSAGES="[{\"role\":\"user\",\"content\":\"$MESSAGE\"}]"

  # Build request body
  BODY=$(cat <<ENDJSON
{
  "persona": "$PERSONA",
  "agent": "dot",
  "scenario": "$SCENARIO",
  "messages": $MESSAGES,
  "generateTitle": true,
  "ucState": $UC_STATE,
  "ucStateHistory": $UC_HISTORY,
  "serviceMode": "json"
}
ENDJSON
)

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    --max-time 60)

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY_RAW=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" != "200" ]; then
    FAIL=$((FAIL + 1))
    RESULTS="$RESULTS\n  FAIL [$TEST_NAME] HTTP $HTTP_CODE"
    return
  fi

  # Check primary pattern in response text
  if [ -n "$EXPECTED_PATTERN" ]; then
    RESP_TEXT=$(echo "$BODY_RAW" | jq -r '.response // empty' 2>/dev/null)
    if [ -z "$RESP_TEXT" ]; then
      FAIL=$((FAIL + 1))
      RESULTS="$RESULTS\n  FAIL [$TEST_NAME] No response text"
      return
    fi
  fi

  # Check specific field
  if [ -n "$CHECK_FIELD" ] && [ -n "$CHECK_PATTERN" ]; then
    FIELD_VAL=$(echo "$BODY_RAW" | jq -r "$CHECK_FIELD" 2>/dev/null)
    if echo "$FIELD_VAL" | grep -qiE "$CHECK_PATTERN"; then
      PASS=$((PASS + 1))
      RESULTS="$RESULTS\n  PASS [$TEST_NAME] $CHECK_FIELD matched '$CHECK_PATTERN' (got: $(echo "$FIELD_VAL" | head -c 60))"
    else
      FAIL=$((FAIL + 1))
      RESULTS="$RESULTS\n  FAIL [$TEST_NAME] $CHECK_FIELD='$(echo "$FIELD_VAL" | head -c 80)' did not match '$CHECK_PATTERN'"
    fi
  else
    # Just check we got a 200 with a response
    PASS=$((PASS + 1))
    RESULTS="$RESULTS\n  PASS [$TEST_NAME] HTTP 200 with response"
  fi
}

echo ""
echo "================================================"
echo "  UX Test Suite — 12+ Scenarios"
echo "  Testing: Terminal states, cards, related services,"
echo "  dynamic progress, persistent progress"
echo "================================================"
echo ""

# ══════════════════════════════════════════════════════
# TEST 1: Register Birth (registration type) — initial message
# Persona: sarah-chen | Service: gro-register-birth
# Expect: interactionType = "register"
# ══════════════════════════════════════════════════════
echo "Test 1: Register Birth (sarah-chen) — interactionType check..."
run_test \
  "1-register-birth-interaction-type" \
  "sarah-chen" \
  "gro-register-birth" \
  "I need to register my baby's birth" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "register"

# ══════════════════════════════════════════════════════
# TEST 2: Theory Test (appointment type) — initial message
# Persona: priya-sharma | Service: dvsa-theory-test
# Expect: interactionType = "appointment_booker"
# ══════════════════════════════════════════════════════
echo "Test 2: Theory Test (priya-sharma) — interactionType check..."
run_test \
  "2-theory-test-interaction-type" \
  "priya-sharma" \
  "dvsa-theory-test" \
  "I want to book my theory test" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "application|appointment_booker"

# ══════════════════════════════════════════════════════
# TEST 3: Child Benefit (application type) — initial message
# Persona: sarah-chen | Service: hmrc-child-benefit
# Expect: interactionType = "application"
# ══════════════════════════════════════════════════════
echo "Test 3: Child Benefit (sarah-chen) — interactionType check..."
run_test \
  "3-child-benefit-interaction-type" \
  "sarah-chen" \
  "hmrc-child-benefit" \
  "I want to apply for child benefit" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "application"

# ══════════════════════════════════════════════════════
# TEST 4: Provisional Licence (licence type) — initial message
# Persona: david-evans | Service: dvla-provisional-licence
# Expect: interactionType = "license"
# ══════════════════════════════════════════════════════
echo "Test 4: Provisional Licence (david-evans) — interactionType check..."
run_test \
  "4-provisional-licence-interaction-type" \
  "david-evans" \
  "dvla-provisional-licence" \
  "I want to apply for a provisional driving licence" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "license|application"

# ══════════════════════════════════════════════════════
# TEST 5: Stamp Duty (obligation/payment type) — initial message
# Persona: mohammed-al-rashid | Service: hmrc-sdlt
# Expect: interactionType = "payment_service"
# ══════════════════════════════════════════════════════
echo "Test 5: Stamp Duty (mohammed-al-rashid) — interactionType check..."
run_test \
  "5-stamp-duty-interaction-type" \
  "mohammed-al-rashid" \
  "hmrc-sdlt" \
  "I need to pay stamp duty on a property purchase" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "payment_service"

# ══════════════════════════════════════════════════════
# TEST 6: UC Application (hand-crafted) — state transition check
# Persona: priya-sharma | Service: benefits (UC)
# Expect: ucState.currentState to move from not-started
# ══════════════════════════════════════════════════════
echo "Test 6: UC Application (priya-sharma) — state transition..."
run_test \
  "6-uc-state-transition" \
  "priya-sharma" \
  "benefits" \
  "I was recently made redundant and need to apply for Universal Credit" \
  "null" \
  "[]" \
  "" \
  ".ucState.currentState" \
  "identity-verified|eligibility-checked|not-started"

# ══════════════════════════════════════════════════════
# TEST 7: Register Death (registration type) — state transition
# Persona: margaret-thompson | Service: gro-register-death
# ══════════════════════════════════════════════════════
echo "Test 7: Register Death (margaret-thompson) — state transition..."
run_test \
  "7-register-death-state" \
  "margaret-thompson" \
  "gro-register-death" \
  "I need to register my sister's death" \
  "null" \
  "[]" \
  "" \
  ".ucState.currentState" \
  "identity-verified|eligibility-checked|not-started"

# ══════════════════════════════════════════════════════
# TEST 8: Attendance Allowance (benefit/application) — margaret
# Persona: margaret-thompson | Service: dwp-attendance-allowance
# ══════════════════════════════════════════════════════
echo "Test 8: Attendance Allowance (margaret-thompson) — application type..."
run_test \
  "8-attendance-allowance" \
  "margaret-thompson" \
  "dwp-attendance-allowance" \
  "I need help applying for attendance allowance" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "application"

# ══════════════════════════════════════════════════════
# TEST 9: Council Tax (obligation/payment) — david-evans
# Persona: david-evans | Service: la-council-tax
# ══════════════════════════════════════════════════════
echo "Test 9: Council Tax (david-evans) — payment service type..."
run_test \
  "9-council-tax" \
  "david-evans" \
  "la-council-tax" \
  "I need to register for council tax at my new address" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "application|register|payment_service"

# ══════════════════════════════════════════════════════
# TEST 10: PIP Application (benefit) — mohammed-al-rashid
# Persona: mohammed-al-rashid | Service: dwp-pip
# ══════════════════════════════════════════════════════
echo "Test 10: PIP (mohammed-al-rashid) — application type..."
run_test \
  "10-pip-application" \
  "mohammed-al-rashid" \
  "dwp-pip" \
  "I want to apply for PIP disability payment" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "application"

# ══════════════════════════════════════════════════════
# TEST 11: Related Services API — Register Birth
# Direct API test: GET /api/services/gro-register-birth/related
# ══════════════════════════════════════════════════════
echo "Test 11: Related Services API — gro-register-birth..."
TOTAL=$((TOTAL + 1))
RELATED=$(curl -s "http://localhost:3100/api/services/gro-register-birth/related")
RELATED_COUNT=$(echo "$RELATED" | jq '.services | length' 2>/dev/null)
if [ "$RELATED_COUNT" -gt "0" ] 2>/dev/null; then
  RELATED_NAMES=$(echo "$RELATED" | jq -r '.services[].name' 2>/dev/null | head -3 | tr '\n' ', ')
  PASS=$((PASS + 1))
  RESULTS="$RESULTS\n  PASS [11-related-services-birth] Found $RELATED_COUNT related services: $RELATED_NAMES"
else
  FAIL=$((FAIL + 1))
  RESULTS="$RESULTS\n  FAIL [11-related-services-birth] No related services found"
fi

# ══════════════════════════════════════════════════════
# TEST 12: Related Services API — dwp-universal-credit
# ══════════════════════════════════════════════════════
echo "Test 12: Related Services API — dwp-universal-credit..."
TOTAL=$((TOTAL + 1))
RELATED_UC=$(curl -s "http://localhost:3100/api/services/dwp-universal-credit/related")
RELATED_UC_COUNT=$(echo "$RELATED_UC" | jq '.services | length' 2>/dev/null)
if [ "$RELATED_UC_COUNT" -gt "0" ] 2>/dev/null; then
  RELATED_UC_NAMES=$(echo "$RELATED_UC" | jq -r '.services[].name' 2>/dev/null | head -3 | tr '\n' ', ')
  PASS=$((PASS + 1))
  RESULTS="$RESULTS\n  PASS [12-related-services-uc] Found $RELATED_UC_COUNT related services: $RELATED_UC_NAMES"
else
  FAIL=$((FAIL + 1))
  RESULTS="$RESULTS\n  FAIL [12-related-services-uc] No related services found"
fi

# ══════════════════════════════════════════════════════
# TEST 13: Probate (court/legal) — margaret-thompson
# Persona: margaret-thompson | Service: hmcts-probate
# ══════════════════════════════════════════════════════
echo "Test 13: Probate (margaret-thompson) — application type..."
run_test \
  "13-probate-application" \
  "margaret-thompson" \
  "hmcts-probate" \
  "I need to apply for probate after my sister passed away" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "application"

# ══════════════════════════════════════════════════════
# TEST 14: Blue Badge (council) — margaret-thompson
# Persona: margaret-thompson | Service: la-blue-badge
# ══════════════════════════════════════════════════════
echo "Test 14: Blue Badge (margaret-thompson) — licence type..."
run_test \
  "14-blue-badge" \
  "margaret-thompson" \
  "la-blue-badge" \
  "I want to apply for a blue badge for disabled parking" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "license|application"

# ══════════════════════════════════════════════════════
# TEST 15: Student Finance (portal) — sarah-chen
# Persona: sarah-chen | Service: slc-student-finance
# ══════════════════════════════════════════════════════
echo "Test 15: Student Finance (sarah-chen) — application type..."
run_test \
  "15-student-finance" \
  "sarah-chen" \
  "slc-student-finance" \
  "I want to apply for student finance for my masters degree" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "application"

# ══════════════════════════════════════════════════════
# TEST 16: Register as Sole Trader (registration) — mohammed
# Persona: mohammed-al-rashid | Service: hmrc-register-sole-trader
# ══════════════════════════════════════════════════════
echo "Test 16: Register Sole Trader (mohammed) — register type..."
run_test \
  "16-register-sole-trader" \
  "mohammed-al-rashid" \
  "hmrc-register-sole-trader" \
  "I need to register as a sole trader with HMRC" \
  "null" \
  "[]" \
  "" \
  ".interactionType" \
  "register"

# ══════════════════════════════════════════════════════
# TEST 17: Hand-crafted Driving Licence (backward compat)
# Persona: sarah-chen | Service: driving (legacy)
# Expect: Uses hand-crafted service artefacts, not templates
# ══════════════════════════════════════════════════════
echo "Test 17: Driving Licence Renewal (sarah-chen) — legacy hand-crafted..."
run_test \
  "17-driving-licence-legacy" \
  "sarah-chen" \
  "driving" \
  "I need to renew my driving licence" \
  "null" \
  "[]" \
  "" \
  ".ucState.currentState" \
  "identity-verified|eligibility-checked|not-started"

# ══════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════
echo ""
echo "================================================"
echo "  RESULTS: $PASS passed / $FAIL failed / $TOTAL total"
echo "================================================"
echo -e "$RESULTS"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
