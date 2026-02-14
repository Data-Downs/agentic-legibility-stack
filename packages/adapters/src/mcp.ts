/**
 * McpAdapter — Model Context Protocol adapter (placeholder)
 *
 * When fully implemented, this adapter will connect to an MCP server
 * and route tool calls through the MCP protocol. For now, it provides
 * the interface and delegates to the existing mcp-client module.
 */

import type { ServiceAdapter, AdapterConfig, AdapterRequest, AdapterResponse } from "./service-adapter";

export interface McpToolInput {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface McpToolOutput {
  result: unknown;
  toolName: string;
}

export class McpAdapter implements ServiceAdapter {
  readonly type = "mcp";
  private serverUrl: string | null = null;
  private ready = false;
  private toolCallFn: ((name: string, args: Record<string, unknown>) => Promise<unknown>) | null = null;

  initialize(config: AdapterConfig): void {
    if (config.baseUrl) this.serverUrl = config.baseUrl as string;
    this.ready = true;
  }

  /** Register an external tool-call function (for bridging to existing mcp-client) */
  setToolCallFunction(fn: (name: string, args: Record<string, unknown>) => Promise<unknown>): void {
    this.toolCallFn = fn;
  }

  isReady(): boolean {
    return this.ready;
  }

  async execute(request: AdapterRequest): Promise<AdapterResponse> {
    if (!this.ready) {
      return { success: false, error: "MCP adapter not initialized" };
    }

    const input = request.input as McpToolInput;

    try {
      let result: unknown;

      if (this.toolCallFn) {
        // Use the registered tool-call function (bridges to existing mcp-client)
        result = await this.toolCallFn(input.toolName, input.arguments);
      } else if (this.serverUrl) {
        // Direct MCP server call (future implementation)
        const resp = await fetch(this.serverUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "tools/call",
            params: {
              name: input.toolName,
              arguments: input.arguments,
            },
          }),
        });

        if (!resp.ok) {
          return {
            success: false,
            error: `MCP server returned ${resp.status}`,
          };
        }

        const data = await resp.json();
        result = data.result;
      } else {
        return {
          success: false,
          error: "MCP adapter has no server URL and no tool-call function",
        };
      }

      const output: McpToolOutput = {
        result,
        toolName: input.toolName,
      };

      return {
        success: true,
        output,
        metadata: { toolName: input.toolName },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async shutdown(): Promise<void> {
    this.serverUrl = null;
    this.toolCallFn = null;
    this.ready = false;
  }
}
