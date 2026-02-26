import { NextRequest } from "next/server";
import { getServiceArtefactStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/v1/services/[serviceId]/gaps
 * Returns gap analysis for a service.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const store = await getServiceArtefactStore();
    const service = await store.getService(serviceId);

    if (!service) {
      return jsonWithCors({ error: "Service not found" }, { status: 404 });
    }

    const gaps = store.analyzeGaps(service);
    const present = gaps.filter((g) => g.status === "present").length;

    return jsonWithCors({
      serviceId,
      gaps,
      completeness: Math.round((present / gaps.length) * 100),
      gapCount: gaps.length - present,
    });
  } catch (error) {
    console.error("[v1/gaps] Error:", error);
    return jsonWithCors({ error: "Failed to analyze gaps" }, { status: 500 });
  }
}
