/**
 * JsonServiceStrategy — Inline policy/state handling for JSON mode.
 *
 * All service logic is handled deterministically by the Orchestrator:
 * policy evaluation, state transitions, consent tracking. The LLM
 * only receives govmcp tools (live GOV.UK data) and generates language.
 */

import type { ServiceStrategy, ServiceStrategyContext, ToolDefinition } from "./service-strategy";

export class JsonServiceStrategy implements ServiceStrategy {
  private govmcpTools: ToolDefinition[];
  private toolDispatcher: ((name: string, input: unknown) => Promise<string>) | null;

  constructor(opts?: {
    govmcpTools?: ToolDefinition[];
    toolDispatcher?: (name: string, input: unknown) => Promise<string>;
  }) {
    this.govmcpTools = opts?.govmcpTools || [];
    this.toolDispatcher = opts?.toolDispatcher || null;
  }

  buildTools(_ctx: ServiceStrategyContext): ToolDefinition[] {
    return this.govmcpTools;
  }

  buildServiceContext(ctx: ServiceStrategyContext): string {
    const lines: string[] = [];

    // Policy evaluation results
    if (ctx.policyResult) {
      const pr = ctx.policyResult;
      lines.push(`POLICY EVALUATION (${ctx.serviceId}):`);
      lines.push(`Eligibility: ${pr.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}`);
      lines.push(pr.explanation);

      if (pr.passed.length > 0) {
        lines.push("");
        lines.push("Rules passed:");
        for (const r of pr.passed) {
          lines.push(`  - ${r.description}`);
        }
      }
      if (pr.failed.length > 0) {
        lines.push("");
        lines.push("Rules failed:");
        for (const r of pr.failed) {
          lines.push(`  - ${r.description}: ${r.reason_if_failed}`);
        }
      }
      if (pr.edgeCases.length > 0) {
        lines.push("");
        lines.push("Edge cases detected:");
        for (const e of pr.edgeCases) {
          lines.push(`  - ${e.description}: ${e.action}`);
        }
        lines.push("IMPORTANT: Mention relevant edge cases to the user and explain any implications.");
      }
    }

    // Tool instructions (govmcp only)
    if (this.govmcpTools.length > 0) {
      const postcode = (ctx.personaData.address as Record<string, unknown>)?.postcode || "";
      lines.push("");
      lines.push("LIVE GOV.UK DATA TOOLS:");
      lines.push("You have access to tools that can look up real, current UK government data.");
      lines.push("Use these when the user asks questions that benefit from real, up-to-date information.");
      lines.push(`For example:`);
      lines.push(`- search_govuk to find official guidance on benefits, driving, parenting, tax`);
      lines.push(`- govuk_content to fetch a specific GOV.UK page by its path`);
      lines.push(`- find_mp to look up the user's MP (their postcode is ${postcode})`);
      lines.push(`- lookup_postcode for local council and constituency info (their postcode is ${postcode})`);
      lines.push(`- ea_current_floods to check flood warnings in their area`);
      lines.push(`- get_bank_holidays for upcoming bank holidays`);
      lines.push(`- search_hansard to find what Parliament has discussed on a topic`);
      lines.push(`- find_courts to find nearby courts`);
      lines.push(`- fsa_food_alerts_search for current food safety alerts`);
      lines.push("");
      lines.push("When you use these tools, present the information naturally as part of your response.");
      lines.push('Do NOT mention "tools" or "MCP" to the user — just weave the real data into your answer.');
      lines.push("Always prefer real data from tools over making up or guessing information.");
    }

    return lines.join("\n");
  }

  async dispatchToolCall(name: string, input: unknown): Promise<string> {
    if (this.toolDispatcher) {
      return this.toolDispatcher(name, input);
    }
    return JSON.stringify({ error: `No dispatcher for tool: ${name}` });
  }

  extractStateTransitions(
    _loopMessages: Array<{ role: string; content: unknown }>
  ): Array<{ fromState: string; toState: string; trigger: string }> {
    // JSON mode: state transitions come from structured output, not tool results
    return [];
  }
}
