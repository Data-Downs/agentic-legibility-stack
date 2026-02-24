import { NextRequest, NextResponse } from "next/server";
import { getLedgerStore, loadStateModel } from "@/lib/ledger";
import { CaseStore } from "@als/evidence";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string; userId: string }> },
) {
  try {
    const { serviceId, userId } = await params;
    const decodedService = decodeURIComponent(serviceId);
    const decodedUser = decodeURIComponent(userId);

    const store = await getLedgerStore();
    const caseId = CaseStore.caseId(decodedUser, decodedService);
    const ledgerCase = await store.getCase(caseId);

    if (!ledgerCase) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404, headers: corsHeaders },
      );
    }

    const timeline = await store.getCaseTimeline(caseId);
    const stateModel = loadStateModel(decodedService);

    return NextResponse.json({
      case: ledgerCase,
      timeline,
      stateModel,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("[Ledger] Case detail error:", error);
    return NextResponse.json(
      { error: "Failed to load case" },
      { status: 500, headers: corsHeaders },
    );
  }
}
