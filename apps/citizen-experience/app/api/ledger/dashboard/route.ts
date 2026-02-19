import { NextResponse } from "next/server";
import { getLedgerStore } from "@/lib/ledger";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const store = getLedgerStore();
    const dashboard = store.getDashboardAll();
    return NextResponse.json(dashboard, { headers: corsHeaders });
  } catch (error) {
    console.error("[Ledger] All-services dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500, headers: corsHeaders },
    );
  }
}
