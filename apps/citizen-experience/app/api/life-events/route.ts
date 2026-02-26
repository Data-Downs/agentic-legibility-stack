import { NextResponse } from "next/server";
import { getLifeEvents, getGraphEngine } from "@/lib/service-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/life-events
 * Returns all 16 life events with their associated services.
 */
export async function GET() {
  const engine = getGraphEngine();
  const lifeEvents = getLifeEvents().map((le) => {
    const services = engine.getLifeEventServices(le.id).map((node) => ({
      id: node.id,
      name: node.name,
      dept: node.dept,
      serviceType: node.serviceType,
      proactive: node.proactive,
      gated: node.gated,
      desc: node.desc,
      govuk_url: node.govuk_url,
      eligibility_summary: node.eligibility.summary,
    }));

    return {
      id: le.id,
      icon: le.icon,
      name: le.name,
      desc: le.desc,
      entryNodeCount: le.entryNodes.length,
      totalServiceCount: services.length,
      services,
    };
  });

  return NextResponse.json({ lifeEvents });
}
