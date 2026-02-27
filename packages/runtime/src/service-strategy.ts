/**
 * ServiceStrategy — Pluggable strategy for how the Orchestrator interacts
 * with government services.
 *
 * Two implementations:
 *   - JsonServiceStrategy: inline policy/state handling (deterministic)
 *   - McpServiceStrategy: delegates to MCP server tools
 */

import type { PolicyResult, StateInstructions } from "@als/schemas";
import type { ServiceArtefacts } from "@als/legibility";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ServiceStrategyContext {
  serviceId: string;
  personaData: Record<string, unknown>;
  currentState: string;
  stateHistory: string[];
  policyResult?: PolicyResult;
  artefacts?: ServiceArtefacts;
  stateInstructions?: StateInstructions;
}

export interface ServiceStrategy {
  /** Get tools to include in the LLM call */
  buildTools(ctx: ServiceStrategyContext): ToolDefinition[];

  /** Build service-specific context for the system prompt */
  buildServiceContext(ctx: ServiceStrategyContext): string | Promise<string>;

  /** Dispatch a tool call and return the result string */
  dispatchToolCall(name: string, input: unknown): Promise<string>;

  /** Extract state transitions from MCP tool results (MCP mode only) */
  extractStateTransitions(loopMessages: Array<{ role: string; content: unknown }>): Array<{
    fromState: string;
    toState: string;
    trigger: string;
  }>;
}
