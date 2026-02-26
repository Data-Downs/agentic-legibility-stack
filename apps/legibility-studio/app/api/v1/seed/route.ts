import { getServiceStoreAdapter, invalidateServiceStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";
import { seedServiceStore } from "@als/service-store";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * POST /api/v1/seed
 * Triggers a re-seed of the service store from graph data + embedded full services.
 * Body: { clear?: boolean }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clear = body.clear ?? true;

    const adapter = await getServiceStoreAdapter();
    const result = await seedServiceStore(adapter, { clear });

    // Invalidate singleton so next request picks up fresh data
    invalidateServiceStore();

    return jsonWithCors({ success: true, seeded: result });
  } catch (error) {
    console.error("[v1/seed] Error:", error);
    return jsonWithCors({ error: "Failed to seed service store" }, { status: 500 });
  }
}
