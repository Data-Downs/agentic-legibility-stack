import { NextRequest, NextResponse } from "next/server";
import { getServiceArtefacts, analyzeGaps } from "@/lib/artefacts";

/**
 * GET /api/services/[serviceId]
 * Returns all artefacts and gap analysis for a specific service.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const artefacts = await getServiceArtefacts(serviceId);

    if (!artefacts) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const gaps = analyzeGaps(artefacts);

    return NextResponse.json({
      serviceId,
      manifest: artefacts.manifest,
      policy: artefacts.policy || null,
      stateModel: artefacts.stateModel || null,
      consent: artefacts.consent || null,
      gaps,
    });
  } catch (error) {
    console.error("Error loading service:", error);
    return NextResponse.json({ error: "Failed to load service" }, { status: 500 });
  }
}
