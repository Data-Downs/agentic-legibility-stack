import { NextResponse } from "next/server";
import { ServiceRegistry } from "@als/runtime";
import path from "path";
import { getAllServices } from "@/lib/service-data";

/** Force Next.js to run this handler on every request (no static caching) */
export const dynamic = "force-dynamic";

/**
 * GET /api/services
 * Returns all services: filesystem artefact services + graph services.
 * Each service includes `source: 'full' | 'graph'` to indicate provenance.
 */
export async function GET() {
  try {
    // Filesystem services (full artefacts)
    const fsServices: Array<{
      id: string;
      name: string;
      description: string;
      department: string;
      promoted: boolean;
      source: string;
    }> = [];

    try {
      const reg = new ServiceRegistry();
      const monorepoDir = path.join(process.cwd(), "..", "..", "data", "services");
      const localDir = path.join(process.cwd(), "data", "services");
      try {
        await reg.loadFromDirectory(monorepoDir);
      } catch {
        await reg.loadFromDirectory(localDir);
      }

      for (const m of reg.listAll()) {
        fsServices.push({
          id: m.id,
          name: m.name,
          description: m.description,
          department: m.department,
          promoted: !!m.promoted,
          source: "full",
        });
      }
    } catch {
      // Filesystem unavailable (Cloudflare) — skip
    }

    // Graph services (merged, deduped)
    const allManifests = await getAllServices();
    const fsIds = new Set(fsServices.map((s) => s.id));

    const graphServices = allManifests
      .filter((m) => m.source === "graph" && !fsIds.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        department: m.department,
        promoted: !!m.promoted,
        source: "graph" as const,
        serviceType: m.serviceType,
        govuk_url: m.govuk_url,
        eligibility_summary: m.eligibility_summary,
        proactive: m.proactive,
        gated: m.gated,
      }));

    const services = [...fsServices, ...graphServices];

    return NextResponse.json({ services });
  } catch (error) {
    console.error("Error loading services:", error);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}
