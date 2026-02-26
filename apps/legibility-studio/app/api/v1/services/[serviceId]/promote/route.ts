import { NextRequest } from "next/server";
import { getServiceArtefactStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * POST /api/v1/services/[serviceId]/promote
 * Toggles the promoted flag on a service.
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
      return jsonWithCors({ error: "Service not found" }, { status: 404 });
    }

    return jsonWithCors({ promoted: newPromoted });
  } catch (error) {
    console.error("[v1/promote] Error:", error);
    return jsonWithCors({ error: "Failed to toggle promotion" }, { status: 500 });
  }
}
