import { NextRequest, NextResponse } from "next/server";
import { getCaseStore, getTraceStore } from "@/lib/evidence";
import { CaseStore } from "@als/evidence";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string; userId: string }> },
) {
  try {
    const { serviceId, userId } = await params;
    const decodedService = decodeURIComponent(serviceId);
    const decodedUser = decodeURIComponent(userId);

    const caseId = CaseStore.caseId(decodedUser, decodedService);
    const caseStore = getCaseStore();
    const traceStore = getTraceStore();

    caseStore.deleteCase(caseId);
    traceStore.deleteTracesByUser(decodedUser, decodedService);

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("[Ledger] Reset case error:", error);
    return NextResponse.json(
      { error: "Failed to reset case" },
      { status: 500, headers: corsHeaders },
    );
  }
}
