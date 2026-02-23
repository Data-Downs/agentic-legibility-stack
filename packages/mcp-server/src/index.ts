/**
 * @als/mcp-server — Local MCP server for service artefacts
 *
 * Exposes government service capabilities as MCP primitives:
 *   - Resources: service metadata, policy, consent, state-model per service
 *   - Tools: check_eligibility, advance_state per service (with annotations)
 *   - Prompts: journey template, eligibility check template per service
 *
 * Transport: stdio (standard MCP pattern for local servers)
 * Usage: npx tsx packages/mcp-server/src/index.ts
 */

import path from "path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";

async function main() {
  const servicesDir =
    process.env.SERVICES_DIR ||
    path.resolve(import.meta.dirname, "../../../data/services");

  console.error(`[MCP Server] Loading services from: ${servicesDir}`);

  const { server, toolCount, resourceCount, promptCount, serviceCount } = await createServer(servicesDir);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `[MCP Server] Running on stdio — ${serviceCount} services, ${resourceCount} resources, ${toolCount} tools, ${promptCount} prompts`
  );
}

main().catch((err) => {
  console.error("[MCP Server] Fatal error:", err);
  process.exit(1);
});
