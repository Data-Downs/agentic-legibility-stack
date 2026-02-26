/**
 * MCP Server factory for Studio — creates an McpServer backed by D1 data.
 *
 * Instead of loading from the filesystem (like the stdio server), this reads
 * all services from ServiceArtefactStore (D1), converts them to the in-memory
 * ArtefactStore format, then registers tools/resources/prompts using the same
 * generators from @als/mcp-server.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ArtefactStore } from "@als/legibility";
import type { ServiceArtefacts } from "@als/legibility";
import { generateAllTools } from "@als/mcp-server/src/tool-generator";
import { handleToolCall } from "@als/mcp-server/src/tool-handlers";
import { registerAllResources } from "@als/mcp-server/src/resource-generator";
import { registerAllPrompts } from "@als/mcp-server/src/prompt-generator";
import { getServiceArtefactStore } from "./service-store-init";
import type { ServiceWithArtefacts } from "./service-store-imports";

/** Zod input shapes for tool registration (mirrored from @als/mcp-server/src/server.ts) */
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

/** Convert a ServiceWithArtefacts (D1 row) to the in-memory ServiceArtefacts format */
function toServiceArtefacts(svc: ServiceWithArtefacts): ServiceArtefacts {
  return {
    manifest: svc.manifest,
    policy: svc.policy ?? undefined,
    stateModel: svc.stateModel ?? undefined,
    consent: svc.consent ?? undefined,
  };
}

/**
 * Create an McpServer instance populated from D1 service data.
 * Each call returns a fresh server — suitable for stateless per-request usage.
 */
export async function createMcpServerFromD1(): Promise<{
  server: McpServer;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
  serviceCount: number;
}> {
  // 1. Load all services from D1
  const artefactStoreDb = await getServiceArtefactStore();
  const allServices = await artefactStoreDb.listServices();

  // 2. Populate in-memory ArtefactStore
  const store = new ArtefactStore();
  let serviceCount = 0;

  for (const summary of allServices) {
    const full = await artefactStoreDb.getService(summary.id);
    if (!full) continue;
    store.register(full.id, toServiceArtefacts(full));
    serviceCount++;
  }

  // 3. Create McpServer
  const mcpServer = new McpServer(
    { name: "als-gov-services", version: "0.3.0" },
    { capabilities: { resources: {}, tools: {}, prompts: {} } }
  );

  // 4. Register resources
  const resourceCount = registerAllResources(mcpServer, store);

  // 5. Register tools
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

  // 6. Register prompts
  const promptCount = registerAllPrompts(mcpServer, store);

  console.log(
    `[MCP/D1] Server ready: ${serviceCount} services, ${resourceCount} resources, ${tools.length} tools, ${promptCount} prompts`
  );

  return {
    server: mcpServer,
    toolCount: tools.length,
    resourceCount,
    promptCount,
    serviceCount,
  };
}
