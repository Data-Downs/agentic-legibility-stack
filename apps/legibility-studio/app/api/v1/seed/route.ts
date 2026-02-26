import { getServiceStoreAdapter, invalidateServiceStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";
import { seedServiceStore } from "@als/service-store";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * POST /api/v1/seed
 * Triggers a re-seed of the service store from graph data + filesystem.
 * Body: { clear?: boolean }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clear = body.clear ?? true;

    const adapter = await getServiceStoreAdapter();

    let servicesDir: string | null = null;
    try {
      const path = await import("path");
      servicesDir = path.join(process.cwd(), "..", "..", "data", "services");
      const fs = await import("fs");
      if (!fs.existsSync(servicesDir)) {
        servicesDir = null;
      }
    } catch {
      // No filesystem (Cloudflare)
    }

    const result = await seedServiceStore(adapter, { servicesDir, clear });

    // Invalidate singleton so next request picks up fresh data
    invalidateServiceStore();

    return jsonWithCors({ success: true, seeded: result });
  } catch (error) {
    console.error("[v1/seed] Error:", error);
    return jsonWithCors({ error: "Failed to seed service store" }, { status: 500 });
  }
}
