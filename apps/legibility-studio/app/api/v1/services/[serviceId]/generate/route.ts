import { NextRequest } from "next/server";
import { getServiceArtefactStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";
import { generateArtefacts } from "@/lib/artefact-generator";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * POST /api/v1/services/[serviceId]/generate
 * Generate artefacts from GOV.UK content for a graph-only service.
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
      return jsonWithCors({ error: "Service not found" }, { status: 404 });
    }

    if (!service.govukUrl) {
      return jsonWithCors(
        { error: "Service has no govuk_url — cannot generate artefacts" },
        { status: 400 }
      );
    }

    const result = await generateArtefacts(service);

    // Save to store
    const now = new Date().toISOString();
    await store.updateService(serviceId, {
      policy: result.policy,
      stateModel: result.stateModel,
      consent: result.consent,
      source: "full",
      generatedAt: now,
      interactionType: result.interactionType,
    });

    return jsonWithCors({
      serviceId,
      generated: true,
      interactionType: result.interactionType,
      generatedAt: now,
      policy: result.policy,
      stateModel: result.stateModel,
      consent: result.consent,
      govukContent: result.govukContent,
      enrichment: result.enrichment
        ? {
            behindLogin: result.enrichment.behindLogin,
            eligibilityComplexity: result.enrichment.eligibilityComplexity,
            dataCollected: result.enrichment.dataCollected,
          }
        : null,
    });
  } catch (error) {
    console.error("[v1/services/:id/generate] POST error:", error);
    return jsonWithCors(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
