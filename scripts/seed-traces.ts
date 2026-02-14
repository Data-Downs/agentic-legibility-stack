/**
 * Seed script — inserts realistic demo trace sessions into the evidence store.
 * Run with: npx tsx scripts/seed-traces.ts
 *
 * Creates 2 demo sessions:
 * 1. Emma asking about driving licence renewal (full flow with policy, consent, state transitions)
 * 2. Margaret checking state pension (with edge case detection)
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(__dirname, "..", "data", "traces.db");

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isoTime(offsetMinutes: number): string {
  const base = new Date("2026-02-14T10:00:00Z");
  base.setMinutes(base.getMinutes() + offsetMinutes);
  return base.toISOString();
}

function createTraceEvent(
  traceId: string,
  spanId: string,
  type: string,
  payload: Record<string, unknown>,
  metadata: Record<string, unknown>,
  offsetMinutes: number
) {
  return {
    id: generateId("evt"),
    traceId,
    spanId,
    parentSpanId: null,
    timestamp: isoTime(offsetMinutes),
    type,
    payload: JSON.stringify(payload),
    metadata: JSON.stringify(metadata),
  };
}

function createReceipt(
  traceId: string,
  capabilityId: string,
  citizenId: string,
  citizenName: string,
  action: string,
  outcome: string,
  details: Record<string, unknown>,
  offsetMinutes: number,
  dataShared?: string[],
  stateFrom?: string,
  stateTo?: string
) {
  return {
    id: generateId("rcpt"),
    traceId,
    capabilityId,
    timestamp: isoTime(offsetMinutes),
    citizenId,
    citizenName,
    action,
    outcome,
    details: JSON.stringify(details),
    dataShared: dataShared ? JSON.stringify(dataShared) : null,
    stateFrom: stateFrom || null,
    stateTo: stateTo || null,
  };
}

function seed() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Create tables if they don't exist
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

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      capability_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      citizen_id TEXT NOT NULL,
      citizen_name TEXT,
      action TEXT NOT NULL,
      outcome TEXT NOT NULL,
      details TEXT NOT NULL,
      data_shared TEXT,
      state_from TEXT,
      state_to TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_trace_id ON receipts(trace_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_capability_id ON receipts(capability_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_citizen_id ON receipts(citizen_id);
  `);

  // Check if there are already events
  const existing = db.prepare("SELECT COUNT(*) as count FROM trace_events").get() as { count: number };
  if (existing.count > 0) {
    console.log(`Database already has ${existing.count} events. Skipping seed.`);
    db.close();
    return;
  }

  const insertEvent = db.prepare(`
    INSERT INTO trace_events (id, trace_id, span_id, parent_span_id, timestamp, type, payload, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReceipt = db.prepare(`
    INSERT INTO receipts (id, trace_id, capability_id, timestamp, citizen_id, citizen_name, action, outcome, details, data_shared, state_from, state_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    // ═══════════════════════════════════════
    // SESSION 1: Emma — Driving Licence Renewal
    // ═══════════════════════════════════════
    const trace1 = "trace_demo_emma_driving";
    const span1 = "span_demo_1";
    const meta1 = { userId: "emma-liam", sessionId: "session_demo_1", capabilityId: "agent.chat" };

    // LLM Request
    const e1 = createTraceEvent(trace1, span1, "llm.request", {
      persona: "emma-liam",
      agent: "dot",
      scenario: "driving",
      messageCount: 1,
    }, meta1, 0);
    insertEvent.run(e1.id, e1.traceId, e1.spanId, e1.parentSpanId, e1.timestamp, e1.type, e1.payload, e1.metadata);

    // Policy Evaluation
    const e2 = createTraceEvent(trace1, span1, "policy.evaluated", {
      serviceId: "dvla.renew-driving-licence",
      eligible: true,
      explanation: "Driving licence renewal eligibility: eligible. All 4 eligibility rules passed.",
      rulesPassed: 4,
      rulesFailed: 0,
      edgeCases: 0,
    }, meta1, 1);
    insertEvent.run(e2.id, e2.traceId, e2.spanId, e2.parentSpanId, e2.timestamp, e2.type, e2.payload, e2.metadata);

    // Consent Requested
    const e3 = createTraceEvent(trace1, span1, "consent.requested", {
      serviceId: "dvla.renew-driving-licence",
      dataCategories: ["personal-details", "vehicle-data", "driving-licence"],
      purpose: "Renew driving licence via DVLA online service",
    }, meta1, 2);
    insertEvent.run(e3.id, e3.traceId, e3.spanId, e3.parentSpanId, e3.timestamp, e3.type, e3.payload, e3.metadata);

    // Consent Granted
    const e4 = createTraceEvent(trace1, span1, "consent.granted", {
      serviceId: "dvla.renew-driving-licence",
      consentType: "requested",
      agent: "dot",
      dataCategories: ["personal-details", "vehicle-data"],
      purpose: "Access to data for dvla.renew-driving-licence",
    }, meta1, 3);
    insertEvent.run(e4.id, e4.traceId, e4.spanId, e4.parentSpanId, e4.timestamp, e4.type, e4.payload, e4.metadata);

    // Capability Invoked
    const e5 = createTraceEvent(trace1, span1, "capability.invoked", {
      capabilityId: "agent.chat",
      input: { persona: "emma-liam", scenario: "driving" },
    }, meta1, 4);
    insertEvent.run(e5.id, e5.traceId, e5.spanId, e5.parentSpanId, e5.timestamp, e5.type, e5.payload, e5.metadata);

    // State Transition
    const e6 = createTraceEvent(trace1, span1, "state.transition", {
      serviceId: "dvla.renew-driving-licence",
      from: "not-started",
      to: "identity-verified",
      trigger: "verify-identity",
    }, meta1, 5);
    insertEvent.run(e6.id, e6.traceId, e6.spanId, e6.parentSpanId, e6.timestamp, e6.type, e6.payload, e6.metadata);

    // Capability Result
    const e7 = createTraceEvent(trace1, span1, "capability.result", {
      capabilityId: "agent.chat",
      success: true,
      duration: "3.2s",
      toolsUsed: ["search_govuk"],
    }, meta1, 6);
    insertEvent.run(e7.id, e7.traceId, e7.spanId, e7.parentSpanId, e7.timestamp, e7.type, e7.payload, e7.metadata);

    // Receipt Issued
    const e8 = createTraceEvent(trace1, span1, "receipt.issued", {
      receiptId: "rcpt_demo_emma_1",
      capabilityId: "dvla.renew-driving-licence",
      outcome: "success",
    }, meta1, 7);
    insertEvent.run(e8.id, e8.traceId, e8.spanId, e8.parentSpanId, e8.timestamp, e8.type, e8.payload, e8.metadata);

    // LLM Response
    const e9 = createTraceEvent(trace1, span1, "llm.response", {
      toolsUsed: ["search_govuk"],
      tasksGenerated: 2,
      hasTitle: true,
      responseLength: 845,
      policyEvaluated: true,
      handoffTriggered: false,
    }, meta1, 8);
    insertEvent.run(e9.id, e9.traceId, e9.spanId, e9.parentSpanId, e9.timestamp, e9.type, e9.payload, e9.metadata);

    // Receipt
    const r1 = createReceipt(
      trace1,
      "dvla.renew-driving-licence",
      "emma-liam",
      "Emma Parker",
      "Checked driving licence renewal eligibility",
      "success",
      {
        policyEligible: true,
        vehicleChecked: "Ford Fiesta (BG19 XYZ)",
        motExpiry: "2026-04-15",
        toolsUsed: ["search_govuk"],
      },
      8,
      ["name", "date_of_birth", "vehicle_registration", "postcode"],
      "not-started",
      "identity-verified"
    );
    insertReceipt.run(r1.id, r1.traceId, r1.capabilityId, r1.timestamp, r1.citizenId, r1.citizenName, r1.action, r1.outcome, r1.details, r1.dataShared, r1.stateFrom, r1.stateTo);

    // ═══════════════════════════════════════
    // SESSION 2: Margaret — State Pension Check
    // ═══════════════════════════════════════
    const trace2 = "trace_demo_margaret_pension";
    const span2 = "span_demo_2";
    const meta2 = { userId: "margaret", sessionId: "session_demo_2", capabilityId: "agent.chat" };

    // LLM Request
    const f1 = createTraceEvent(trace2, span2, "llm.request", {
      persona: "margaret",
      agent: "dot",
      scenario: "benefits",
      messageCount: 1,
    }, meta2, 20);
    insertEvent.run(f1.id, f1.traceId, f1.spanId, f1.parentSpanId, f1.timestamp, f1.type, f1.payload, f1.metadata);

    // Policy Evaluation
    const f2 = createTraceEvent(trace2, span2, "policy.evaluated", {
      serviceId: "dwp.apply-universal-credit",
      eligible: false,
      explanation: "Not eligible: You are at or over State Pension age. You may be eligible for Pension Credit instead.",
      rulesPassed: 3,
      rulesFailed: 1,
      edgeCases: 0,
    }, meta2, 21);
    insertEvent.run(f2.id, f2.traceId, f2.spanId, f2.parentSpanId, f2.timestamp, f2.type, f2.payload, f2.metadata);

    // Consent Granted (auto for review)
    const f3 = createTraceEvent(trace2, span2, "consent.granted", {
      serviceId: "dwp.check-state-pension",
      consentType: "requested",
      agent: "dot",
      dataCategories: ["personal-details", "financial-data"],
      purpose: "Access to data for dwp.check-state-pension",
    }, meta2, 22);
    insertEvent.run(f3.id, f3.traceId, f3.spanId, f3.parentSpanId, f3.timestamp, f3.type, f3.payload, f3.metadata);

    // Capability Invoked
    const f4 = createTraceEvent(trace2, span2, "capability.invoked", {
      capabilityId: "agent.chat",
      input: { persona: "margaret", scenario: "benefits" },
    }, meta2, 23);
    insertEvent.run(f4.id, f4.traceId, f4.spanId, f4.parentSpanId, f4.timestamp, f4.type, f4.payload, f4.metadata);

    // Credential Presented
    const f5 = createTraceEvent(trace2, span2, "credential.presented", {
      credentialType: "national-insurance",
      issuer: "HMRC",
      verificationLevel: "high",
      purpose: "State pension forecast lookup",
    }, meta2, 24);
    insertEvent.run(f5.id, f5.traceId, f5.spanId, f5.parentSpanId, f5.timestamp, f5.type, f5.payload, f5.metadata);

    // Capability Result
    const f6 = createTraceEvent(trace2, span2, "capability.result", {
      capabilityId: "agent.chat",
      success: true,
      duration: "4.1s",
      toolsUsed: ["search_govuk", "govuk_content"],
    }, meta2, 25);
    insertEvent.run(f6.id, f6.traceId, f6.spanId, f6.parentSpanId, f6.timestamp, f6.type, f6.payload, f6.metadata);

    // Redress Offered
    const f7 = createTraceEvent(trace2, span2, "redress.offered", {
      serviceId: "dwp.check-state-pension",
      redressType: "alternative-service",
      suggestion: "Pension Credit may be available — eligibility check recommended",
      contactInfo: "Pension Service: 0800 731 7898",
    }, meta2, 26);
    insertEvent.run(f7.id, f7.traceId, f7.spanId, f7.parentSpanId, f7.timestamp, f7.type, f7.payload, f7.metadata);

    // Receipt Issued
    const f8 = createTraceEvent(trace2, span2, "receipt.issued", {
      receiptId: "rcpt_demo_margaret_1",
      capabilityId: "dwp.check-state-pension",
      outcome: "success",
    }, meta2, 27);
    insertEvent.run(f8.id, f8.traceId, f8.spanId, f8.parentSpanId, f8.timestamp, f8.type, f8.payload, f8.metadata);

    // LLM Response
    const f9 = createTraceEvent(trace2, span2, "llm.response", {
      toolsUsed: ["search_govuk", "govuk_content"],
      tasksGenerated: 1,
      hasTitle: true,
      responseLength: 1024,
      policyEvaluated: true,
      handoffTriggered: false,
    }, meta2, 28);
    insertEvent.run(f9.id, f9.traceId, f9.spanId, f9.parentSpanId, f9.timestamp, f9.type, f9.payload, f9.metadata);

    // Receipt
    const r2 = createReceipt(
      trace2,
      "dwp.check-state-pension",
      "margaret",
      "Margaret Thompson",
      "Checked state pension forecast and benefit eligibility",
      "success",
      {
        policyEligible: false,
        reason: "Over State Pension age for Universal Credit",
        alternativeOffered: "Pension Credit",
        toolsUsed: ["search_govuk", "govuk_content"],
        weeklyPension: 185.15,
        qualifyingYears: 35,
      },
      28,
      ["name", "date_of_birth", "national_insurance_number", "pension_data"]
    );
    insertReceipt.run(r2.id, r2.traceId, r2.capabilityId, r2.timestamp, r2.citizenId, r2.citizenName, r2.action, r2.outcome, r2.details, r2.dataShared, r2.stateFrom, r2.stateTo);
  });

  tx();

  const count = db.prepare("SELECT COUNT(*) as count FROM trace_events").get() as { count: number };
  const receiptCount = db.prepare("SELECT COUNT(*) as count FROM receipts").get() as { count: number };
  console.log(`Seeded ${count.count} trace events and ${receiptCount.count} receipts.`);

  db.close();
}

seed();
