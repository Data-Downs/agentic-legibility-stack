import { NextResponse } from "next/server";
import * as mcpClient from "@/lib/mcp-client";
import * as localMcpClient from "@/lib/local-mcp-client";

export async function GET() {
  return NextResponse.json({
    connected: mcpClient.isConnected(),
    localMcpConnected: localMcpClient.isLocalConnected(),
  });
}
