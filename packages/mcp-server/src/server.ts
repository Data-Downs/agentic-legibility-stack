/**
 * server.ts — MCP Server setup using high-level McpServer API
 *
 * Creates an MCP server that exposes government service artefacts as:
 *   - Resources: manifest, policy, consent, state-model per service
 *   - Tools: check_eligibility (read-only), advance_state (mutating) per service
 *   - Prompts: journey template, eligibility check template per service
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ArtefactStore } from "@als/legibility";
import { generateAllTools } from "./tool-generator";
import { handleToolCall } from "./tool-handlers";
import { registerAllResources } from "./resource-generator";
import { registerAllPrompts } from "./prompt-generator";

/** Map tool action names to Zod input shapes for registerTool */
const TOOL_ZOD_SCHEMAS: Record<string, Record<string, z.ZodType>> = {
  check_eligibility: {
    citizen_data: z.record(z.string(), z.unknown()).describe(
      "Citizen context data for policy evaluation (e.g. age, jurisdiction, employment_status, savings, etc.)"
    ),
  },
  advance_state: {
    current_state: z.string().describe("Current state ID"),
    trigger: z.string().describe("Transition trigger name"),
  },
};

export async function createServer(servicesDir: string, options?: { dbPath?: string }): Promise<{
  server: McpServer;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  serviceCount: number;
}> {
  const store = new ArtefactStore();
  let serviceCount = 0;

  // Prefer DB if available, fall back to filesystem
  if (options?.dbPath) {
    try {
      serviceCount = await store.loadFromServiceStoreDb(options.dbPath);
      console.error(`[MCP Server] Loaded ${serviceCount} services from DB`);
    } catch (err) {
      console.error(`[MCP Server] DB load failed, falling back to filesystem:`, err);
      serviceCount = await store.loadFromDirectory(servicesDir);
    }
  } else {
    serviceCount = await store.loadFromDirectory(servicesDir);
  }

  const mcpServer = new McpServer(
    { name: "als-service-tools", version: "0.2.0" },
    { capabilities: { resources: {}, tools: {}, prompts: {} } }
  );

  // ── Resources (4 per service: manifest, policy, consent, state-model) ──
  const resourceCount = registerAllResources(mcpServer, store);

  // ── Tools (2 per service: check_eligibility, advance_state) ──
  const { tools, toolMap } = generateAllTools(store);

  for (const tool of tools) {
    const mapping = toolMap.get(tool.name);
    if (!mapping) continue;

    const zodShape = TOOL_ZOD_SCHEMAS[mapping.action];
    if (!zodShape) continue;

    mcpServer.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: zodShape,
        annotations: tool.annotations,
      },
      (args: Record<string, unknown>) => {
        const result = handleToolCall(tool.name, args, store, toolMap);
        return result as CallToolResult;
      }
    );
  }

  // ── Prompts (journey + eligibility_check per service) ──
  const promptCount = registerAllPrompts(mcpServer, store);

  console.error(
    `[MCP Server] Loaded ${serviceCount} services: ${resourceCount} resources, ${tools.length} tools, ${promptCount} prompts`
  );
  for (const [name, mapping] of toolMap) {
    console.error(`  - tool: ${name} → ${mapping.serviceId}:${mapping.action}`);
  }

  return { server: mcpServer, toolCount: tools.length, resourceCount, promptCount, serviceCount };
}
