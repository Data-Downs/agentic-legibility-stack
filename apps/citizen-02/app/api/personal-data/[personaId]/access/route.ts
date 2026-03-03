import { NextRequest, NextResponse } from "next/server";
import { getServiceAccessStore } from "@/lib/personal-data-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;

  try {
    const accessStore = await getServiceAccessStore();
    const [accessMap, allGrants] = await Promise.all([
      accessStore.getAccessMap(personaId),
      accessStore.getAllGrants(personaId),
    ]);

    return NextResponse.json({
      accessMap,
      history: allGrants,
    });
  } catch (error) {
    console.error("[PersonalData] GET access error:", error);
    return NextResponse.json(
      { error: "Failed to load access data" },
      { status: 500 }
    );
  }
}
