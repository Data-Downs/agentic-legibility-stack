/**
 * /api/mcp — Remote MCP endpoint (StreamableHTTP, stateless)
 *
 * Serves the same tools, resources, and prompts as the local stdio MCP server
 * but over HTTP, backed by D1 service data. Works on Cloudflare Workers.
 *
 * - POST /api/mcp — MCP JSON-RPC messages (initialize, tool calls, resource reads, prompt gets)
 * - GET  /api/mcp — SSE stream for server-initiated notifications
 * - DELETE /api/mcp — Session cleanup (no-op in stateless mode)
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServerFromD1 } from "../../../lib/mcp-server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, mcp-session-id, Last-Event-ID, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

/** Add CORS headers to a Response */
function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Handle an MCP request (POST, GET, or DELETE) in stateless mode */
async function handleMcpRequest(request: Request): Promise<Response> {
  // Stateless: fresh transport + server per request
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const { server } = await createMcpServerFromD1();
  await server.connect(transport);

  const response = await transport.handleRequest(request);
  return withCors(response);
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
