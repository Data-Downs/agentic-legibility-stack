import { describe, it, expect, beforeEach } from "vitest";
import { CapabilityInvoker } from "./capability-invoker";
import { HandoffManager } from "./handoff-manager";
import { ServiceRegistry } from "./service-registry";
import type { InvocationContext, CapabilityManifest } from "@als/schemas";

// ── CapabilityInvoker ──

describe("CapabilityInvoker", () => {
  let invoker: CapabilityInvoker;
  const context: InvocationContext = {
    sessionId: "sess-1",
    traceId: "trace-1",
    userId: "user-1",
  };

  beforeEach(() => {
    invoker = new CapabilityInvoker();
  });

  it("invokes a registered handler and returns success", async () => {
    invoker.registerHandler("test.service", async (input) => {
      return { result: "ok", input };
    });

    const result = await invoker.invoke("test.service", { key: "value" }, context);
    expect(result.success).toBe(true);
    expect(result.capabilityId).toBe("test.service");
    expect(result.output).toEqual({ result: "ok", input: { key: "value" } });
    expect(result.receipt).toBeDefined();
    expect(result.receipt!.id).toMatch(/^rcpt_/);
    expect(result.receipt!.outcome).toBe("success");
    expect(result.traceEvents.length).toBeGreaterThanOrEqual(2); // invoked + result + receipt
  });

  it("rejects unknown capabilities", async () => {
    const result = await invoker.invoke("nonexistent.service", {}, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No handler registered");
    expect(result.receipt).toBeUndefined();
    expect(result.traceEvents.some((e) => e.type === "error.raised")).toBe(true);
  });

  it("emits capability.invoked trace event", async () => {
    invoker.registerHandler("svc", async () => "done");
    const result = await invoker.invoke("svc", {}, context);
    const invokedEvent = result.traceEvents.find((e) => e.type === "capability.invoked");
    expect(invokedEvent).toBeDefined();
    expect(invokedEvent!.payload.capabilityId).toBe("svc");
  });

  it("emits capability.result on success", async () => {
    invoker.registerHandler("svc", async () => "done");
    const result = await invoker.invoke("svc", {}, context);
    const resultEvent = result.traceEvents.find((e) => e.type === "capability.result");
    expect(resultEvent).toBeDefined();
    expect(resultEvent!.payload.success).toBe(true);
  });

  it("emits receipt.issued trace event on success", async () => {
    invoker.registerHandler("svc", async () => "done");
    const result = await invoker.invoke("svc", {}, context);
    const receiptEvent = result.traceEvents.find((e) => e.type === "receipt.issued");
    expect(receiptEvent).toBeDefined();
  });

  it("handles handler throwing an error", async () => {
    invoker.registerHandler("failing", async () => {
      throw new Error("Service unavailable");
    });
    const result = await invoker.invoke("failing", {}, context);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Service unavailable");
    expect(result.traceEvents.some((e) => e.type === "error.raised")).toBe(true);
  });

  it("routes through the full pipeline: trace → receipt", async () => {
    invoker.registerHandler("full-pipeline", async (input, ctx) => {
      return { processed: true, sessionId: ctx.sessionId };
    });

    const result = await invoker.invoke("full-pipeline", { data: "test" }, context);
    expect(result.success).toBe(true);

    // Check trace events in order
    const types = result.traceEvents.map((e) => e.type);
    expect(types).toContain("capability.invoked");
    expect(types).toContain("capability.result");
    expect(types).toContain("receipt.issued");

    // All trace events have correct metadata
    for (const event of result.traceEvents) {
      expect(event.traceId).toBe("trace-1");
      expect(event.metadata.sessionId).toBe("sess-1");
      expect(event.metadata.capabilityId).toBe("full-pipeline");
    }
  });
});

// ── HandoffManager ──

describe("HandoffManager", () => {
  let manager: HandoffManager;

  beforeEach(() => {
    manager = new HandoffManager();
  });

  describe("safeguarding keywords", () => {
    const keywords = [
      "suicide", "self-harm", "kill myself", "end my life",
      "domestic abuse", "being hurt", "violence",
      "child protection", "child abuse",
      "homeless", "sleeping rough",
      "no food", "starving",
    ];

    for (const keyword of keywords) {
      it(`triggers on "${keyword}"`, () => {
        const result = manager.evaluateTriggers(`I am experiencing ${keyword}`);
        expect(result.triggered).toBe(true);
        expect(result.reason).toBe("safeguarding-concern");
      });
    }

    it("is case-insensitive", () => {
      const result = manager.evaluateTriggers("I am HOMELESS and need help");
      expect(result.triggered).toBe(true);
      expect(result.reason).toBe("safeguarding-concern");
    });
  });

  describe("citizen request keywords", () => {
    const keywords = [
      "speak to someone", "talk to a human", "real person",
      "human agent", "want to complain", "make a complaint",
    ];

    for (const keyword of keywords) {
      it(`triggers on "${keyword}"`, () => {
        const result = manager.evaluateTriggers(`I want to ${keyword}`);
        expect(result.triggered).toBe(true);
        expect(result.reason).toBe("citizen-requested");
      });
    }
  });

  it("does not trigger on normal messages", () => {
    const result = manager.evaluateTriggers("I want to check my pension forecast");
    expect(result.triggered).toBe(false);
  });

  it("triggers on policy edge case", () => {
    const result = manager.evaluateTriggers("Normal message", {
      policyEdgeCase: true,
    });
    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("policy-edge-case");
  });

  it("triggers on repeated failure (3+ attempts)", () => {
    manager.evaluateTriggers("fail", { failureKey: "lookup" });
    manager.evaluateTriggers("fail", { failureKey: "lookup" });
    const result = manager.evaluateTriggers("fail", { failureKey: "lookup" });
    expect(result.triggered).toBe(true);
    expect(result.reason).toBe("repeated-failure");
    expect(result.description).toContain("3 times");
  });

  it("does not trigger before 3 failures", () => {
    manager.evaluateTriggers("fail", { failureKey: "op" });
    const result = manager.evaluateTriggers("fail", { failureKey: "op" });
    expect(result.triggered).toBe(false);
  });

  it("resetFailures clears failure count", () => {
    manager.evaluateTriggers("fail", { failureKey: "op" });
    manager.evaluateTriggers("fail", { failureKey: "op" });
    manager.resetFailures("op");
    manager.evaluateTriggers("fail", { failureKey: "op" });
    const result = manager.evaluateTriggers("fail", { failureKey: "op" });
    expect(result.triggered).toBe(false);
  });

  it("createPackage produces well-formed HandoffPackage", () => {
    const pkg = manager.createPackage({
      reason: "safeguarding-concern",
      description: "Safeguarding keyword detected",
      agentAssessment: "Citizen mentioned domestic abuse",
      citizen: { name: "Alice", phone: "07700900000", email: "alice@test.com" },
      stepsCompleted: ["identity-verified"],
      stepsBlocked: ["eligibility-check"],
      dataCollected: ["name", "ni-number"],
      timeSpent: "5 minutes",
      traceId: "trace-1",
      receiptIds: ["rcpt-1"],
    });

    expect(pkg.id).toMatch(/^handoff_/);
    expect(pkg.urgency).toBe("safeguarding");
    expect(pkg.citizen.name).toBe("Alice");
    expect(pkg.reason.category).toBe("safeguarding-concern");
    expect(pkg.traceId).toBe("trace-1");
    expect(pkg.receiptIds).toEqual(["rcpt-1"]);
    expect(pkg.suggestedActions.length).toBeGreaterThan(0);
    expect(pkg.suggestedActions[0]).toContain("safeguarding");
    expect(pkg.routing.department).toBe("Unknown");
  });

  it("createPackage sets urgency based on reason", () => {
    const mkPkg = (reason: string) =>
      manager.createPackage({
        reason: reason as any,
        description: "test",
        agentAssessment: "test",
        citizen: { name: "Test" },
        stepsCompleted: [],
        stepsBlocked: [],
        dataCollected: [],
        timeSpent: "1m",
        traceId: "t",
        receiptIds: [],
      });

    expect(mkPkg("safeguarding-concern").urgency).toBe("safeguarding");
    expect(mkPkg("repeated-failure").urgency).toBe("priority");
    expect(mkPkg("citizen-requested").urgency).toBe("routine");
  });
});

// ── ServiceRegistry ──

describe("ServiceRegistry", () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it("registers and looks up manifests", () => {
    const manifest: CapabilityManifest = {
      id: "test.service",
      version: "1.0.0",
      name: "Test Service",
      description: "A test",
      department: "Test",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
    };
    registry.register(manifest);
    expect(registry.lookup("test.service")).toBe(manifest);
    expect(registry.has("test.service")).toBe(true);
  });

  it("returns undefined for unknown capability", () => {
    expect(registry.lookup("unknown")).toBeUndefined();
    expect(registry.has("unknown")).toBe(false);
  });

  it("listAll returns all registered manifests", () => {
    registry.register({ id: "svc-1", name: "S1" } as CapabilityManifest);
    registry.register({ id: "svc-2", name: "S2" } as CapabilityManifest);
    const all = registry.listAll();
    expect(all).toHaveLength(2);
  });

  it("size returns count", () => {
    expect(registry.size).toBe(0);
    registry.register({ id: "svc-1" } as CapabilityManifest);
    expect(registry.size).toBe(1);
  });

  it("loadFromDirectory loads real manifests", async () => {
    const path = await import("path");
    const servicesDir = path.resolve(__dirname, "../../../data/services");
    const count = await registry.loadFromDirectory(servicesDir);
    expect(count).toBeGreaterThanOrEqual(4);
    expect(registry.size).toBeGreaterThanOrEqual(4);
  });
});
