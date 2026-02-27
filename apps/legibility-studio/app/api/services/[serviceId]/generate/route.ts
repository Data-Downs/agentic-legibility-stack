import { NextRequest, NextResponse } from "next/server";
import { getServiceArtefactStore } from "@/lib/service-store-init";
import { generateArtefacts } from "@/lib/artefact-generator";

/**
 * POST /api/services/[serviceId]/generate
 * Internal route for Studio UI — generates artefacts for a service.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const store = await getServiceArtefactStore();
    const service = await store.getService(serviceId);

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    if (!service.govukUrl) {
      return NextResponse.json(
        { error: "Service has no govuk_url — cannot generate artefacts" },
        { status: 400 }
      );
    }

    const result = await generateArtefacts(service);

    const now = new Date().toISOString();
    await store.updateService(serviceId, {
      policy: result.policy,
      stateModel: result.stateModel,
      consent: result.consent,
      source: "full",
      generatedAt: now,
      interactionType: result.interactionType,
    });

    return NextResponse.json({
      serviceId,
      generated: true,
      interactionType: result.interactionType,
      generatedAt: now,
    });
  } catch (error) {
    console.error("[services/:id/generate] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
