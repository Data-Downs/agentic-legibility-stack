import { NextRequest, NextResponse } from "next/server";
import { getServiceArtefactStore, getServiceGraphStore } from "@/lib/service-store-init";

/**
 * GET /api/services
 * Returns all registered services (backward-compatible with existing Studio UI).
 */
export async function GET() {
  try {
    const store = await getServiceArtefactStore();
    const services = await store.listServices();

    const mapped = services.map((s) => ({
      id: s.id,
      name: s.name,
      department: s.department,
      description: s.description,
      hasPolicy: s.hasPolicy,
      hasStateModel: s.hasStateModel,
      hasConsent: s.hasConsent,
      promoted: s.promoted,
      completeness: s.source === "full" ? 50 : 0, // Approximate; full gap analysis via /api/v1/
      gapCount: 0,
      source: s.source,
      serviceType: s.serviceType,
      govuk_url: s.govukUrl,
      generatedAt: s.generatedAt,
      interactionType: s.interactionType,
    }));

    const graphStore = await getServiceGraphStore();
    const lifeEvents = await graphStore.getLifeEvents();

    return NextResponse.json({
      services: mapped,
      lifeEvents: lifeEvents.map((e) => ({
        id: e.id,
        name: e.name,
        icon: e.icon,
        serviceIds: e.serviceIds,
      })),
    });
  } catch (error) {
    console.error("Error loading services:", error);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}

/**
 * POST /api/services
 * Creates a new service (backward-compatible).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = body.manifest?.name;
    const department = body.manifest?.department;
    const description = body.manifest?.description;

    if (!name || !department || !description) {
      return NextResponse.json(
        { error: "manifest.name, manifest.department, and manifest.description are required" },
        { status: 400 }
      );
    }

    const serviceId = body.manifest.id || `${slugify(department)}.${slugify(name)}`;

    const store = await getServiceArtefactStore();
    const existing = await store.getService(serviceId);
    if (existing) {
      return NextResponse.json(
        { error: `Service "${serviceId}" already exists` },
        { status: 409 }
      );
    }

    const manifest = {
      ...body.manifest,
      id: serviceId,
      version: body.manifest.version || "1.0.0",
    };

    await store.createService({
      id: serviceId,
      manifest,
      policy: body.policy || null,
      stateModel: body.stateModel || null,
      consent: body.consent || null,
      source: body.policy ? "full" : "graph",
    });

    return NextResponse.json({ serviceId }, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
