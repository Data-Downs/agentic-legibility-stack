import { NextResponse } from "next/server";
import * as mcpClient from "@/lib/mcp-client";

export async function GET() {
  return NextResponse.json({ connected: mcpClient.isConnected() });
}
