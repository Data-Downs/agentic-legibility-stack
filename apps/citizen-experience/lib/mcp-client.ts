/**
 * MCP Client — Connection to govmcp MCP Server
 *
 * Manages the connection to govmcp (https://govmcp.considerate.digital)
 * which wraps 48 UK government APIs. Provides a clean interface:
 *   - connect()           → establish SSE connection
 *   - getToolsForClaude() → returns tools in Claude API format
 *   - callTool(name, args)       → execute a tool call
 *   - callToolCached(name, args) → same but with 1-hour cache
 *   - isConnected()       → check connection status
 *
 * If govmcp is unavailable, everything gracefully returns empty/false.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const GOVMCP_URL = "https://govmcp.considerate.digital/sse";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const CURATED_TOOLS = new Set([
  "search_govuk",
  "govuk_content",
  "lookup_postcode",
  "find_mp",
  "find_courts",
  "get_bank_holidays",
  "ea_current_floods",
  "police_crimes_near_postcode",
  "fsa_fhrs_establishments",
  "epc_search_domestic",
  "search_hansard",
  "fsa_food_alerts_search",
]);

interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

let client: Client | null = null;
let transport: SSEClientTransport | null = null;
let connected = false;
let curatedTools: ClaudeTool[] = [];
let reconnecting = false;
let lastReconnectTime = 0;
let consecutiveFailures = 0;
const RECONNECT_COOLDOWN = 30000;
const MAX_AUTO_RETRIES = 10;

const cache = new Map<string, { data: unknown; timestamp: number }>();

export async function connect(): Promise<boolean> {
  try {
    if (transport) {
      try {
        await transport.close();
      } catch {
        /* ignore */
      }
      transport = null;
    }
    if (client) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
      client = null;
    }

    transport = new SSEClientTransport(new URL(GOVMCP_URL));

    transport.onclose = () => {
      if (connected) {
        console.log("MCP connection closed");
        connected = false;
      }
      scheduleReconnect();
    };

    transport.onerror = (error: Error) => {
      if (connected) {
        console.error("MCP transport error:", error.message);
        connected = false;
      }
      scheduleReconnect();
    };

    client = new Client({
      name: "agentic-legibility-stack",
      version: "0.1.0",
    });

    await client.connect(transport);
    connected = true;
    reconnecting = false;
    consecutiveFailures = 0;

    const toolsResult = await client.listTools();
    const allTools = toolsResult.tools || [];

    curatedTools = allTools
      .filter((tool) => CURATED_TOOLS.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        description: tool.description || "",
        input_schema: (tool.inputSchema as Record<string, unknown>) || {
          type: "object",
          properties: {},
        },
      }));

    console.log(
      `MCP: ${allTools.length} tools available, ${curatedTools.length} curated`
    );
    return true;
  } catch (error) {
    connected = false;
    client = null;
    transport = null;
    console.error(
      "MCP connection failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

export function getToolsForClaude(): ClaudeTool[] {
  if (!connected || curatedTools.length === 0) return [];
  return curatedTools;
}

async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
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
}

export async function callTool(
  name: string,
  args: Record<string, unknown> = {}
): Promise<string | { error: string }> {
  if (!connected || !client) {
    console.log("MCP disconnected, attempting reconnect...");
    consecutiveFailures = 0;
    const reconnected = await connect();
    if (!reconnected) {
      return { error: "MCP server not connected" };
    }
  }

  try {
    return await executeTool(name, args);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("No active transport")) {
      console.log("Connection dropped, reconnecting...");
      connected = false;
      const reconnected = await connect();
      if (reconnected) {
        try {
          return await executeTool(name, args);
        } catch (retryError) {
          const retryMsg =
            retryError instanceof Error ? retryError.message : String(retryError);
          console.error(`Tool call failed after reconnect (${name}):`, retryMsg);
          return { error: `Tool call failed: ${retryMsg}` };
        }
      }
    }
    console.error(`Tool call failed (${name}):`, msg);
    return { error: `Tool call failed: ${msg}` };
  }
}

export async function callToolCached(
  name: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const cacheKey = `${name}:${JSON.stringify(args)}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const result = await callTool(name, args);
  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

export function isConnected(): boolean {
  return connected;
}

function scheduleReconnect() {
  if (reconnecting) return;
  const now = Date.now();
  if (now - lastReconnectTime < RECONNECT_COOLDOWN) return;
  if (consecutiveFailures >= MAX_AUTO_RETRIES) {
    if (consecutiveFailures === MAX_AUTO_RETRIES) {
      console.log(
        `MCP auto-reconnect paused after ${MAX_AUTO_RETRIES} failures`
      );
      consecutiveFailures++;
    }
    return;
  }

  reconnecting = true;
  lastReconnectTime = now;

  setTimeout(() => {
    console.log("Auto-reconnecting to govmcp...");
    connect()
      .then((success) => {
        if (success) {
          console.log("Reconnected to govmcp");
        } else {
          consecutiveFailures++;
          reconnecting = false;
        }
      })
      .catch((err) => {
        consecutiveFailures++;
        console.error("Reconnect error:", err.message);
        reconnecting = false;
      });
  }, 5000);
}
