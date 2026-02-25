import { NextRequest, NextResponse } from "next/server";
import { getLedgerStore, loadStateModel } from "@/lib/ledger";

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
  { params }: { params: Promise<{ serviceId: string }> },
) {
  try {
    const { serviceId } = await params;
    const store = await getLedgerStore();
    const dashboard = await store.getDashboard(decodeURIComponent(serviceId));

    // Attach the state model so Studio can render the progress flow
    const stateModel = loadStateModel(decodeURIComponent(serviceId));

    return NextResponse.json({ ...dashboard, stateModel }, { headers: corsHeaders });
  } catch (error) {
    console.error("[Ledger] Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500, headers: corsHeaders },
    );
  }
}
