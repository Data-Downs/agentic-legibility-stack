import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PipelineTraceBar } from "./PipelineTraceBar";
import type { PipelineTrace, PipelineStep } from "@als/schemas";

// Mock Zustand store (component doesn't use it, but imported transitively)
vi.mock("@/lib/store", () => ({
  useAppStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => selector({}),
    { getState: () => ({}), setState: vi.fn(), subscribe: vi.fn() }
  ),
}));

function makeStep(overrides: Partial<PipelineStep> = {}): PipelineStep {
  return {
    id: "test-step",
    name: "TestProcessor",
    type: "deterministic",
    label: "Test step",
    status: "complete",
    durationMs: 5,
    ...overrides,
  };
}

function makeTrace(overrides: Partial<PipelineTrace> = {}): PipelineTrace {
  return {
    traceId: "trace-1",
    steps: [
      makeStep({ id: "policy-eval", name: "PolicyEvaluator", type: "deterministic", label: "Policy evaluation", durationMs: 2 }),
      makeStep({ id: "llm-call", name: "LanguageAgent", type: "ai", label: "LLM generation", durationMs: 1200, agentName: "unified" }),
      makeStep({ id: "state-transition", name: "StateValidator", type: "deterministic", label: "State validation", status: "skipped", durationMs: 0 }),
    ],
    totalDurationMs: 1202,
    agentUsed: "unified",
    ...overrides,
  };
}

describe("PipelineTraceBar", () => {
  afterEach(cleanup);

  it("renders nothing when trace is null", () => {
    const { container } = render(<PipelineTraceBar trace={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders collapsed summary", () => {
    render(<PipelineTraceBar trace={makeTrace()} />);
    expect(screen.getByText(/3 steps/)).toBeInTheDocument();
    expect(screen.getByText(/1\.2s/)).toBeInTheDocument();
    expect(screen.getByText(/1 AI \+ 2 rule-based/)).toBeInTheDocument();
  });

  it("expands and collapses on click", () => {
    render(<PipelineTraceBar trace={makeTrace()} />);

    // Initially collapsed
    expect(screen.queryByTestId("pipeline-trace-expanded")).not.toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByTestId("pipeline-trace-expanded")).toBeInTheDocument();
    expect(screen.getByText("PolicyEvaluator")).toBeInTheDocument();
    expect(screen.getByText("LanguageAgent")).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByTestId("pipeline-trace-expanded")).not.toBeInTheDocument();
  });

  it("renders correct badges for AI and deterministic steps", () => {
    render(<PipelineTraceBar trace={makeTrace()} />);
    fireEvent.click(screen.getByRole("button"));

    const aiBadges = screen.getAllByTestId("badge-ai");
    const ruleBadges = screen.getAllByTestId("badge-deterministic");
    expect(aiBadges.length).toBe(1);
    expect(ruleBadges.length).toBe(2);
    expect(aiBadges[0].textContent).toBe("AI");
    expect(ruleBadges[0].textContent).toBe("Rule-based");
  });

  it("renders status icons correctly", () => {
    render(<PipelineTraceBar trace={makeTrace()} />);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getAllByText("✓").length).toBe(2);
    expect(screen.getAllByText("—").length).toBe(1);
  });

  it("renders error status icon", () => {
    const trace = makeTrace({
      steps: [makeStep({ id: "llm-call", name: "LanguageAgent", type: "ai", status: "error", durationMs: 0 })],
    });
    render(<PipelineTraceBar trace={trace} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("✗")).toBeInTheDocument();
  });

  it("shows agent name in collapsed summary for non-unified agent", () => {
    const trace = makeTrace({ agentUsed: "triage" });
    render(<PipelineTraceBar trace={trace} />);
    expect(screen.getByText(/Triage Agent/)).toBeInTheDocument();
  });

  it("does not show agent name for unified agent", () => {
    render(<PipelineTraceBar trace={makeTrace()} />);
    expect(screen.queryByText(/Unified Agent/)).not.toBeInTheDocument();
  });

  it("renders detail text when present", () => {
    const trace = makeTrace({
      steps: [makeStep({ detail: "Eligible: true, 5 passed" })],
    });
    render(<PipelineTraceBar trace={trace} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Eligible: true, 5 passed")).toBeInTheDocument();
  });
});
