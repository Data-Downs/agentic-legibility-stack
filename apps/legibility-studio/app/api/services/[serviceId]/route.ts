import { NextRequest, NextResponse } from "next/server";
import { getServiceArtefactStore } from "@/lib/service-store-init";

/**
 * GET /api/services/[serviceId]
 * Returns all artefacts for a specific service (backward-compatible).
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
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const gaps = store.analyzeGaps(service);

    return NextResponse.json({
      serviceId: service.id,
      manifest: service.manifest,
      policy: service.policy || null,
      stateModel: service.stateModel || null,
      consent: service.consent || null,
      gaps,
    });
  } catch (error) {
    console.error("Error loading service:", error);
    return NextResponse.json({ error: "Failed to load service" }, { status: 500 });
  }
}

/**
 * PUT /api/services/[serviceId]
 * Updates an existing service's artefacts.
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
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json({ serviceId, updated: true });
  } catch (error) {
    console.error("Error updating service:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

/**
 * DELETE /api/services/[serviceId]
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
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting service:", error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
