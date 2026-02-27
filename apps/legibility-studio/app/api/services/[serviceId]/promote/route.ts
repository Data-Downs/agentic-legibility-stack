import { NextRequest, NextResponse } from "next/server";
import { getServiceArtefactStore } from "@/lib/service-store-init";

/**
 * POST /api/services/[serviceId]/promote
 * Toggles the `promoted` flag on a service.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const store = await getServiceArtefactStore();
    const newPromoted = await store.togglePromoted(serviceId);

    if (newPromoted === undefined) {
      return NextResponse.json({ error: `Service "${serviceId}" not found` }, { status: 404 });
    }

    return NextResponse.json({ promoted: newPromoted });
  } catch (error) {
    console.error("Error toggling promotion:", error);
    return NextResponse.json({ error: "Failed to toggle promotion" }, { status: 500 });
  }
}
