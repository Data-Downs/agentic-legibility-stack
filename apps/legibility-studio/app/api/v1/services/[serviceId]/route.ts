import { NextRequest } from "next/server";
import { getServiceArtefactStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/v1/services/[serviceId]
 * Returns full service artefacts + gap analysis.
 */
export async function GET(
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

    const gaps = store.analyzeGaps(service);

    return jsonWithCors({
      serviceId: service.id,
      name: service.name,
      department: service.department,
      departmentKey: service.departmentKey,
      source: service.source,
      serviceType: service.serviceType,
      promoted: service.promoted,
      manifest: service.manifest,
      policy: service.policy,
      stateModel: service.stateModel,
      consent: service.consent,
      gaps,
    });
  } catch (error) {
    console.error("[v1/services/:id] GET error:", error);
    return jsonWithCors({ error: "Failed to load service" }, { status: 500 });
  }
}

/**
 * PUT /api/v1/services/[serviceId]
 * Updates a service's artefacts.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const body = await request.json();

    const store = await getServiceArtefactStore();
    const updated = await store.updateService(serviceId, {
      manifest: body.manifest ? { ...body.manifest, id: serviceId } : undefined,
      policy: body.policy,
      stateModel: body.stateModel,
      consent: body.consent,
    });

    if (!updated) {
      return jsonWithCors({ error: "Service not found" }, { status: 404 });
    }

    return jsonWithCors({ serviceId, updated: true });
  } catch (error) {
    console.error("[v1/services/:id] PUT error:", error);
    return jsonWithCors({ error: "Failed to update service" }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/services/[serviceId]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const store = await getServiceArtefactStore();
    const deleted = await store.deleteService(serviceId);

    if (!deleted) {
      return jsonWithCors({ error: "Service not found" }, { status: 404 });
    }

    return jsonWithCors({ deleted: true });
  } catch (error) {
    console.error("[v1/services/:id] DELETE error:", error);
    return jsonWithCors({ error: "Failed to delete service" }, { status: 500 });
  }
}
