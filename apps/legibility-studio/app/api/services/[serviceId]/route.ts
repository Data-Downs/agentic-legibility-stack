import { NextRequest, NextResponse } from "next/server";
import { getArtefactStore, getServiceArtefacts, analyzeGaps, invalidateArtefactStore, getServicesDirectory } from "@/lib/artefacts";

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

    const store = await getArtefactStore();
    const existing = store.get(serviceId);

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Merge: keep the existing ID
    const manifest = {
      ...body.manifest,
      id: serviceId,
    };

    const artefacts = {
      manifest,
      policy: body.policy || undefined,
      stateModel: body.stateModel || undefined,
      consent: body.consent || undefined,
    };

    await store.saveService(getServicesDirectory(), serviceId, artefacts);
    invalidateArtefactStore();

    return NextResponse.json({ serviceId, updated: true });
  } catch (error) {
    console.error("Error updating service:", error);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

/**
 * DELETE /api/services/[serviceId]
 * Deletes a service and its artefact files.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;

    const store = await getArtefactStore();
    const existing = store.get(serviceId);

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    await store.deleteService(getServicesDirectory(), serviceId);
    invalidateArtefactStore();

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting service:", error);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
