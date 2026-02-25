import { NextRequest, NextResponse } from "next/server";
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
 * GET /api/traces/[traceId]
 *
 * Returns all trace events and receipts for a specific trace.
 * This is the detailed view of a single interaction session.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ traceId: string }> }
) {
  try {
    const { traceId } = await params;
    const store = await getTraceStore();

    const events = await store.queryByTraceId(traceId);
    const receipts = await store.getReceiptsByTrace(traceId);

    if (events.length === 0 && receipts.length === 0) {
      return NextResponse.json(
        { error: "Trace not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      traceId,
      eventCount: events.length,
      receiptCount: receipts.length,
      events,
      receipts,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Error fetching trace:", error);
    return NextResponse.json(
      { error: "Failed to fetch trace" },
      { status: 500, headers: corsHeaders }
    );
  }
}
