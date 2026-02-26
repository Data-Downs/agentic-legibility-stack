import { getServiceGraphStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/v1/life-events
 * Returns all life events with their entry-node service IDs.
 */
export async function GET() {
  try {
    const graphStore = await getServiceGraphStore();
    const lifeEvents = await graphStore.getLifeEvents();

    return jsonWithCors({ lifeEvents, total: lifeEvents.length });
  } catch (error) {
    console.error("[v1/life-events] Error:", error);
    return jsonWithCors({ error: "Failed to list life events" }, { status: 500 });
  }
}
