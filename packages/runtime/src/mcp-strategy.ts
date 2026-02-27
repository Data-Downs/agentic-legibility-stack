/**
 * McpServiceStrategy — Delegates policy/state logic to local MCP server tools.
 *
 * In MCP mode, the LLM has access to local service tools (_check_eligibility,
 * _advance_state) plus govmcp tools. State transitions are extracted from
 * _advance_state tool results.
 */

import type { ServiceStrategy, ServiceStrategyContext, ToolDefinition } from "./service-strategy";

const SERVICE_TOOL_ACTIONS = ["_check_eligibility", "_advance_state"];

function isLocalServiceTool(name: string): boolean {
  return SERVICE_TOOL_ACTIONS.some((action) => name.endsWith(action));
}

export class McpServiceStrategy implements ServiceStrategy {
  private localTools: ToolDefinition[];
  private govmcpTools: ToolDefinition[];
  private localToolDispatcher: (name: string, input: unknown) => Promise<string>;
  private govmcpToolDispatcher: (name: string, input: unknown) => Promise<string>;
  private mcpResourceReader?: (uri: string) => Promise<string | null>;
  private mcpPromptReader?: (name: string) => Promise<{ messages?: Array<{ content?: { text?: string } }> } | null>;

  constructor(opts: {
    localTools: ToolDefinition[];
    govmcpTools?: ToolDefinition[];
    localToolDispatcher: (name: string, input: unknown) => Promise<string>;
    govmcpToolDispatcher: (name: string, input: unknown) => Promise<string>;
    mcpResourceReader?: (uri: string) => Promise<string | null>;
    mcpPromptReader?: (name: string) => Promise<{ messages?: Array<{ content?: { text?: string } }> } | null>;
  }) {
    this.localTools = opts.localTools;
    this.govmcpTools = opts.govmcpTools || [];
    this.localToolDispatcher = opts.localToolDispatcher;
    this.govmcpToolDispatcher = opts.govmcpToolDispatcher;
    this.mcpResourceReader = opts.mcpResourceReader;
    this.mcpPromptReader = opts.mcpPromptReader;
  }

  buildTools(_ctx: ServiceStrategyContext): ToolDefinition[] {
    return [...this.localTools, ...this.govmcpTools];
  }

  async buildServiceContext(ctx: ServiceStrategyContext): Promise<string> {
    const lines: string[] = [];

    // Load MCP resources (manifest, policy, consent, state-model)
    if (this.mcpResourceReader) {
      const resources = [
        { key: "manifest", uri: `service://${ctx.serviceId}/manifest`, label: "SERVICE MANIFEST" },
        { key: "policy", uri: `service://${ctx.serviceId}/policy`, label: "POLICY RULES" },
        { key: "consent", uri: `service://${ctx.serviceId}/consent`, label: "CONSENT MODEL" },
        { key: "stateModel", uri: `service://${ctx.serviceId}/state-model`, label: "STATE MODEL" },
      ];
      for (const res of resources) {
        try {
          const json = await this.mcpResourceReader(res.uri);
          if (json) lines.push(`\n${res.label}:\n${json}`);
        } catch { /* optional */ }
      }
    }

    // Load journey prompt template
    if (this.mcpPromptReader) {
      const slug = ctx.serviceId.split(".").slice(1).join(".").replace(/-/g, "_");
      try {
        const journeyPrompt = await this.mcpPromptReader(`${slug}_journey`);
        if (journeyPrompt?.messages?.[0]?.content?.text) {
          lines.push(`\nJOURNEY GUIDE:\n${journeyPrompt.messages[0].content.text}`);
        }
      } catch { /* optional */ }
    }

    // Service tool instructions
    const postcode = (ctx.personaData.address as Record<string, unknown>)?.postcode || "";
    lines.push("");
    lines.push("SERVICE TOOLS (MCP MODE):");
    lines.push("You have access to tools for the government service the citizen is using.");
    lines.push("");
    lines.push("For the current service, use these tools to guide the citizen:");
    lines.push("- Use the _check_eligibility tool to evaluate whether the citizen qualifies (pass their data as citizen_data)");
    lines.push("- Use the _advance_state tool to transition to the next step (provide current_state and trigger)");
    lines.push("");
    lines.push(`IMPORTANT: The citizen's current state is "${ctx.currentState}". When using _advance_state, pass this as current_state.`);
    lines.push("After advancing state, tell the citizen what happened and what comes next.");
    lines.push("Do NOT fabricate eligibility results, payment amounts, dates, or reference numbers — use the tools.");
    lines.push("");
    lines.push("The citizen's data for eligibility checks:");
    lines.push(JSON.stringify(ctx.personaData, null, 2));

    // Govmcp tool instructions
    lines.push("");
    lines.push("LIVE GOV.UK DATA TOOLS:");
    lines.push("You also have access to tools for real UK government data.");
    lines.push("For example:");
    lines.push(`- search_govuk for official guidance`);
    lines.push(`- lookup_postcode for local info (citizen postcode: ${postcode})`);
    lines.push(`- find_mp for constituency MP`);
    lines.push(`- ea_current_floods for flood warnings`);
    lines.push("");
    lines.push('Present all information naturally. Do NOT mention "tools" or "MCP" to the user.');

    return lines.join("\n");
  }

  async dispatchToolCall(name: string, input: unknown): Promise<string> {
    if (isLocalServiceTool(name)) {
      return this.localToolDispatcher(name, input);
    }
    return this.govmcpToolDispatcher(name, input);
  }

  extractStateTransitions(
    loopMessages: Array<{ role: string; content: unknown }>
  ): Array<{ fromState: string; toState: string; trigger: string }> {
    const transitions: Array<{ fromState: string; toState: string; trigger: string }> = [];

    for (const msg of loopMessages) {
      if (msg.role === "user" && Array.isArray(msg.content)) {
        for (const part of msg.content as Array<Record<string, unknown>>) {
          if (part.type === "tool_result" && typeof part.content === "string") {
            try {
              const parsed = JSON.parse(part.content as string);
              if (parsed.success && parsed.fromState && parsed.toState) {
                transitions.push({
                  fromState: parsed.fromState,
                  toState: parsed.toState,
                  trigger: parsed.trigger || "unknown",
                });
              }
            } catch { /* not JSON or not a state transition result */ }
          }
        }
      }
    }

    return transitions;
  }
}
