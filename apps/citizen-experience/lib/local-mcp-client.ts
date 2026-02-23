/**
 * Local MCP Client — Connection to the local @als/mcp-server
 *
 * Spawns packages/mcp-server as a child process via stdio transport
 * and provides the same interface as mcp-client.ts (govmcp):
 *   - connectLocal()              → spawn server + connect
 *   - getLocalToolsForClaude()    → returns tools in Claude API format
 *   - callLocalTool(name, args)   → execute a tool call
 *   - isLocalConnected()          → check connection status
 *   - disconnectLocal()           → kill child process
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

let client: Client | null = null;
let transport: StdioClientTransport | null = null;
let connected = false;
let localTools: ClaudeTool[] = [];

export async function connectLocal(): Promise<boolean> {
  if (connected && client) return true;

  try {
    // Clean up any existing connection
    await disconnectLocal();

    const serverScript = path.resolve(
      process.cwd(),
      "../../packages/mcp-server/src/index.ts"
    );
    const servicesDir = path.resolve(process.cwd(), "../../data/services");

    transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", serverScript],
      env: {
        ...process.env,
        SERVICES_DIR: servicesDir,
      },
    });

    client = new Client({
      name: "citizen-experience-local",
      version: "0.1.0",
    });

    await client.connect(transport);
    connected = true;

    // List available tools
    const result = await client.listTools();
    localTools = (result.tools || []).map((t) => ({
      name: t.name,
      description: t.description || "",
      input_schema: (t.inputSchema as Record<string, unknown>) || {
        type: "object",
        properties: {},
      },
    }));

    console.log(
      `Local MCP: connected, ${localTools.length} service tools available`
    );
    return true;
  } catch (error) {
    connected = false;
    client = null;
    transport = null;
    localTools = [];
    console.error(
      "Local MCP connection failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

export function getLocalToolsForClaude(): ClaudeTool[] {
  if (!connected || localTools.length === 0) return [];
  return localTools;
}

export async function callLocalTool(
  name: string,
  args: Record<string, unknown> = {}
): Promise<string | { error: string }> {
  if (!connected || !client) {
    console.log("Local MCP disconnected, attempting reconnect...");
    const reconnected = await connectLocal();
    if (!reconnected) {
      return { error: "Local MCP server not connected" };
    }
  }

  try {
    const result = await client!.callTool({ name, arguments: args });
    if (result.content && Array.isArray(result.content)) {
      const textParts = (
        result.content as Array<{ type: string; text?: string }>
      )
        .filter((c) => c.type === "text")
        .map((c) => c.text || "");
      return textParts.join("\n");
    }
    return JSON.stringify(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Local MCP tool call failed (${name}):`, msg);

    // Try reconnecting once
    connected = false;
    const reconnected = await connectLocal();
    if (reconnected) {
      try {
        const result = await client!.callTool({ name, arguments: args });
        if (result.content && Array.isArray(result.content)) {
          const textParts = (
            result.content as Array<{ type: string; text?: string }>
          )
            .filter((c) => c.type === "text")
            .map((c) => c.text || "");
          return textParts.join("\n");
        }
        return JSON.stringify(result);
      } catch (retryError) {
        const retryMsg =
          retryError instanceof Error ? retryError.message : String(retryError);
        return { error: `Local MCP tool call failed: ${retryMsg}` };
      }
    }
    return { error: `Local MCP tool call failed: ${msg}` };
  }
}

export function isLocalConnected(): boolean {
  return connected;
}

export async function disconnectLocal(): Promise<void> {
  if (client) {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
    client = null;
  }
  if (transport) {
    try {
      await transport.close();
    } catch {
      /* ignore */
    }
    transport = null;
  }
  connected = false;
  localTools = [];
}
