import { NextRequest, NextResponse } from "next/server";
import { getLedgerStore, normalizeLedgerServiceId } from "@/lib/ledger";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  try {
    const { serviceId: rawId } = await params;
    const serviceId = await normalizeLedgerServiceId(decodeURIComponent(rawId));
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    const store = await getLedgerStore();
    const result = await store.listCases(serviceId, {
      status,
      page,
      limit,
    });

    return NextResponse.json({
      cases: result.cases,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("[Ledger] Cases list error:", error);
    return NextResponse.json(
      { error: "Failed to load cases" },
      { status: 500, headers: corsHeaders },
    );
  }
}
