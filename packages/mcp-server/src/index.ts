/**
 * @als/mcp-server — Local MCP server for service artefacts
 *
 * Exposes government service capabilities as MCP tools.
 * Reads from data/services/ JSON files and provides:
 *   - check_eligibility, get_requirements, get_consent_model,
 *     advance_state, get_service_info per service.
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

  const { server, toolCount, serviceCount } = await createServer(servicesDir);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `[MCP Server] Running on stdio — ${serviceCount} services, ${toolCount} tools`
  );
}

main().catch((err) => {
  console.error("[MCP Server] Fatal error:", err);
  process.exit(1);
});
