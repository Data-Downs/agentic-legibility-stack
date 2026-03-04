import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator } from "./orchestrator";
import type { LLMAdapter, OrchestratorInput } from "./orchestrator";
import type { ServiceStrategy } from "./service-strategy";
import type { PolicyRuleset, StateModelDefinition } from "@als/schemas";

// ── Mocks ──

function createMockAdapter(): LLMAdapter {
  return {
    chat: vi.fn().mockResolvedValue({
      responseText: 'Hello citizen!\n\n```json\n{"title": null, "tasks": [], "stateTransition": null}\n```',
      reasoning: "Test reasoning",
      toolCalls: [],
      rawContent: [{ type: "text", text: "Hello citizen!" }],
      stopReason: "end_turn",
    }),
  };
}

function createMockStrategy(): ServiceStrategy {
  return {
    buildTools: vi.fn().mockReturnValue([]),
    buildServiceContext: vi.fn().mockReturnValue("Mock service context"),
    dispatchToolCall: vi.fn().mockResolvedValue("tool result"),
    extractStateTransitions: vi.fn().mockReturnValue([]),
  };
}

const testStateModel: StateModelDefinition = {
  id: "test-state",
  version: "1.0",
  states: [
    { id: "not-started", type: "initial" },
    { id: "in-progress" },
    { id: "complete", type: "terminal" },
  ],
  transitions: [
    { from: "not-started", to: "in-progress", trigger: "start" },
    { from: "in-progress", to: "complete", trigger: "finish" },
  ],
};

const triageInput: OrchestratorInput = {
  persona: "test-user",
  agent: "dot",
  scenario: "triage",
  serviceId: "triage",
  messages: [{ role: "user", content: "Hello" }],
  personaData: { name: "Test User", age: 30 },
  agentPrompt: "You are DOT agent.",
  personaPrompt: "User is a test persona.",
  scenarioPrompt: "Triage scenario.",
};

const journeyInput: OrchestratorInput = {
  persona: "test-user",
  agent: "dot",
  scenario: "benefits",
  serviceId: "dwp.apply-universal-credit",
  messages: [{ role: "user", content: "Hello" }],
  personaData: { name: "Test User", age: 30 },
  agentPrompt: "You are DOT agent.",
  personaPrompt: "User is a test persona.",
  scenarioPrompt: "Benefits scenario.",
  stateModelDef: testStateModel,
};

// ── Tests ──

describe("Orchestrator pipeline trace", () => {
  let adapter: LLMAdapter;
  let strategy: ServiceStrategy;

  beforeEach(() => {
    adapter = createMockAdapter();
    strategy = createMockStrategy();
  });

  it("returns pipelineTrace with steps", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });
    const result = await orchestrator.run(journeyInput);

    expect(result.pipelineTrace).toBeDefined();
    expect(result.pipelineTrace!.steps.length).toBeGreaterThanOrEqual(8);
    expect(result.pipelineTrace!.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("steps have correct type values", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });
    const result = await orchestrator.run(journeyInput);

    const steps = result.pipelineTrace!.steps;
    const aiSteps = steps.filter((s) => s.type === "ai");
    const deterministicSteps = steps.filter((s) => s.type === "deterministic");

    expect(aiSteps.length).toBe(1);
    expect(aiSteps[0].id).toBe("llm-call");
    expect(deterministicSteps.length).toBeGreaterThanOrEqual(7);
  });

  it("skipped sections produce status 'skipped'", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });
    const result = await orchestrator.run(triageInput);

    const steps = result.pipelineTrace!.steps;
    const policyStep = steps.find((s) => s.id === "policy-eval");
    const stateStep = steps.find((s) => s.id === "state-setup");

    expect(policyStep).toBeDefined();
    expect(policyStep!.status).toBe("skipped");
    expect(stateStep).toBeDefined();
    expect(stateStep!.status).toBe("skipped");
  });

  it("policy-eval step is complete when policy provided", async () => {
    const policyRuleset: PolicyRuleset = {
      id: "test-policy",
      version: "1.0",
      rules: [
        {
          id: "age-check",
          description: "Must be 18+",
          condition: { field: "age", operator: ">=", value: 18 },
          reason_if_failed: "Under 18",
        },
      ],
    };

    const orchestrator = new Orchestrator({ adapter, strategy });
    const result = await orchestrator.run({
      ...journeyInput,
      policyRuleset,
      policyContext: { age: 30 },
    });

    const policyStep = result.pipelineTrace!.steps.find((s) => s.id === "policy-eval");
    expect(policyStep!.status).toBe("complete");
    expect(policyStep!.detail).toContain("Eligible: true");
  });

  it("state-setup step is complete when state model provided", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });
    const result = await orchestrator.run(journeyInput);

    const stateStep = result.pipelineTrace!.steps.find((s) => s.id === "state-setup");
    expect(stateStep!.status).toBe("complete");
    expect(stateStep!.detail).toContain("not-started");
  });

  it("llm-call step has agentName matching selected agent", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });

    const journeyResult = await orchestrator.run(journeyInput);
    const journeyLlm = journeyResult.pipelineTrace!.steps.find((s) => s.id === "llm-call");
    expect(journeyLlm!.agentName).toBe("journey");

    const triageResult = await orchestrator.run(triageInput);
    const triageLlm = triageResult.pipelineTrace!.steps.find((s) => s.id === "llm-call");
    expect(triageLlm!.agentName).toBe("triage");
  });

  it("expected step IDs are all present", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });
    const result = await orchestrator.run(journeyInput);

    const stepIds = result.pipelineTrace!.steps.map((s) => s.id);
    expect(stepIds).toContain("policy-eval");
    expect(stepIds).toContain("state-setup");
    expect(stepIds).toContain("field-collector");
    expect(stepIds).toContain("agent-select");
    expect(stepIds).toContain("prompt-build");
    expect(stepIds).toContain("tool-build");
    expect(stepIds).toContain("llm-call");
    expect(stepIds).toContain("output-parse");
    expect(stepIds).toContain("state-transition");
    expect(stepIds).toContain("task-injection");
    expect(stepIds).toContain("consent-check");
    expect(stepIds).toContain("handoff-check");
  });
});

describe("Orchestrator.selectAgent", () => {
  it("returns triage when serviceId is empty", () => {
    expect(Orchestrator.selectAgent("")).toBe("triage");
  });

  it("returns triage when serviceId is 'triage'", () => {
    expect(Orchestrator.selectAgent("triage")).toBe("triage");
  });

  it("returns triage when no state model and state is not-started", () => {
    expect(Orchestrator.selectAgent("dwp.apply-universal-credit", undefined, "not-started")).toBe("triage");
  });

  it("returns triage when no state model and no current state", () => {
    expect(Orchestrator.selectAgent("dwp.apply-universal-credit")).toBe("triage");
  });

  it("returns journey when state model is provided", () => {
    expect(Orchestrator.selectAgent("dwp.apply-universal-credit", testStateModel, "not-started")).toBe("journey");
  });

  it("returns journey when state is beyond not-started even without model", () => {
    expect(Orchestrator.selectAgent("dwp.apply-universal-credit", undefined, "identity-verified")).toBe("journey");
  });
});

describe("Agent-specific prompts", () => {
  let adapter: LLMAdapter;
  let strategy: ServiceStrategy;

  beforeEach(() => {
    adapter = createMockAdapter();
    strategy = createMockStrategy();
  });

  it("triage prompt does NOT contain state model or field collector", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });
    await orchestrator.run(triageInput);

    const chatCall = (adapter.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const prompt: string = chatCall.systemPrompt;

    expect(prompt).not.toContain("STATE MODEL JOURNEY:");
    expect(prompt).not.toContain("FIELD COLLECTOR");
    expect(prompt).not.toContain("ACCURACY GUARDRAILS");
  });

  it("journey prompt contains state model and accuracy guardrails", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });
    await orchestrator.run(journeyInput);

    const chatCall = (adapter.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const prompt: string = chatCall.systemPrompt;

    expect(prompt).toContain("STATE MODEL JOURNEY:");
    expect(prompt).toContain("ACCURACY GUARDRAILS");
  });

  it("both prompts contain agent personality", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });

    await orchestrator.run(triageInput);
    const triageCall = (adapter.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(triageCall.systemPrompt).toContain("You are DOT agent.");

    (adapter.chat as ReturnType<typeof vi.fn>).mockClear();
    await orchestrator.run(journeyInput);
    const journeyCall = (adapter.chat as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(journeyCall.systemPrompt).toContain("You are DOT agent.");
  });

  it("both prompts contain fact extraction instructions", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });

    await orchestrator.run(triageInput);
    const triagePrompt = (adapter.chat as ReturnType<typeof vi.fn>).mock.calls[0][0].systemPrompt;
    expect(triagePrompt).toContain("PERSONAL DATA EXTRACTION:");

    (adapter.chat as ReturnType<typeof vi.fn>).mockClear();
    await orchestrator.run(journeyInput);
    const journeyPrompt = (adapter.chat as ReturnType<typeof vi.fn>).mock.calls[0][0].systemPrompt;
    expect(journeyPrompt).toContain("PERSONAL DATA EXTRACTION:");
  });

  it("pipeline trace shows correct agentUsed", async () => {
    const orchestrator = new Orchestrator({ adapter, strategy });

    const triageResult = await orchestrator.run(triageInput);
    expect(triageResult.pipelineTrace!.agentUsed).toBe("triage");

    const journeyResult = await orchestrator.run(journeyInput);
    expect(journeyResult.pipelineTrace!.agentUsed).toBe("journey");
  });
});
