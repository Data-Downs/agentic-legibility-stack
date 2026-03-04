import { describe, it, expect, beforeEach } from "vitest";
import { generateToolsForService, generateAllTools } from "./tool-generator";
import { handleToolCall } from "./tool-handlers";
import { ArtefactStore } from "@als/legibility";
import type { CapabilityManifest, PolicyRuleset, StateModelDefinition, ConsentModel } from "@als/schemas";

const manifest: CapabilityManifest = {
  id: "dwp.check-state-pension",
  version: "1.0.0",
  name: "Check State Pension Forecast",
  description: "Check your State Pension forecast",
  department: "DWP",
  input_schema: { type: "object" },
  output_schema: { type: "object" },
};

const policy: PolicyRuleset = {
  id: "dwp.state-pension.eligibility",
  version: "1.0.0",
  rules: [
    {
      id: "has-ni-number",
      description: "Must have NI number",
      condition: { field: "national_insurance_number", operator: "exists" },
      reason_if_failed: "You need an NI number",
    },
  ],
};

const stateModel: StateModelDefinition = {
  id: "dwp.state-pension.states",
  version: "1.0.0",
  states: [
    { id: "not-started", type: "initial" },
    { id: "completed", type: "terminal" },
  ],
  transitions: [
    { from: "not-started", to: "completed", trigger: "complete" },
  ],
};

const consent: ConsentModel = {
  id: "dwp.state-pension.consent",
  version: "1.0.0",
  grants: [
    {
      id: "identity-verification",
      description: "Verify your identity",
      data_shared: ["name"],
      source: "one-login",
      purpose: "Identity verification",
      duration: "session",
      required: true,
    },
  ],
  revocation: { mechanism: "manual", effect: "stops sharing" },
  delegation: { agent_identity: "AI Agent", scopes: ["read"] },
};

describe("tool-generator", () => {
  it("generates check_eligibility tool when policy exists", () => {
    const tools = generateToolsForService("dwp.check-state-pension", {
      manifest,
      policy,
    });
    const eligTool = tools.find((t) => t.name.includes("check_eligibility"));
    expect(eligTool).toBeDefined();
    expect(eligTool!.name).toBe("check_state_pension_check_eligibility");
    expect(eligTool!.annotations.readOnlyHint).toBe(true);
    expect(eligTool!.annotations.destructiveHint).toBe(false);
    expect(eligTool!.inputSchema.required).toContain("citizen_data");
  });

  it("generates advance_state tool when state model exists", () => {
    const tools = generateToolsForService("dwp.check-state-pension", {
      manifest,
      stateModel,
    });
    const stateTool = tools.find((t) => t.name.includes("advance_state"));
    expect(stateTool).toBeDefined();
    expect(stateTool!.name).toBe("check_state_pension_advance_state");
    expect(stateTool!.annotations.readOnlyHint).toBe(false);
    expect(stateTool!.inputSchema.required).toContain("current_state");
  });

  it("generates no tools when no policy or state model", () => {
    const tools = generateToolsForService("bare.service", { manifest });
    expect(tools).toHaveLength(0);
  });

  it("generateAllTools loads all services from store", () => {
    const store = new ArtefactStore();
    store.register("dwp.check-state-pension", { manifest, policy, stateModel });
    const { tools, toolMap } = generateAllTools(store);
    expect(tools.length).toBeGreaterThanOrEqual(2);
    expect(toolMap.size).toBe(tools.length);

    // Verify mapping
    for (const [name, mapping] of toolMap) {
      expect(mapping.serviceId).toBe("dwp.check-state-pension");
      expect(["check_eligibility", "advance_state"]).toContain(mapping.action);
    }
  });
});

describe("tool-handlers", () => {
  let store: ArtefactStore;
  let toolMap: Map<string, { serviceId: string; action: string }>;

  beforeEach(() => {
    store = new ArtefactStore();
    store.register("dwp.check-state-pension", { manifest, policy, stateModel, consent });
    const result = generateAllTools(store);
    toolMap = result.toolMap;
  });

  it("handles check_eligibility — eligible citizen", () => {
    const result = handleToolCall(
      "check_state_pension_check_eligibility",
      { citizen_data: { national_insurance_number: "QQ123456C" } },
      store,
      toolMap,
    );
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.eligible).toBe(true);
    expect(parsed.passed).toHaveLength(1);
  });

  it("handles check_eligibility — ineligible citizen", () => {
    const result = handleToolCall(
      "check_state_pension_check_eligibility",
      { citizen_data: {} },
      store,
      toolMap,
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.eligible).toBe(false);
    expect(parsed.failed).toHaveLength(1);
  });

  it("handles advance_state — valid transition", () => {
    const result = handleToolCall(
      "check_state_pension_advance_state",
      { current_state: "not-started", trigger: "complete" },
      store,
      toolMap,
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.toState).toBe("completed");
    expect(parsed.isTerminal).toBe(true);
  });

  it("handles advance_state — invalid transition", () => {
    const result = handleToolCall(
      "check_state_pension_advance_state",
      { current_state: "not-started", trigger: "invalid" },
      store,
      toolMap,
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBeTruthy();
  });

  it("returns error for unknown tool", () => {
    const result = handleToolCall("unknown_tool", {}, store, toolMap);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown tool");
  });

  it("returns error for missing required args", () => {
    const result = handleToolCall(
      "check_state_pension_advance_state",
      {},
      store,
      toolMap,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("required");
  });
});
