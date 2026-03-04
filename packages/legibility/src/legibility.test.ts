import { describe, it, expect, beforeEach } from "vitest";
import { PolicyEvaluator } from "./policy-dsl";
import { StateMachine } from "./state-model";
import { ConsentManager } from "./consent-model";
import { FieldCollector } from "./field-collector";
import { ArtefactStore } from "./artefact-store";
import type {
  PolicyRuleset,
  StateModelDefinition,
  ConsentModel,
  JsonSchema,
} from "@als/schemas";

// ── PolicyEvaluator ──

const pensionPolicy: PolicyRuleset = {
  id: "dwp.state-pension.eligibility",
  version: "1.0.0",
  rules: [
    {
      id: "has-ni-number",
      description: "Must have NI number",
      condition: { field: "national_insurance_number", operator: "exists" },
      reason_if_failed: "You need a National Insurance number",
    },
    {
      id: "uk-jurisdiction",
      description: "UK jurisdiction required",
      condition: { field: "jurisdiction", operator: "in", value: ["England", "Wales", "Scotland"] },
      reason_if_failed: "Must be in UK jurisdiction",
    },
  ],
  explanation_template: "State Pension forecast eligibility: {outcome}",
  edge_cases: [
    {
      id: "lived-abroad",
      description: "Has overseas work",
      detection: "overseas_work_history",
      action: "Check reciprocal agreements",
    },
  ],
};

describe("PolicyEvaluator", () => {
  const evaluator = new PolicyEvaluator();

  it("returns eligible when all rules pass", () => {
    const result = evaluator.evaluate(pensionPolicy, {
      national_insurance_number: "QQ123456C",
      jurisdiction: "England",
    });
    expect(result.eligible).toBe(true);
    expect(result.passed).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.explanation).toContain("eligible");
  });

  it("returns not eligible when a rule fails", () => {
    const result = evaluator.evaluate(pensionPolicy, {
      jurisdiction: "England",
      // missing NI number
    });
    expect(result.eligible).toBe(false);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe("has-ni-number");
    expect(result.explanation).toContain("Not eligible");
  });

  it("detects edge cases", () => {
    const result = evaluator.evaluate(pensionPolicy, {
      national_insurance_number: "QQ123456C",
      jurisdiction: "England",
      overseas_work_history: true,
    });
    expect(result.eligible).toBe(true);
    expect(result.edgeCases).toHaveLength(1);
    expect(result.edgeCases[0].id).toBe("lived-abroad");
    expect(result.explanation).toContain("edge case");
  });

  it("handles >= operator", () => {
    const ruleset: PolicyRuleset = {
      id: "test", version: "1.0.0",
      rules: [{
        id: "age-check", description: "Over 18",
        condition: { field: "age", operator: ">=", value: 18 },
        reason_if_failed: "Too young",
      }],
    };
    expect(evaluator.evaluate(ruleset, { age: 25 }).eligible).toBe(true);
    expect(evaluator.evaluate(ruleset, { age: 18 }).eligible).toBe(true);
    expect(evaluator.evaluate(ruleset, { age: 17 }).eligible).toBe(false);
  });

  it("handles <= operator", () => {
    const ruleset: PolicyRuleset = {
      id: "test", version: "1.0.0",
      rules: [{
        id: "savings-check", description: "Savings below threshold",
        condition: { field: "savings", operator: "<=", value: 16000 },
        reason_if_failed: "Savings too high",
      }],
    };
    expect(evaluator.evaluate(ruleset, { savings: 5000 }).eligible).toBe(true);
    expect(evaluator.evaluate(ruleset, { savings: 20000 }).eligible).toBe(false);
  });

  it("handles == operator", () => {
    const ruleset: PolicyRuleset = {
      id: "test", version: "1.0.0",
      rules: [{
        id: "status", description: "Must be employed",
        condition: { field: "status", operator: "==", value: "employed" },
        reason_if_failed: "Not employed",
      }],
    };
    expect(evaluator.evaluate(ruleset, { status: "employed" }).eligible).toBe(true);
    expect(evaluator.evaluate(ruleset, { status: "unemployed" }).eligible).toBe(false);
  });

  it("handles != operator", () => {
    const ruleset: PolicyRuleset = {
      id: "test", version: "1.0.0",
      rules: [{
        id: "not-banned", description: "Not banned",
        condition: { field: "status", operator: "!=", value: "banned" },
        reason_if_failed: "You are banned",
      }],
    };
    expect(evaluator.evaluate(ruleset, { status: "active" }).eligible).toBe(true);
    expect(evaluator.evaluate(ruleset, { status: "banned" }).eligible).toBe(false);
  });

  it("handles not-exists operator", () => {
    const ruleset: PolicyRuleset = {
      id: "test", version: "1.0.0",
      rules: [{
        id: "no-ban", description: "No ban flag",
        condition: { field: "ban_flag", operator: "not-exists" },
        reason_if_failed: "Ban flag exists",
      }],
    };
    expect(evaluator.evaluate(ruleset, {}).eligible).toBe(true);
    expect(evaluator.evaluate(ruleset, { ban_flag: true }).eligible).toBe(false);
  });

  it("handles nested field paths", () => {
    const ruleset: PolicyRuleset = {
      id: "test", version: "1.0.0",
      rules: [{
        id: "postcode", description: "Has postcode",
        condition: { field: "address.postcode", operator: "exists" },
        reason_if_failed: "No postcode",
      }],
    };
    expect(evaluator.evaluate(ruleset, { address: { postcode: "SW1A 2AA" } }).eligible).toBe(true);
    expect(evaluator.evaluate(ruleset, { address: {} }).eligible).toBe(false);
    expect(evaluator.evaluate(ruleset, {}).eligible).toBe(false);
  });
});

// ── StateMachine ──

const pensionStateModel: StateModelDefinition = {
  id: "dwp.state-pension.states",
  version: "1.0.0",
  states: [
    { id: "not-started", type: "initial" },
    { id: "identity-verified" },
    { id: "eligibility-checked" },
    { id: "consent-given" },
    { id: "forecast-retrieved", receipt: true },
    { id: "completed", type: "terminal", receipt: true },
    { id: "handed-off", type: "terminal", receipt: true },
  ],
  transitions: [
    { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
    { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
    { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent" },
    { from: "eligibility-checked", to: "handed-off", trigger: "handoff" },
    { from: "consent-given", to: "forecast-retrieved", trigger: "retrieve-forecast" },
    { from: "forecast-retrieved", to: "completed", trigger: "complete" },
  ],
};

describe("StateMachine", () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine(pensionStateModel);
  });

  it("starts at the initial state", () => {
    expect(sm.getState()).toBe("not-started");
  });

  it("returns allowed transitions from current state", () => {
    const transitions = sm.allowedTransitions();
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toEqual({ to: "identity-verified", trigger: "verify-identity" });
  });

  it("transitions successfully with valid trigger", () => {
    const result = sm.transition("verify-identity");
    expect(result.success).toBe(true);
    expect(result.fromState).toBe("not-started");
    expect(result.toState).toBe("identity-verified");
    expect(sm.getState()).toBe("identity-verified");
  });

  it("rejects invalid trigger", () => {
    const result = sm.transition("nonexistent-trigger");
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(sm.getState()).toBe("not-started"); // unchanged
  });

  it("walks through full journey to terminal state", () => {
    sm.transition("verify-identity");
    sm.transition("check-eligibility");
    sm.transition("grant-consent");
    sm.transition("retrieve-forecast");
    const result = sm.transition("complete");
    expect(result.success).toBe(true);
    expect(sm.getState()).toBe("completed");
    expect(sm.isTerminal()).toBe(true);
  });

  it("isTerminal returns false for non-terminal states", () => {
    expect(sm.isTerminal()).toBe(false);
    sm.transition("verify-identity");
    expect(sm.isTerminal()).toBe(false);
  });

  it("requiresReceipt reflects state definition", () => {
    expect(sm.requiresReceipt()).toBe(false); // not-started
    sm.transition("verify-identity");
    sm.transition("check-eligibility");
    sm.transition("grant-consent");
    sm.transition("retrieve-forecast");
    expect(sm.requiresReceipt()).toBe(true); // forecast-retrieved has receipt: true
  });

  it("setState restores state correctly", () => {
    sm.setState("consent-given");
    expect(sm.getState()).toBe("consent-given");
    const transitions = sm.allowedTransitions();
    expect(transitions).toHaveLength(1);
    expect(transitions[0].trigger).toBe("retrieve-forecast");
  });

  it("setState ignores unknown state", () => {
    sm.setState("nonexistent");
    expect(sm.getState()).toBe("not-started"); // unchanged
  });

  it("reset returns to initial state", () => {
    sm.transition("verify-identity");
    sm.transition("check-eligibility");
    sm.reset();
    expect(sm.getState()).toBe("not-started");
  });
});

// ── ConsentManager ──

const consentModel: ConsentModel = {
  id: "test.consent",
  version: "1.0.0",
  grants: [
    {
      id: "identity-verification",
      description: "Verify your identity",
      data_shared: ["full_name", "date_of_birth", "ni_number"],
      source: "one-login",
      purpose: "Identity verification",
      duration: "session",
      required: true,
    },
    {
      id: "analytics",
      description: "Share usage analytics",
      data_shared: ["usage_data"],
      source: "system",
      purpose: "Improve services",
      duration: "30 days",
      required: false,
    },
  ],
  revocation: { mechanism: "manual", effect: "stops sharing" },
  delegation: { agent_identity: "AI Agent", scopes: ["read"] },
};

describe("ConsentManager", () => {
  let manager: ConsentManager;

  beforeEach(() => {
    manager = new ConsentManager(consentModel);
  });

  it("getRequiredGrants returns only required grants", () => {
    const required = manager.getRequiredGrants();
    expect(required).toHaveLength(1);
    expect(required[0].id).toBe("identity-verification");
  });

  it("getOptionalGrants returns only optional grants", () => {
    const optional = manager.getOptionalGrants();
    expect(optional).toHaveLength(1);
    expect(optional[0].id).toBe("analytics");
  });

  it("getPendingGrants returns undecided grants", () => {
    expect(manager.getPendingGrants()).toHaveLength(2);
    manager.recordDecision("identity-verification", true);
    expect(manager.getPendingGrants()).toHaveLength(1);
  });

  it("recordDecision and hasConsent work together", () => {
    expect(manager.hasConsent("identity-verification")).toBe(false);
    manager.recordDecision("identity-verification", true);
    expect(manager.hasConsent("identity-verification")).toBe(true);
  });

  it("recordDecision with granted=false denies consent", () => {
    manager.recordDecision("analytics", false);
    expect(manager.hasConsent("analytics")).toBe(false);
  });

  it("revoke sets consent to false", () => {
    manager.recordDecision("identity-verification", true);
    expect(manager.hasConsent("identity-verification")).toBe(true);
    manager.revoke("identity-verification", "Changed my mind");
    expect(manager.hasConsent("identity-verification")).toBe(false);
  });

  it("allRequiredGranted checks all required consents", () => {
    expect(manager.allRequiredGranted()).toBe(false);
    manager.recordDecision("identity-verification", true);
    expect(manager.allRequiredGranted()).toBe(true);
    // Optional grant doesn't affect this
    manager.recordDecision("analytics", false);
    expect(manager.allRequiredGranted()).toBe(true);
  });

  it("getAllDecisions returns recorded decisions", () => {
    manager.recordDecision("identity-verification", true);
    manager.recordDecision("analytics", false, "No thanks");
    const decisions = manager.getAllDecisions();
    expect(decisions).toHaveLength(2);
    expect(decisions[0].grantId).toBe("identity-verification");
    expect(decisions[0].granted).toBe(true);
    expect(decisions[1].grantId).toBe("analytics");
    expect(decisions[1].granted).toBe(false);
    expect(decisions[1].reason).toBe("No thanks");
  });

  it("getDataShared returns data fields for a grant", () => {
    const data = manager.getDataShared("identity-verification");
    expect(data).toEqual(["full_name", "date_of_birth", "ni_number"]);
  });

  it("getDataShared returns empty for unknown grant", () => {
    expect(manager.getDataShared("nonexistent")).toEqual([]);
  });
});

// ── FieldCollector ──

const inputSchema: JsonSchema = {
  type: "object",
  properties: {
    national_insurance_number: { type: "string", description: "NI number" },
    date_of_birth: { type: "string", description: "Date of birth" },
    full_name: { type: "string", description: "Full name" },
    consent: { type: "boolean" },
  },
  required: ["national_insurance_number", "date_of_birth", "full_name"],
};

describe("FieldCollector", () => {
  let collector: FieldCollector;

  beforeEach(() => {
    collector = new FieldCollector(inputSchema);
  });

  it("tracks required vs optional fields", () => {
    expect(collector.getMissing()).toEqual(["national_insurance_number", "date_of_birth", "full_name"]);
    expect(collector.isComplete()).toBe(false);
  });

  it("seedFromPersona populates known fields", () => {
    collector.seedFromPersona({
      national_insurance_number: "QQ123456C",
      full_name: "Alice Smith",
    });
    expect(collector.getMissing()).toEqual(["date_of_birth"]);
    expect(collector.getValue("full_name")).toBe("Alice Smith");
  });

  it("recordField adds a single field", () => {
    collector.recordField("date_of_birth", "1990-01-15", "conversation");
    expect(collector.hasField("date_of_birth")).toBe(true);
    expect(collector.getValue("date_of_birth")).toBe("1990-01-15");
  });

  it("recordFields adds multiple fields", () => {
    collector.recordFields({
      national_insurance_number: "QQ123456C",
      date_of_birth: "1990-01-15",
      full_name: "Alice",
    }, "form");
    expect(collector.isComplete()).toBe(true);
  });

  it("nextRequiredFields returns limited subset", () => {
    const next = collector.nextRequiredFields(2);
    expect(next).toHaveLength(2);
    expect(next[0]).toBe("national_insurance_number");
  });

  it("isComplete returns true when all required fields collected", () => {
    collector.recordField("national_insurance_number", "QQ123456C", "persona");
    collector.recordField("date_of_birth", "1990-01-15", "conversation");
    collector.recordField("full_name", "Alice", "form");
    expect(collector.isComplete()).toBe(true);
    expect(collector.getMissing()).toEqual([]);
  });

  it("toContext produces readable output", () => {
    collector.recordField("full_name", "Alice", "persona");
    const ctx = collector.toContext();
    expect(ctx).toContain("FIELDS COLLECTED:");
    expect(ctx).toContain("full_name: Alice");
    expect(ctx).toContain("FIELDS STILL REQUIRED:");
    expect(ctx).toContain("national_insurance_number");
  });

  it("toStats returns correct counts", () => {
    collector.recordField("full_name", "Alice", "persona");
    const stats = collector.toStats();
    expect(stats.collected).toBe(1);
    expect(stats.required).toBe(3);
    expect(stats.missing).toBe(2);
    expect(stats.complete).toBe(false);
  });

  it("seedFromPersona ignores null/undefined/empty values", () => {
    collector.seedFromPersona({
      national_insurance_number: null,
      date_of_birth: undefined,
      full_name: "",
    });
    expect(collector.getMissing()).toHaveLength(3);
  });
});

// ── ArtefactStore ──

describe("ArtefactStore", () => {
  it("register and get round-trip", () => {
    const store = new ArtefactStore();
    const artefacts = {
      manifest: {
        id: "test.service",
        version: "1.0.0",
        name: "Test",
        description: "Test service",
        department: "Test",
        input_schema: { type: "object" as const },
        output_schema: { type: "object" as const },
      },
    };
    store.register("test.service", artefacts);
    expect(store.get("test.service")).toBe(artefacts);
    expect(store.get("unknown")).toBeUndefined();
  });

  it("listServices returns registered IDs", () => {
    const store = new ArtefactStore();
    store.register("svc-1", { manifest: { id: "svc-1" } as any });
    store.register("svc-2", { manifest: { id: "svc-2" } as any });
    expect(store.listServices()).toEqual(["svc-1", "svc-2"]);
  });

  it("slugFromId extracts directory name", () => {
    expect(ArtefactStore.slugFromId("dvla.renew-driving-licence")).toBe("renew-driving-licence");
    expect(ArtefactStore.slugFromId("dwp.check-state-pension")).toBe("check-state-pension");
    expect(ArtefactStore.slugFromId("simple")).toBe("simple");
  });

  it("loadFromDirectory loads real service artefacts", async () => {
    const store = new ArtefactStore();
    const path = await import("path");
    const servicesDir = path.resolve(__dirname, "../../../data/services");
    const count = await store.loadFromDirectory(servicesDir);
    expect(count).toBeGreaterThanOrEqual(4);

    const services = store.listServices();
    expect(services.length).toBeGreaterThanOrEqual(4);

    // Every loaded service should have a manifest
    for (const id of services) {
      const artefacts = store.get(id);
      expect(artefacts).toBeDefined();
      expect(artefacts!.manifest).toBeDefined();
      expect(artefacts!.manifest.id).toBe(id);
    }
  });
});
