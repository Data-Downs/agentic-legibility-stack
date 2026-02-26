/**
 * CORS headers for /api/v1/ routes.
 * Allows any origin to call these public APIs.
 */

import { NextResponse } from "next/server";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Return a 204 response for CORS preflight */
export function handleOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/** Add CORS headers to a NextResponse.json() call */
export function jsonWithCors(data: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, {
    status: init?.status || 200,
    headers: corsHeaders,
  });
}
