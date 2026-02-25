/**
 * Seed script — generates ~400 realistic trace events that flow through the
 * CaseStore to populate the Service Ledger with demo data.
 *
 * Run with: npx tsx scripts/seed-ledger.ts
 *
 * Generates cases across all 4 services with varied outcomes:
 *
 * apply-universal-credit  (~160 cases)
 * renew-driving-licence   (~120 cases)
 * check-state-pension     (~100 cases)
 * become-a-robot          (~20 cases)
 */

import Database from "better-sqlite3";
import { SqliteAdapter } from "../packages/evidence/src/adapters/sqlite-adapter";
import { CaseStore } from "../packages/evidence/src/case-store";
import type { TraceEvent, TraceEventType } from "../packages/schemas/src/index";
import path from "path";

// ── Paths ──

const ROOT_DB_PATH = path.join(__dirname, "..", "data", "traces.db");
const APP_DB_PATH = path.join(
  __dirname, "..", "apps", "citizen-experience", "data", "traces.db",
);

// ── Service definitions ──

interface ServiceDef {
  id: string;
  totalStates: number;
  happyPath: Array<{ from: string; to: string; trigger: string }>;
  rejectedAt: { from: string; to: string; trigger: string };
  handoffAt: { from: string; to: string; trigger: string };
  /** Where in-progress cases can stall (index into happyPath) */
  stallPoints: number[];
  consentPurpose: string;
  handoffReasons: Array<{ reason: string; description: string }>;
  rejectionReasons: string[];
}

const SERVICES: ServiceDef[] = [
  {
    id: "dwp.apply-universal-credit",
    totalStates: 13,
    happyPath: [
      { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
      { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
      { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent" },
      { from: "consent-given", to: "personal-details-collected", trigger: "collect-personal-details" },
      { from: "personal-details-collected", to: "housing-details-collected", trigger: "collect-housing-details" },
      { from: "housing-details-collected", to: "income-details-collected", trigger: "collect-income-details" },
      { from: "income-details-collected", to: "bank-details-verified", trigger: "verify-bank-details" },
      { from: "bank-details-verified", to: "claim-submitted", trigger: "submit-claim" },
      { from: "claim-submitted", to: "awaiting-interview", trigger: "schedule-interview" },
      { from: "awaiting-interview", to: "claim-active", trigger: "activate-claim" },
    ],
    rejectedAt: { from: "eligibility-checked", to: "rejected", trigger: "reject" },
    handoffAt: { from: "eligibility-checked", to: "handed-off", trigger: "handoff" },
    stallPoints: [3, 4, 5, 6, 7, 8],
    consentPurpose: "Data sharing for Universal Credit application",
    handoffReasons: [
      { reason: "policy-edge-case", description: "Self-employed applicant requires Minimum Income Floor assessment" },
      { reason: "complexity-exceeded", description: "Multiple income sources require manual verification" },
      { reason: "citizen-requested", description: "Citizen requested to speak to an adviser" },
      { reason: "policy-edge-case", description: "Carer responsibilities affect work capability assessment" },
      { reason: "safeguarding-concern", description: "Indicators of financial vulnerability detected" },
      { reason: "technical-failure", description: "Bank account verification service unavailable" },
    ],
    rejectionReasons: [
      "Over State Pension age — not eligible for UC",
      "Savings exceed £16,000 threshold",
      "Not habitually resident in the UK",
      "Full-time student without dependants",
    ],
  },
  {
    id: "dvla.renew-driving-licence",
    totalStates: 11,
    happyPath: [
      { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
      { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
      { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent" },
      { from: "consent-given", to: "details-confirmed", trigger: "confirm-details" },
      { from: "details-confirmed", to: "photo-submitted", trigger: "submit-photo" },
      { from: "photo-submitted", to: "payment-made", trigger: "make-payment" },
      { from: "payment-made", to: "application-submitted", trigger: "submit-application" },
      { from: "application-submitted", to: "completed", trigger: "complete" },
    ],
    rejectedAt: { from: "eligibility-checked", to: "rejected", trigger: "reject" },
    handoffAt: { from: "eligibility-checked", to: "handed-off", trigger: "handoff" },
    stallPoints: [3, 4, 5, 6],
    consentPurpose: "Driving licence renewal data sharing",
    handoffReasons: [
      { reason: "policy-edge-case", description: "Medical condition requires DVLA medical team assessment" },
      { reason: "policy-edge-case", description: "Over-70 renewal requires additional health declaration" },
      { reason: "citizen-requested", description: "Citizen wants to discuss endorsement points" },
      { reason: "technical-failure", description: "Photo verification service returned inconclusive result" },
    ],
    rejectionReasons: [
      "Licence currently revoked due to disqualification",
      "Outstanding court order prevents renewal",
      "Identity verification failed — documents expired",
    ],
  },
  {
    id: "dwp.check-state-pension",
    totalStates: 7,
    happyPath: [
      { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
      { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
      { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent" },
      { from: "consent-given", to: "forecast-retrieved", trigger: "retrieve-forecast" },
      { from: "forecast-retrieved", to: "completed", trigger: "complete" },
    ],
    rejectedAt: { from: "eligibility-checked", to: "handed-off", trigger: "handoff" },
    handoffAt: { from: "eligibility-checked", to: "handed-off", trigger: "handoff" },
    stallPoints: [2, 3],
    consentPurpose: "State Pension forecast data access",
    handoffReasons: [
      { reason: "policy-edge-case", description: "Overseas NI contributions require manual calculation" },
      { reason: "complexity-exceeded", description: "Contracted-out pension scheme needs specialist review" },
      { reason: "citizen-requested", description: "Citizen wants to discuss topping up NI record" },
    ],
    rejectionReasons: [
      "Under minimum age for pension forecast",
    ],
  },
  {
    id: "department-of-interspecies-fun.become-a-robot",
    totalStates: 2,
    happyPath: [
      { from: "Applying", to: "Accepted", trigger: "accept" },
    ],
    rejectedAt: { from: "Applying", to: "Accepted", trigger: "accept" },
    handoffAt: { from: "Applying", to: "Accepted", trigger: "accept" },
    stallPoints: [0],
    consentPurpose: "Robot transformation consent",
    handoffReasons: [
      { reason: "citizen-requested", description: "Citizen unsure about irreversibility of robotification" },
    ],
    rejectionReasons: ["Already a robot"],
  },
];

// ── Name generation ──

const FIRST_NAMES = [
  "Sarah", "Mohammed", "David", "Margaret", "James", "Fatima", "Thomas",
  "Priya", "Oliver", "Amara", "William", "Aisha", "George", "Mei",
  "Richard", "Zara", "Edward", "Olga", "Patrick", "Nadia", "Samuel",
  "Yuki", "Daniel", "Elena", "Joseph", "Ines", "Alexander", "Adaeze",
  "Benjamin", "Suki", "Robert", "Isla", "Steven", "Grace", "Andrew",
  "Chloe", "Jack", "Emma", "Luke", "Sophie", "Ryan", "Hannah",
  "Nathan", "Abigail", "Mark", "Charlotte", "Peter", "Mia", "Simon",
  "Lily", "Adam", "Ruby", "Dylan", "Evie", "Kieran", "Olivia",
  "Jake", "Jessica", "Connor", "Holly", "Lewis", "Freya", "Callum",
  "Poppy", "Rhys", "Ella", "Owen", "Isabella", "Aaron", "Amelia",
];

const LAST_NAMES = [
  "chen", "al-rashid", "evans", "thompson", "jones", "patel", "williams",
  "kumar", "brown", "okafor", "smith", "kowalski", "taylor", "yamamoto",
  "davies", "mohammed", "wilson", "garcia", "johnson", "nguyen", "roberts",
  "kim", "hughes", "singh", "thomas", "fernandez", "wright", "berg",
  "hall", "santos", "green", "petrov", "white", "ali", "harris",
  "olsen", "robinson", "wolf", "king", "tanaka", "scott", "dubois",
  "mitchell", "andersen", "campbell", "rossi", "turner", "lee",
  "campbell", "martinez", "murphy", "hansen", "bailey", "ferrari",
  "morgan", "kowalczyk", "cox", "ivanov", "wood", "muller",
];

// ── Deterministic pseudo-random (seeded) ──

let rngState = 42;
function rng(): number {
  rngState = (rngState * 1664525 + 1013904223) & 0x7fffffff;
  return rngState / 0x7fffffff;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function intBetween(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ── Event helpers ──

let eventCounter = 0;

function generateId(prefix: string): string {
  eventCounter++;
  const suffix = Math.floor(rng() * 100000).toString(36);
  return `${prefix}_l_${eventCounter}_${suffix}`;
}

function makeEvent(
  traceId: string,
  type: TraceEventType,
  payload: Record<string, unknown>,
  userId: string,
  serviceId: string,
  timestamp: string,
): TraceEvent {
  return {
    id: generateId("evt"),
    traceId,
    spanId: `span_${traceId}_${eventCounter}`,
    timestamp,
    type,
    payload,
    metadata: {
      userId,
      sessionId: `session_${traceId}`,
      capabilityId: serviceId,
    },
  };
}

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

// ── Outcome distribution per service ──

type Outcome = "completed" | "in-progress" | "rejected" | "handed-off";

interface OutcomeWeights {
  completed: number;
  "in-progress": number;
  rejected: number;
  "handed-off": number;
}

const OUTCOME_WEIGHTS: Record<string, OutcomeWeights> = {
  "dwp.apply-universal-credit": { completed: 45, "in-progress": 25, rejected: 15, "handed-off": 15 },
  "dvla.renew-driving-licence": { completed: 55, "in-progress": 20, rejected: 10, "handed-off": 15 },
  "dwp.check-state-pension": { completed: 60, "in-progress": 20, rejected: 5, "handed-off": 15 },
  "department-of-interspecies-fun.become-a-robot": { completed: 70, "in-progress": 20, rejected: 0, "handed-off": 10 },
};

function pickOutcome(serviceId: string): Outcome {
  const w = OUTCOME_WEIGHTS[serviceId];
  const r = rng() * 100;
  if (r < w.completed) return "completed";
  if (r < w.completed + w["in-progress"]) return "in-progress";
  if (r < w.completed + w["in-progress"] + w.rejected) return "rejected";
  return "handed-off";
}

// ── Case generator ──

function generateCase(
  svc: ServiceDef,
  userId: string,
  baseDate: Date,
  outcome: Outcome,
): TraceEvent[] {
  const events: TraceEvent[] = [];
  const traceId = `trace_l_${userId}_${svc.id.split(".").pop()}`;
  let cursor = new Date(baseDate);

  function emit(type: TraceEventType, payload: Record<string, unknown>) {
    events.push(makeEvent(traceId, type, payload, userId, svc.id, cursor.toISOString()));
  }

  // Initial LLM request
  emit("llm.request", { scenario: svc.id.split(".").pop(), agent: "dot" });
  cursor = addMinutes(cursor, intBetween(2, 8));

  // Credential presented
  if (rng() > 0.3) {
    emit("credential.presented", { credentialType: "gov-verify", serviceId: svc.id });
    cursor = addMinutes(cursor, intBetween(1, 3));
  }

  if (outcome === "completed") {
    // Walk the entire happy path
    for (let i = 0; i < svc.happyPath.length; i++) {
      const step = svc.happyPath[i];
      emit("state.transition", { serviceId: svc.id, fromState: step.from, toState: step.to, trigger: step.trigger });
      cursor = addMinutes(cursor, intBetween(3, 15));

      // Policy check after eligibility
      if (step.to === "eligibility-checked") {
        emit("policy.evaluated", {
          serviceId: svc.id, eligible: true,
          explanation: "All rules passed",
          rulesPassed: intBetween(3, 6), rulesFailed: 0, edgeCases: 0,
        });
        cursor = addMinutes(cursor, intBetween(1, 5));
      }

      // Consent after consent state
      if (step.to === "consent-given" || step.to === "Accepted") {
        emit("consent.granted", { serviceId: svc.id, consentType: "requested", purpose: svc.consentPurpose });
        cursor = addMinutes(cursor, intBetween(1, 5));
      }

      // Sprinkle agent actions
      if (rng() > 0.5) {
        emit("llm.response", { toolsUsed: rng() > 0.5 ? ["search_govuk"] : [], responseLength: intBetween(200, 1200) });
        cursor = addMinutes(cursor, intBetween(1, 5));
      }

      // Receipt at terminal
      if (i === svc.happyPath.length - 1) {
        emit("receipt.issued", { action: `${svc.id} completed`, outcome: "success" });
      }
    }
  } else if (outcome === "rejected") {
    // Walk to eligibility then reject
    const identityStep = svc.happyPath[0];
    emit("state.transition", { serviceId: svc.id, fromState: identityStep.from, toState: identityStep.to, trigger: identityStep.trigger });
    cursor = addMinutes(cursor, intBetween(3, 10));

    if (svc.happyPath.length > 1) {
      const eligStep = svc.happyPath[1];
      emit("state.transition", { serviceId: svc.id, fromState: eligStep.from, toState: eligStep.to, trigger: eligStep.trigger });
      cursor = addMinutes(cursor, intBetween(2, 5));
    }

    emit("policy.evaluated", {
      serviceId: svc.id, eligible: false,
      explanation: pick(svc.rejectionReasons),
      rulesPassed: intBetween(1, 3), rulesFailed: intBetween(1, 3), edgeCases: 0,
    });
    cursor = addMinutes(cursor, intBetween(1, 3));

    emit("state.transition", { serviceId: svc.id, fromState: svc.rejectedAt.from, toState: svc.rejectedAt.to, trigger: svc.rejectedAt.trigger });
    emit("receipt.issued", { action: `${svc.id} rejected`, outcome: "failure" });
  } else if (outcome === "handed-off") {
    // Walk to eligibility then handoff
    const identityStep = svc.happyPath[0];
    emit("state.transition", { serviceId: svc.id, fromState: identityStep.from, toState: identityStep.to, trigger: identityStep.trigger });
    cursor = addMinutes(cursor, intBetween(3, 10));

    if (svc.happyPath.length > 1) {
      const eligStep = svc.happyPath[1];
      emit("state.transition", { serviceId: svc.id, fromState: eligStep.from, toState: eligStep.to, trigger: eligStep.trigger });
      cursor = addMinutes(cursor, intBetween(2, 5));
    }

    emit("policy.evaluated", {
      serviceId: svc.id, eligible: true,
      explanation: "Eligible but edge case detected",
      rulesPassed: intBetween(2, 5), rulesFailed: 0, edgeCases: 1,
    });
    cursor = addMinutes(cursor, intBetween(1, 3));

    emit("state.transition", { serviceId: svc.id, fromState: svc.handoffAt.from, toState: svc.handoffAt.to, trigger: svc.handoffAt.trigger });
    cursor = addMinutes(cursor, intBetween(1, 3));

    const hr = pick(svc.handoffReasons);
    emit("handoff.initiated", { serviceId: svc.id, reason: hr.reason, description: hr.description });
    emit("receipt.issued", { action: `${svc.id} handed off`, outcome: "handoff" });
  } else {
    // in-progress — walk part of the happy path then stop
    const stopAt = svc.stallPoints.length > 0
      ? pick(svc.stallPoints)
      : Math.min(intBetween(1, svc.happyPath.length - 1), svc.happyPath.length - 1);

    for (let i = 0; i <= stopAt && i < svc.happyPath.length; i++) {
      const step = svc.happyPath[i];
      emit("state.transition", { serviceId: svc.id, fromState: step.from, toState: step.to, trigger: step.trigger });
      cursor = addMinutes(cursor, intBetween(3, 15));

      if (step.to === "eligibility-checked") {
        emit("policy.evaluated", {
          serviceId: svc.id, eligible: true,
          explanation: "All rules passed",
          rulesPassed: intBetween(3, 6), rulesFailed: 0, edgeCases: 0,
        });
        cursor = addMinutes(cursor, intBetween(1, 5));
      }

      if (step.to === "consent-given" || step.to === "Accepted") {
        emit("consent.granted", { serviceId: svc.id, consentType: "requested", purpose: svc.consentPurpose });
        cursor = addMinutes(cursor, intBetween(1, 5));
      }

      if (rng() > 0.6) {
        emit("llm.response", { toolsUsed: rng() > 0.5 ? ["search_govuk"] : [], responseLength: intBetween(200, 800) });
        cursor = addMinutes(cursor, intBetween(1, 5));
      }
    }
  }

  // Final LLM response if not already emitted recently
  emit("llm.response", { toolsUsed: [], tasksGenerated: 1, responseLength: intBetween(300, 1000) });

  return events;
}

// ── Main seed function ──

async function seed(dbPath: string) {
  console.log(`\nSeeding: ${dbPath}`);
  eventCounter = 0;
  rngState = 42; // Reset RNG for deterministic output across both DBs

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Ensure trace_events table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS trace_events (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      span_id TEXT NOT NULL,
      parent_span_id TEXT,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_trace_events_trace_id ON trace_events(trace_id);
    CREATE INDEX IF NOT EXISTS idx_trace_events_type ON trace_events(type);
    CREATE INDEX IF NOT EXISTS idx_trace_events_timestamp ON trace_events(timestamp);
  `);

  const adapter = await SqliteAdapter.create(dbPath);
  const caseStore = new CaseStore(adapter);
  await caseStore.init();

  // Clear existing ledger data
  db.exec("DELETE FROM case_events");
  db.exec("DELETE FROM cases");
  db.exec("DELETE FROM trace_events");

  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO trace_events (id, trace_id, span_id, parent_span_id, timestamp, type, payload, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  async function emitEvent(event: TraceEvent, totalStates: number) {
    insertEvent.run(
      event.id, event.traceId, event.spanId, event.parentSpanId || null,
      event.timestamp, event.type, JSON.stringify(event.payload), JSON.stringify(event.metadata),
    );
    await caseStore.upsertCase(event, totalStates);
  }

  // Distribute cases across services
  const caseCounts: Record<string, number> = {
    "dwp.apply-universal-credit": 160,
    "dvla.renew-driving-licence": 120,
    "dwp.check-state-pension": 100,
    "department-of-interspecies-fun.become-a-robot": 20,
  };

  // Generate unique user IDs
  const usedNames = new Set<string>();
  function generateUserId(): string {
    for (let attempt = 0; attempt < 200; attempt++) {
      const first = pick(FIRST_NAMES).toLowerCase();
      const last = pick(LAST_NAMES);
      const name = `${first}-${last}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    // Fallback with numeric suffix
    const first = pick(FIRST_NAMES).toLowerCase();
    const last = pick(LAST_NAMES);
    const suffix = intBetween(1, 999);
    const name = `${first}-${last}-${suffix}`;
    usedNames.add(name);
    return name;
  }

  // Base date: spread cases over the last 30 days
  const now = new Date("2026-02-19T12:00:00Z");
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let totalCases = 0;
  let totalEvents = 0;

  for (const svc of SERVICES) {
    const count = caseCounts[svc.id] || 10;
    console.log(`  Generating ${count} cases for ${svc.id}...`);

    for (let i = 0; i < count; i++) {
      const userId = generateUserId();
      const outcome = pickOutcome(svc.id);

      // Spread start dates across 30 days, with some clustering
      const dayOffset = rng() * 30;
      const hourOffset = rng() * 16 + 7; // 7am to 11pm
      const baseDate = new Date(
        thirtyDaysAgo.getTime() +
        dayOffset * 24 * 60 * 60 * 1000 +
        hourOffset * 60 * 60 * 1000,
      );

      const events = generateCase(svc, userId, baseDate, outcome);

      for (const event of events) {
        await emitEvent(event, svc.totalStates);
      }

      totalCases++;
      totalEvents += events.length;
    }
  }

  // Print summary
  const caseCount = (db.prepare("SELECT COUNT(*) as count FROM cases").get() as { count: number }).count;
  const caseEventCount = (db.prepare("SELECT COUNT(*) as count FROM case_events").get() as { count: number }).count;
  const traceCount = (db.prepare("SELECT COUNT(*) as count FROM trace_events").get() as { count: number }).count;

  console.log(`\n  Ledger seeded successfully:`);
  console.log(`    ${caseCount} cases created`);
  console.log(`    ${caseEventCount} case events`);
  console.log(`    ${traceCount} trace events`);

  const services = db.prepare(`
    SELECT service_id, COUNT(*) as cases,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'handed-off' THEN 1 ELSE 0 END) as handed_off,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
    FROM cases GROUP BY service_id
  `).all() as Array<Record<string, unknown>>;

  for (const s of services) {
    console.log(`\n    ${s.service_id}:`);
    console.log(`      ${s.cases} cases (${s.completed} completed, ${s.active} active, ${s.handed_off} handed off, ${s.rejected} rejected)`);
  }

  adapter.close();
  db.close();
}

// Seed both database locations
async function main() {
  await seed(ROOT_DB_PATH);
  await seed(APP_DB_PATH);
  console.log("\nDone.");
}

main();
