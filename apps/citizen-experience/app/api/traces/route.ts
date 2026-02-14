import { NextResponse } from "next/server";
import { getTraceStore } from "@/lib/evidence";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/traces
 *
 * Returns a list of all trace sessions, most recent first.
 * Each entry includes the trace ID, first event timestamp, and event count.
 */
export async function GET() {
  try {
    const store = getTraceStore();
    const traces = store.listTraces(100);

    return NextResponse.json({
      count: traces.length,
      totalEvents: store.eventCount,
      traces,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error listing traces:", error);
    return NextResponse.json(
      { error: "Failed to list traces" },
      { status: 500, headers: corsHeaders }
    );
  }
}
