import { describe, it, expect } from "vitest";
import type {
  CapabilityManifest,
  PolicyRuleset,
  PolicyRule,
  PolicyResult,
  StateModelDefinition,
  TransitionResult,
  ConsentModel,
  ConsentGrant,
  TraceEvent,
  TraceEventType,
  Receipt,
  InvocationContext,
  InvocationResult,
  HandoffPackage,
  HandoffReason,
  LedgerCase,
  CaseStatus,
  OrchestratorAction,
  StateInstructions,
  JsonSchema,
} from "./index";
import { resolveCards, inferInteractionType, INTERACTION_TYPES } from "./index";

describe("@als/schemas — type compilation", () => {
  it("CapabilityManifest satisfies the interface", () => {
    const manifest: CapabilityManifest = {
      id: "test.service",
      version: "1.0.0",
      name: "Test Service",
      description: "A test service",
      department: "Test Dept",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
    };
    expect(manifest.id).toBe("test.service");
    expect(manifest.name).toBe("Test Service");
  });

  it("PolicyRuleset and PolicyResult compile correctly", () => {
    const rule: PolicyRule = {
      id: "rule-1",
      description: "Must be over 18",
      condition: { field: "age", operator: ">=", value: 18 },
      reason_if_failed: "You must be at least 18 years old",
    };
    const ruleset: PolicyRuleset = {
      id: "test.eligibility",
      version: "1.0.0",
      rules: [rule],
    };
    const result: PolicyResult = {
      eligible: true,
      passed: [rule],
      failed: [],
      edgeCases: [],
      explanation: "All rules passed",
    };
    expect(ruleset.rules).toHaveLength(1);
    expect(result.eligible).toBe(true);
  });

  it("StateModelDefinition and TransitionResult compile correctly", () => {
    const model: StateModelDefinition = {
      id: "test.states",
      version: "1.0.0",
      states: [
        { id: "start", type: "initial" },
        { id: "done", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "start", to: "done", trigger: "complete" },
      ],
    };
    const result: TransitionResult = {
      success: true,
      fromState: "start",
      toState: "done",
      trigger: "complete",
    };
    expect(model.states).toHaveLength(2);
    expect(result.success).toBe(true);
  });

  it("ConsentModel and ConsentGrant compile correctly", () => {
    const grant: ConsentGrant = {
      id: "share-data",
      description: "Share your data",
      data_shared: ["name", "dob"],
      source: "one-login",
      purpose: "Identity verification",
      duration: "session",
      required: true,
    };
    const model: ConsentModel = {
      id: "test.consent",
      version: "1.0.0",
      grants: [grant],
      revocation: { mechanism: "manual", effect: "stops sharing" },
      delegation: { agent_identity: "AI Agent", scopes: ["read"] },
    };
    expect(model.grants[0].required).toBe(true);
  });

  it("TraceEvent compiles with all event types", () => {
    const eventTypes: TraceEventType[] = [
      "llm.request", "llm.response", "plan.created",
      "capability.invoked", "capability.result", "policy.evaluated",
      "consent.requested", "consent.granted", "consent.denied",
      "receipt.issued", "state.transition", "handoff.initiated",
      "error.raised", "redress.offered",
    ];

    for (const type of eventTypes) {
      const event: TraceEvent = {
        id: "evt-1",
        traceId: "trace-1",
        spanId: "span-1",
        timestamp: new Date().toISOString(),
        type,
        payload: {},
        metadata: { sessionId: "sess-1" },
      };
      expect(event.type).toBe(type);
    }
  });

  it("Receipt compiles with all outcome types", () => {
    const outcomes: Receipt["outcome"][] = ["success", "failure", "partial", "handoff"];
    for (const outcome of outcomes) {
      const receipt: Receipt = {
        id: "rcpt-1",
        traceId: "trace-1",
        capabilityId: "test.service",
        timestamp: new Date().toISOString(),
        citizen: { id: "user-1" },
        action: "test",
        outcome,
        details: {},
      };
      expect(receipt.outcome).toBe(outcome);
    }
  });

  it("InvocationContext and InvocationResult compile correctly", () => {
    const ctx: InvocationContext = {
      sessionId: "sess-1",
      traceId: "trace-1",
      userId: "user-1",
    };
    const result: InvocationResult = {
      success: true,
      capabilityId: "test.service",
      traceEvents: [],
    };
    expect(ctx.sessionId).toBe("sess-1");
    expect(result.success).toBe(true);
  });

  it("HandoffPackage compiles with all urgency and reason types", () => {
    const reasons: HandoffReason[] = [
      "complexity-exceeded", "repeated-failure", "citizen-requested",
      "safeguarding-concern", "dispute-or-complaint", "technical-failure",
      "policy-edge-case",
    ];
    for (const reason of reasons) {
      const pkg: HandoffPackage = {
        id: "handoff-1",
        createdAt: new Date().toISOString(),
        urgency: "routine",
        citizen: { name: "Test", contactDetails: {} },
        reason: { category: reason, description: "test", agentAssessment: "test" },
        conversationSummary: {},
        traceId: "trace-1",
        receiptIds: [],
        suggestedActions: [],
        routing: { department: "DWP", serviceArea: "pensions" },
      };
      expect(pkg.reason.category).toBe(reason);
    }
  });

  it("LedgerCase compiles with all status types", () => {
    const statuses: CaseStatus[] = ["in-progress", "completed", "rejected", "handed-off", "abandoned"];
    for (const status of statuses) {
      const c: LedgerCase = {
        caseId: "case-1",
        userId: "user-1",
        serviceId: "svc-1",
        currentState: "start",
        status,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      };
      expect(c.status).toBe(status);
    }
  });

  it("OrchestratorAction compiles correctly", () => {
    const action: OrchestratorAction = {
      responseText: "Hello",
    };
    expect(action.responseText).toBe("Hello");
  });

  it("StateInstructions compiles correctly", () => {
    const instructions: StateInstructions = {
      version: "1.0.0",
      instructions: { "not-started": "Begin here" },
    };
    expect(instructions.version).toBe("1.0.0");
  });

  it("JsonSchema compiles correctly", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    };
    expect(schema.type).toBe("object");
  });
});

describe("@als/schemas — card-registry functions", () => {
  it("INTERACTION_TYPES is exported and has entries", () => {
    expect(INTERACTION_TYPES).toBeDefined();
    expect(Object.keys(INTERACTION_TYPES).length).toBeGreaterThan(0);
  });

  it("inferInteractionType returns a string for known patterns", () => {
    const result = inferInteractionType("identity-verified", "eligibility-checked");
    expect(typeof result).toBe("string");
  });

  it("resolveCards returns an array", () => {
    const cards = resolveCards("identity-verified", "eligibility-checked");
    expect(Array.isArray(cards)).toBe(true);
  });
});
