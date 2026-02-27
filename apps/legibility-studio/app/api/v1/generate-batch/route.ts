import { NextRequest } from "next/server";
import { getServiceArtefactStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";
import { generateArtefacts } from "@/lib/artefact-generator";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * POST /api/v1/generate-batch
 * Batch generation of artefacts for graph-only services.
 *
 * Body: { serviceIds?: string[], limit?: number }
 * - If serviceIds provided, generates for those services only
 * - Otherwise generates for all graph-only services with govuk_url
 * - limit defaults to 10, max 50
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedIds = body.serviceIds as string[] | undefined;
    const limit = Math.min(Math.max(body.limit || 10, 1), 50);

    const store = await getServiceArtefactStore();

    let serviceIds: string[];
    if (requestedIds && Array.isArray(requestedIds)) {
      serviceIds = requestedIds.slice(0, limit);
    } else {
      // Get all graph-only services
      const all = await store.listServices({ source: "graph" });
      serviceIds = all
        .filter((s) => s.govukUrl)
        .slice(0, limit)
        .map((s) => s.id);
    }

    const results: Array<{
      serviceId: string;
      success: boolean;
      interactionType?: string;
      error?: string;
    }> = [];

    // Process sequentially to avoid rate limits
    for (const serviceId of serviceIds) {
      try {
        const service = await store.getService(serviceId);
        if (!service) {
          results.push({ serviceId, success: false, error: "Not found" });
          continue;
        }
        if (!service.govukUrl) {
          results.push({ serviceId, success: false, error: "No govuk_url" });
          continue;
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

        results.push({
          serviceId,
          success: true,
          interactionType: result.interactionType,
        });
      } catch (error) {
        results.push({
          serviceId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return jsonWithCors({
      total: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    console.error("[v1/generate-batch] POST error:", error);
    return jsonWithCors(
      { error: error instanceof Error ? error.message : "Batch generation failed" },
      { status: 500 }
    );
  }
}
