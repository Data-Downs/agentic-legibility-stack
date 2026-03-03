import { NextResponse } from "next/server";
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
    const allManifests = await getAllServices();

    const services = allManifests.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      department: m.department,
      promoted: !!m.promoted,
      source: m.source || "full",
      serviceType: m.serviceType,
      govuk_url: m.govuk_url,
      eligibility_summary: m.eligibility_summary,
      proactive: m.proactive,
      gated: m.gated,
    }));

    return NextResponse.json({ services });
  } catch (error) {
    console.error("Error loading services:", error);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}
