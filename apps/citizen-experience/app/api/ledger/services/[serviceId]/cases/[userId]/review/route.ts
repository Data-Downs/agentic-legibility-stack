import { NextRequest, NextResponse } from "next/server";
import { getLedgerStore } from "@/lib/ledger";
import { getTraceEmitter } from "@/lib/evidence";
import { CaseStore } from "@als/evidence";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string; userId: string }> },
) {
  try {
    const { serviceId, userId } = await params;
    const decodedService = decodeURIComponent(serviceId);
    const decodedUser = decodeURIComponent(userId);
    const body = await request.json();
    const { reason, priority, requestedBy } = body;

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const store = await getLedgerStore();
    const caseId = CaseStore.caseId(decodedUser, decodedService);
    const ledgerCase = await store.getCase(caseId);

    if (!ledgerCase) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404, headers: corsHeaders },
      );
    }

    // Create a handoff.initiated trace event for the audit trail
    const emitter = await getTraceEmitter();
    const span = emitter.startSpan({
      traceId: `trace_review_${Date.now()}`,
      sessionId: `review_${caseId}`,
      userId: decodedUser,
      capabilityId: decodedService,
    });
    await emitter.emit("handoff.initiated", span, {
      serviceId: decodedService,
      source: "studio-review",
      reason,
      priority: priority || "routine",
      requestedBy: requestedBy || "unknown",
      caseId,
    });

    // Update the case review status
    await store.submitReview(caseId, reason, priority || "routine");

    return NextResponse.json({
      success: true,
      caseId,
      reviewStatus: "pending",
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("[Ledger] Review submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500, headers: corsHeaders },
    );
  }
}
