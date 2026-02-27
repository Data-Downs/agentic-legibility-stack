import { NextRequest } from "next/server";
import { getServiceGraphStore, getServiceArtefactStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/v1/life-events/[eventId]
 * Returns a life event with its reachable services (BFS traversal).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const graphStore = await getServiceGraphStore();
    const event = await graphStore.getLifeEvent(eventId);

    if (!event) {
      return jsonWithCors({ error: "Life event not found" }, { status: 404 });
    }

    // Get all reachable services via BFS
    const reachableIds = await graphStore.getLifeEventReachableServices(eventId);

    // Resolve service summaries
    const artefactStore = await getServiceArtefactStore();
    const services = await artefactStore.listServices();
    const reachableSet = new Set(reachableIds);
    const reachableServices = services.filter((s) => reachableSet.has(s.id));

    return jsonWithCors({
      ...event,
      reachableServices,
      totalReachable: reachableServices.length,
    });
  } catch (error) {
    console.error("[v1/life-events/:id] Error:", error);
    return jsonWithCors({ error: "Failed to load life event" }, { status: 500 });
  }
}
