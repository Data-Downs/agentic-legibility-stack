/**
 * server.ts — MCP Server setup
 *
 * Creates an MCP server that exposes service tools generated from
 * the JSON artefacts in data/services/. Handles tools/list and tools/call.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ArtefactStore } from "@als/legibility";
import { generateAllTools, type ToolMapping, type McpToolDefinition } from "./tool-generator";
import { handleToolCall } from "./tool-handlers";

export async function createServer(servicesDir: string): Promise<{
  server: Server;
  toolCount: number;
  serviceCount: number;
}> {
  const store = new ArtefactStore();
  const serviceCount = await store.loadFromDirectory(servicesDir);

  const { tools, toolMap } = generateAllTools(store);

  console.error(
    `[MCP Server] Loaded ${serviceCount} services, ${tools.length} tools`
  );
  for (const [name, mapping] of toolMap) {
    console.error(`  - ${name} → ${mapping.serviceId}:${mapping.action}`);
  }

  const server = new Server(
    { name: "als-service-tools", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = handleToolCall(name, args || {}, store, toolMap);
    return result as unknown as Record<string, unknown>;
  });

  return { server, toolCount: tools.length, serviceCount };
}
