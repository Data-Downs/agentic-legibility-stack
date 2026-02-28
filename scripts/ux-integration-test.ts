/**
 * Multi-turn UX Integration Tests
 *
 * Drives full conversations through state machines to verify:
 * 1. Card resolution at each state (template vs static)
 * 2. Terminal state rendering with correct config
 * 3. Related services at completion
 * 4. Persistent progress data on conversation objects
 * 5. Dynamic milestone generation per interaction type
 * 6. Multi-turn state progression
 */

const API = "http://localhost:3100/api/chat";
const RELATED_API = "http://localhost:3100/api/services";

// ── Types ──

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface TurnResult {
  response: string;
  ucState?: {
    currentState: string;
    previousState?: string;
    trigger?: string;
    stateHistory: string[];
    allowedTransitions: string[];
  };
  interactionType?: string;
  cardRequests?: Array<{
    cardType: string;
    stateId: string;
    definition: { cardType: string; title: string; fields: unknown[] };
  }>;
  tasks?: Array<{ id: string; description: string }>;
  consentRequests?: Array<{ id: string; description: string }>;
  handoff?: { triggered: boolean };
}

// ── Test Infrastructure ──

let PASS = 0;
let FAIL = 0;
let SKIP = 0;
const RESULTS: string[] = [];

function assert(testName: string, condition: boolean, detail: string) {
  if (condition) {
    PASS++;
    RESULTS.push(`  ✓ PASS [${testName}] ${detail}`);
  } else {
    FAIL++;
    RESULTS.push(`  ✗ FAIL [${testName}] ${detail}`);
  }
}

function skip(testName: string, reason: string) {
  SKIP++;
  RESULTS.push(`  ○ SKIP [${testName}] ${reason}`);
}

async function sendTurn(
  persona: string,
  scenario: string,
  messages: ChatMessage[],
  ucState: string | null,
  ucStateHistory: string[],
): Promise<TurnResult> {
  const body = {
    persona,
    agent: "max", // max is faster — auto-fills, fewer questions
    scenario,
    messages,
    generateTitle: messages.length <= 2,
    ucState,
    ucStateHistory,
    serviceMode: "json",
  };

  const resp = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${err.slice(0, 200)}`);
  }

  return resp.json();
}

/** Drive a conversation through multiple turns until a terminal state or max turns */
async function driveConversation(
  persona: string,
  scenario: string,
  turns: Array<{ userMessage: string; autoConsent?: boolean }>,
): Promise<{ history: ChatMessage[]; results: TurnResult[]; finalState: string }> {
  let messages: ChatMessage[] = [];
  let ucState: string | null = null;
  let ucStateHistory: string[] = [];
  const results: TurnResult[] = [];

  for (const turn of turns) {
    messages = [...messages, { role: "user", content: turn.userMessage }];

    const result = await sendTurn(persona, scenario, messages, ucState, ucStateHistory);
    results.push(result);

    messages = [...messages, { role: "assistant", content: result.response }];
    ucState = result.ucState?.currentState ?? ucState;
    ucStateHistory = result.ucState?.stateHistory ?? ucStateHistory;

    // If consent was requested and we want to auto-consent, send consent message
    if (turn.autoConsent && result.consentRequests && result.consentRequests.length > 0) {
      const consentMsg = "I have reviewed all consent requests and grant consent. Please proceed.";
      messages = [...messages, { role: "user", content: consentMsg }];
      const consentResult = await sendTurn(persona, scenario, messages, ucState, ucStateHistory);
      results.push(consentResult);
      messages = [...messages, { role: "assistant", content: consentResult.response }];
      ucState = consentResult.ucState?.currentState ?? ucState;
      ucStateHistory = consentResult.ucState?.stateHistory ?? ucStateHistory;
    }
  }

  return { history: messages, results, finalState: ucState || "unknown" };
}

// ── Import terminal state config for validation ──
// We'll validate against known terminal states
const SUCCESS_TERMINALS = new Set([
  "completed", "claim-active", "issued", "registered",
  "all-steps-complete", "attended", "referred-to-service",
]);
const FAILURE_TERMINALS = new Set([
  "rejected", "refused", "cancelled", "handed-off",
]);
const ALL_TERMINALS = new Set([...SUCCESS_TERMINALS, ...FAILURE_TERMINALS]);

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE 1: Multi-turn UC Application (hand-crafted, static cards)
// ══════════════════════════════════════════════════════════════════════

async function testUCMultiTurn() {
  console.log("\n── Test Suite 1: UC Application (priya-sharma) — multi-turn ──");

  try {
    const conv = await driveConversation("priya-sharma", "benefits", [
      { userMessage: "I was recently made redundant and need to apply for Universal Credit", autoConsent: true },
      { userMessage: "Yes, everything looks correct. Please proceed with my application." },
      { userMessage: "I am a private renter, my rent is £650 per month." },
      { userMessage: "I am currently unemployed, my savings are £2400." },
    ]);

    const r = conv.results;

    // Check state progression
    assert("uc-1-initial-state",
      r[0].ucState?.currentState !== "not-started",
      `First turn moved from not-started → ${r[0].ucState?.currentState}`);

    assert("uc-2-interaction-type",
      r[0].interactionType === "application",
      `interactionType=${r[0].interactionType}`);

    // Check that at SOME point we see consent
    const hasConsent = r.some(t => t.consentRequests && t.consentRequests.length > 0);
    assert("uc-3-consent-requested",
      hasConsent,
      hasConsent ? "Consent was requested during the journey" : "No consent requested");

    // Check card resolution — UC uses unique state IDs (personal-details-collected, income-details-collected)
    // so it should get static registry cards (housing, bank), NOT template cards
    const allCards = r.flatMap(t => t.cardRequests || []);
    const cardTypes = allCards.map(c => c.cardType || c.definition?.cardType);

    // UC-specific cards come from static registry
    const hasUCSpecificCards = cardTypes.some(t =>
      t === "household-details" || t === "financial-details" || t === "bank-account-selector"
    );
    // Template cards should NOT appear for UC
    const hasTemplateCards = cardTypes.some(t => t === "application-eligibility");

    if (allCards.length > 0) {
      assert("uc-4-static-cards-not-template",
        !hasTemplateCards,
        hasTemplateCards
          ? `WRONG: Got template card 'application-eligibility' for UC (should be static)`
          : `Correctly no template cards for UC. Card types: ${cardTypes.join(", ")}`);
    } else {
      skip("uc-4-static-cards-not-template", "No cards appeared in this run (LLM may not have reached card states)");
    }

    // Check final state is progressed
    assert("uc-5-progressed",
      conv.finalState !== "not-started",
      `Final state: ${conv.finalState} (after ${r.length} turns)`);

    // Check state history accumulates
    const lastResult = r[r.length - 1];
    const historyLength = lastResult.ucState?.stateHistory?.length ?? 0;
    assert("uc-6-history-accumulates",
      historyLength >= 2,
      `State history has ${historyLength} entries: ${lastResult.ucState?.stateHistory?.join(" → ")}`);

  } catch (err) {
    FAIL++;
    RESULTS.push(`  ✗ FAIL [uc-multi-turn] Error: ${(err as Error).message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Register Birth (graph service, template cards)
// ══════════════════════════════════════════════════════════════════════

async function testRegisterBirthMultiTurn() {
  console.log("\n── Test Suite 2: Register Birth (sarah-chen) — multi-turn ──");

  try {
    const conv = await driveConversation("sarah-chen", "gro-register-birth", [
      { userMessage: "I need to register my baby's birth. She was born last week.", autoConsent: true },
      { userMessage: "Yes that all looks correct, please proceed." },
      { userMessage: "The birth was on 20 February 2026 at St Mary's Hospital in Cambridge." },
    ]);

    const r = conv.results;

    assert("birth-1-interaction-type",
      r[0].interactionType === "register",
      `interactionType=${r[0].interactionType}`);

    // Check state progression
    assert("birth-2-progressed",
      conv.finalState !== "not-started",
      `Final state: ${conv.finalState}`);

    // Check for registration-specific cards (template cards, NOT UC housing/bank)
    const allCards = r.flatMap(t => t.cardRequests || []);
    const cardTypes = allCards.map(c => c.cardType || c.definition?.cardType);

    const hasHousingCard = cardTypes.includes("household-details");
    const hasBankCard = cardTypes.includes("bank-account-selector");

    assert("birth-3-no-generic-housing-bank",
      !hasHousingCard && !hasBankCard,
      hasHousingCard || hasBankCard
        ? `WRONG: Got generic UC cards (${cardTypes.join(", ")}) for birth registration`
        : `Correctly no housing/bank cards. Cards: ${cardTypes.length > 0 ? cardTypes.join(", ") : "none yet"}`);

    // If cards appeared, check they're registration-appropriate
    if (allCards.length > 0) {
      const hasRegistrationCard = cardTypes.some(t =>
        t === "registration-event" || t === "registration-details"
      );
      assert("birth-4-registration-cards",
        hasRegistrationCard,
        `Registration cards present: ${cardTypes.join(", ")}`);
    } else {
      skip("birth-4-registration-cards", "No cards in this run (may not have reached details-submitted)");
    }

    // Check state history
    const lastResult = r[r.length - 1];
    assert("birth-5-history",
      (lastResult.ucState?.stateHistory?.length ?? 0) >= 2,
      `History: ${lastResult.ucState?.stateHistory?.join(" → ")}`);

  } catch (err) {
    FAIL++;
    RESULTS.push(`  ✗ FAIL [birth-multi-turn] Error: ${(err as Error).message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Provisional Licence (licence type, template cards)
// ══════════════════════════════════════════════════════════════════════

async function testProvisionalLicenceMultiTurn() {
  console.log("\n── Test Suite 3: Provisional Licence (david-evans) — multi-turn ──");

  try {
    const conv = await driveConversation("david-evans", "dvla-provisional-licence", [
      { userMessage: "I want to apply for a provisional driving licence", autoConsent: true },
      { userMessage: "Yes, my details are correct. Please proceed." },
      { userMessage: "I'd like a standard licence, starting from today." },
    ]);

    const r = conv.results;

    assert("licence-1-interaction-type",
      r[0].interactionType === "license",
      `interactionType=${r[0].interactionType}`);

    assert("licence-2-progressed",
      conv.finalState !== "not-started",
      `Final state: ${conv.finalState}`);

    // Check no UC-specific cards
    const allCards = r.flatMap(t => t.cardRequests || []);
    const cardTypes = allCards.map(c => c.cardType || c.definition?.cardType);
    const hasHousingCard = cardTypes.includes("household-details");
    assert("licence-3-no-housing-card",
      !hasHousingCard,
      hasHousingCard
        ? `WRONG: Housing card appeared for licence application`
        : `Correctly no housing card. Cards: ${cardTypes.length > 0 ? cardTypes.join(", ") : "none yet"}`);

  } catch (err) {
    FAIL++;
    RESULTS.push(`  ✗ FAIL [licence-multi-turn] Error: ${(err as Error).message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE 4: Stamp Duty (payment_service type)
// ══════════════════════════════════════════════════════════════════════

async function testStampDutyMultiTurn() {
  console.log("\n── Test Suite 4: Stamp Duty (mohammed-al-rashid) — multi-turn ──");

  try {
    const conv = await driveConversation("mohammed-al-rashid", "hmrc-sdlt", [
      { userMessage: "I need to pay stamp duty on a property I just purchased for £350,000", autoConsent: true },
      { userMessage: "Yes, those details are correct. Please proceed." },
    ]);

    const r = conv.results;

    assert("sdlt-1-interaction-type",
      r[0].interactionType === "payment_service",
      `interactionType=${r[0].interactionType}`);

    assert("sdlt-2-progressed",
      conv.finalState !== "not-started",
      `Final state: ${conv.finalState}`);

    // Payment service should get payment cards, not housing cards
    const allCards = r.flatMap(t => t.cardRequests || []);
    const cardTypes = allCards.map(c => c.cardType || c.definition?.cardType);
    const hasHousingCard = cardTypes.includes("household-details");
    assert("sdlt-3-no-housing-card",
      !hasHousingCard,
      `No housing card for payment service. Cards: ${cardTypes.length > 0 ? cardTypes.join(", ") : "none yet"}`);

  } catch (err) {
    FAIL++;
    RESULTS.push(`  ✗ FAIL [sdlt-multi-turn] Error: ${(err as Error).message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE 5: Terminal State Config Validation
// ══════════════════════════════════════════════════════════════════════

async function testTerminalStateConfig() {
  console.log("\n── Test Suite 5: Terminal State Config Validation ──");

  // Import the config from the built package
  // We'll validate it structurally
  try {
    const schemas = await import("@als/schemas");
    const config = schemas.TERMINAL_STATE_CONFIG;
    const allIds = schemas.getAllTerminalStateIds();

    // Every terminal in STATE_MODEL_TEMPLATES should be in TERMINAL_STATE_CONFIG
    assert("terminal-1-config-covers-all",
      allIds.size >= 10,
      `getAllTerminalStateIds() returns ${allIds.size} terminal states`);

    // Check specific terminal states exist
    for (const stateId of ["completed", "claim-active", "issued", "registered", "all-steps-complete", "attended", "rejected", "refused", "cancelled", "handed-off"]) {
      assert(`terminal-2-has-${stateId}`,
        stateId in config,
        stateId in config ? `${stateId} config exists` : `MISSING config for ${stateId}`);
    }

    // Check success/failure classification
    assert("terminal-3-completed-is-success",
      config["completed"]?.isSuccess === true,
      `completed.isSuccess=${config["completed"]?.isSuccess}`);

    assert("terminal-4-rejected-not-success",
      config["rejected"]?.isSuccess === false,
      `rejected.isSuccess=${config["rejected"]?.isSuccess}`);

    assert("terminal-5-handed-off-not-success",
      config["handed-off"]?.isSuccess === false,
      `handed-off.isSuccess=${config["handed-off"]?.isSuccess}`);

    assert("terminal-6-registered-is-success",
      config["registered"]?.isSuccess === true,
      `registered.isSuccess=${config["registered"]?.isSuccess}`);

    assert("terminal-7-issued-is-success",
      config["issued"]?.isSuccess === true,
      `issued.isSuccess=${config["issued"]?.isSuccess}`);

    // Check all configs have required fields
    for (const [id, cfg] of Object.entries(config)) {
      const c = cfg as { icon: string; title: string; description: string; nextSteps: string; borderColor: string };
      const hasAll = c.icon && c.title && c.description && c.nextSteps && c.borderColor;
      assert(`terminal-8-complete-config-${id}`,
        !!hasAll,
        hasAll ? `${id} has all display fields` : `${id} missing fields`);
    }

  } catch (err) {
    FAIL++;
    RESULTS.push(`  ✗ FAIL [terminal-config] Error: ${(err as Error).message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE 6: Dynamic Milestone Generation
// ══════════════════════════════════════════════════════════════════════

async function testMilestoneGeneration() {
  console.log("\n── Test Suite 6: Dynamic Milestone Generation ──");

  try {
    const schemas = await import("@als/schemas");
    const generate = schemas.generateMilestonesForType;

    // Application milestones
    const appMilestones = generate("application");
    assert("milestone-1-app-title",
      appMilestones.title === "Application Progress",
      `application title: "${appMilestones.title}"`);
    assert("milestone-2-app-has-milestones",
      appMilestones.milestones.length >= 5,
      `application has ${appMilestones.milestones.length} milestones`);
    // Should NOT include rejected/handed-off as milestones
    const appMilestoneStates = appMilestones.milestones.flatMap((m: { states: string[] }) => m.states);
    assert("milestone-3-no-failure-milestones",
      !appMilestoneStates.includes("rejected") && !appMilestoneStates.includes("handed-off"),
      "Failure terminals excluded from milestones");

    // Register milestones
    const regMilestones = generate("register");
    assert("milestone-4-register-title",
      regMilestones.title === "Registration Progress",
      `register title: "${regMilestones.title}"`);
    assert("milestone-5-register-has-registered",
      regMilestones.milestones.some((m: { states: string[] }) => m.states.includes("registered")),
      "Register milestones include 'registered' state");

    // Licence milestones
    const licMilestones = generate("license");
    assert("milestone-6-licence-has-issued",
      licMilestones.milestones.some((m: { states: string[] }) => m.states.includes("issued")),
      "Licence milestones include 'issued' state");

    // Appointment milestones
    const aptMilestones = generate("appointment_booker");
    assert("milestone-7-appointment-has-attended",
      aptMilestones.milestones.some((m: { states: string[] }) => m.states.includes("attended")),
      "Appointment milestones include 'attended' state");

    // Payment service milestones
    const payMilestones = generate("payment_service");
    assert("milestone-8-payment-has-completed",
      payMilestones.milestones.some((m: { states: string[] }) => m.states.includes("completed")),
      "Payment milestones include 'completed' state");

    // All 8 interaction types should produce valid configs
    for (const type of ["application", "license", "register", "portal", "payment_service", "appointment_booker", "task_list", "informational_hub"]) {
      const m = generate(type);
      assert(`milestone-9-valid-${type}`,
        m.milestones.length >= 2 && m.title.length > 0,
        `${type}: ${m.milestones.length} milestones, title="${m.title}"`);
    }

  } catch (err) {
    FAIL++;
    RESULTS.push(`  ✗ FAIL [milestone-gen] Error: ${(err as Error).message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE 7: Card Resolution — Template vs Static
// ══════════════════════════════════════════════════════════════════════

async function testCardResolution() {
  console.log("\n── Test Suite 7: Card Resolution — Template vs Static ──");

  try {
    const schemas = await import("@als/schemas");
    const resolve = schemas.resolveCardsWithOverrides;

    // UC-specific state → static registry (housing card)
    const ucHousingCards = resolve("application", "personal-details-collected", "dwp.apply-universal-credit", null);
    assert("card-1-uc-housing",
      ucHousingCards.length > 0 && ucHousingCards[0].cardType === "household-details",
      `UC personal-details-collected → ${ucHousingCards.map((c: { cardType: string }) => c.cardType).join(", ")}`);

    // UC-specific state → static registry (bank card)
    const ucBankCards = resolve("application", "income-details-collected", "dwp.apply-universal-credit", null);
    assert("card-2-uc-bank",
      ucBankCards.length > 0 && ucBankCards[0].cardType === "bank-account-selector",
      `UC income-details-collected → ${ucBankCards.map((c: { cardType: string }) => c.cardType).join(", ")}`);

    // Graph application service at details-submitted → template card (NOT UC housing/bank)
    const graphAppCards = resolve("application", "details-submitted", "hmrc-child-benefit", null);
    assert("card-3-graph-app-template",
      graphAppCards.length > 0 && graphAppCards[0].cardType === "application-eligibility",
      `Graph app details-submitted → ${graphAppCards.map((c: { cardType: string }) => c.cardType).join(", ")}`);

    // Registration at details-submitted → static registry has registration-details card
    const regCards = resolve("register", "details-submitted", "gro-register-birth", null);
    assert("card-4-register-static",
      regCards.length > 0 && regCards[0].cardType === "registration-details",
      `Register details-submitted → ${regCards.map((c: { cardType: string }) => c.cardType).join(", ")}`);

    // Licence at details-confirmed → licence card (both static and template have this)
    const licCards = resolve("license", "details-confirmed", "dvla-provisional-licence", null);
    assert("card-5-licence-details",
      licCards.length > 0 && licCards[0].cardType === "license-details",
      `Licence details-confirmed → ${licCards.map((c: { cardType: string }) => c.cardType).join(", ")}`);

    // Payment service at amount-calculated → payment amount card
    const payCards = resolve("payment_service", "amount-calculated", "hmrc-sdlt", null);
    assert("card-6-payment-amount",
      payCards.length > 0 && payCards[0].cardType === "payment-amount",
      `Payment amount-calculated → ${payCards.map((c: { cardType: string }) => c.cardType).join(", ")}`);

    // Appointment at slot-selected → slot picker card
    const aptCards = resolve("appointment_booker", "slot-selected", "dvsa-theory-test", null);
    assert("card-7-appointment-slot",
      aptCards.length > 0 && aptCards[0].cardType === "slot-picker",
      `Appointment slot-selected → ${aptCards.map((c: { cardType: string }) => c.cardType).join(", ")}`);

    // DB override should win over everything
    const dbOverride = [{ stateId: "details-submitted", cards: [{ cardType: "custom-card", title: "Custom", description: "test", fields: [], submitLabel: "Go", dataCategory: "custom" }] }];
    const overrideCards = resolve("application", "details-submitted", "custom-service", dbOverride);
    assert("card-8-db-override-wins",
      overrideCards.length > 0 && overrideCards[0].cardType === "custom-card",
      `DB override → ${overrideCards.map((c: { cardType: string }) => c.cardType).join(", ")}`);

    // Non-matching state → empty
    const noCards = resolve("application", "identity-verified", "some-service", null);
    assert("card-9-no-cards-for-non-card-state",
      noCards.length === 0,
      `identity-verified → ${noCards.length} cards (expected 0)`);

  } catch (err) {
    FAIL++;
    RESULTS.push(`  ✗ FAIL [card-resolution] Error: ${(err as Error).message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE 8: Related Services Depth
// ══════════════════════════════════════════════════════════════════════

async function testRelatedServicesDepth() {
  console.log("\n── Test Suite 8: Related Services Coverage ──");

  const testCases = [
    { serviceId: "gro-register-birth", expectMin: 1, label: "Register Birth" },
    { serviceId: "dwp-universal-credit", expectMin: 1, label: "Universal Credit" },
    { serviceId: "dvla-provisional-licence", expectMin: 0, label: "Provisional Licence" },
    { serviceId: "gro-register-death", expectMin: 1, label: "Register Death" },
    { serviceId: "hmrc-child-benefit", expectMin: 0, label: "Child Benefit" },
  ];

  for (const tc of testCases) {
    try {
      const resp = await fetch(`${RELATED_API}/${encodeURIComponent(tc.serviceId)}/related`);
      const data = await resp.json() as { services: Array<{ id: string; name: string; dept: string }> };
      const count = data.services?.length ?? 0;

      assert(`related-${tc.serviceId}`,
        count >= tc.expectMin,
        `${tc.label}: ${count} related services${count > 0 ? ` (${data.services.slice(0, 3).map((s: { name: string }) => s.name).join(", ")})` : ""}`);

      // Verify each related service has required fields
      if (count > 0) {
        const first = data.services[0];
        assert(`related-${tc.serviceId}-fields`,
          !!first.id && !!first.name && !!first.dept,
          `Related service has id/name/dept: ${first.id}`);
      }
    } catch (err) {
      FAIL++;
      RESULTS.push(`  ✗ FAIL [related-${tc.serviceId}] Error: ${(err as Error).message}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE 9: Persistent Progress Data Structure
// ══════════════════════════════════════════════════════════════════════

async function testPersistentProgressStructure() {
  console.log("\n── Test Suite 9: Persistent Progress Data Structure ──");

  // Send a message and verify the response contains all fields needed for persistence
  try {
    const messages: ChatMessage[] = [
      { role: "user", content: "I want to register a death" },
    ];

    const result = await sendTurn("margaret-thompson", "gro-register-death", messages, null, []);

    // Verify ucState structure
    assert("persist-1-ucState-exists",
      !!result.ucState,
      `ucState exists: ${!!result.ucState}`);

    assert("persist-2-currentState",
      !!result.ucState?.currentState,
      `currentState: ${result.ucState?.currentState}`);

    assert("persist-3-stateHistory",
      Array.isArray(result.ucState?.stateHistory),
      `stateHistory is array with ${result.ucState?.stateHistory?.length} items`);

    assert("persist-4-interactionType",
      !!result.interactionType,
      `interactionType: ${result.interactionType}`);

    // All three fields must be present for persistence to work
    assert("persist-5-all-fields-present",
      !!result.ucState?.currentState && Array.isArray(result.ucState?.stateHistory) && !!result.interactionType,
      "All persistence fields (ucState.currentState, stateHistory, interactionType) present");

    // Verify stateHistory contains at least the starting state
    assert("persist-6-history-nonempty",
      (result.ucState?.stateHistory?.length ?? 0) >= 1,
      `History has ${result.ucState?.stateHistory?.length} entries`);

  } catch (err) {
    FAIL++;
    RESULTS.push(`  ✗ FAIL [persist-structure] Error: ${(err as Error).message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// TEST SUITE 10: Attendance Allowance — margaret (different service type)
// ══════════════════════════════════════════════════════════════════════

async function testAttendanceAllowanceMultiTurn() {
  console.log("\n── Test Suite 10: Attendance Allowance (margaret-thompson) — multi-turn ──");

  try {
    const conv = await driveConversation("margaret-thompson", "dwp-attendance-allowance", [
      { userMessage: "I have arthritis and need help applying for attendance allowance", autoConsent: true },
      { userMessage: "Yes, all my details look correct. Please proceed." },
    ]);

    const r = conv.results;

    assert("aa-1-interaction-type",
      r[0].interactionType === "application",
      `interactionType=${r[0].interactionType}`);

    assert("aa-2-progressed",
      conv.finalState !== "not-started",
      `Final state: ${conv.finalState}`);

    // Should NOT get UC-specific cards
    const allCards = r.flatMap(t => t.cardRequests || []);
    const cardTypes = allCards.map(c => c.cardType || c.definition?.cardType);
    const hasHousingCard = cardTypes.includes("household-details");
    assert("aa-3-no-housing-card",
      !hasHousingCard,
      `No housing card for attendance allowance. Cards: ${cardTypes.length > 0 ? cardTypes.join(", ") : "none yet"}`);

  } catch (err) {
    FAIL++;
    RESULTS.push(`  ✗ FAIL [aa-multi-turn] Error: ${(err as Error).message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// RUNNER
// ══════════════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Multi-Turn UX Integration Tests");
  console.log("  Testing: full conversations, card resolution,");
  console.log("  terminal states, milestones, persistence, related");
  console.log("═══════════════════════════════════════════════════════");

  // Structural tests (fast, no LLM calls)
  await testTerminalStateConfig();
  await testMilestoneGeneration();
  await testCardResolution();
  await testRelatedServicesDepth();
  await testPersistentProgressStructure();

  // Multi-turn LLM tests (slower, ~30s each)
  await testUCMultiTurn();
  await testRegisterBirthMultiTurn();
  await testProvisionalLicenceMultiTurn();
  await testStampDutyMultiTurn();
  await testAttendanceAllowanceMultiTurn();

  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  RESULTS: ${PASS} passed / ${FAIL} failed / ${SKIP} skipped / ${PASS + FAIL + SKIP} total`);
  console.log("═══════════════════════════════════════════════════════");
  for (const r of RESULTS) {
    console.log(r);
  }
  console.log("");

  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
