import { NextRequest, NextResponse } from "next/server";
import { getArtefactStore, analyzeGaps, invalidateArtefactStore, getServicesDirectory, listGraphServices, listLifeEvents } from "@/lib/artefacts";
import { generateServiceId } from "@/lib/slugify";

/**
 * GET /api/services
 * Returns all registered services: full artefact services + graph services.
 */
export async function GET() {
  try {
    const store = await getArtefactStore();
    const serviceIds = store.listServices();

    const fullServices = serviceIds.map((id) => {
      const artefacts = store.get(id)!;
      const gaps = analyzeGaps(artefacts);
      const present = gaps.filter((g) => g.status === "present").length;
      const total = gaps.length;

      return {
        id,
        name: artefacts.manifest.name,
        department: artefacts.manifest.department,
        description: artefacts.manifest.description,
        hasPolicy: !!artefacts.policy,
        hasStateModel: !!artefacts.stateModel,
        hasConsent: !!artefacts.consent,
        promoted: !!artefacts.manifest.promoted,
        completeness: Math.round((present / total) * 100),
        gapCount: total - present,
        source: "full" as const,
      };
    });

    // Graph services that don't have full artefacts on disk
    const graphServices = listGraphServices(serviceIds).map((gs) => ({
      id: gs.id,
      name: gs.name,
      department: gs.department,
      description: gs.description,
      hasPolicy: false,
      hasStateModel: false,
      hasConsent: false,
      promoted: false,
      completeness: 0,
      gapCount: 0,
      source: "graph" as const,
      serviceType: gs.serviceType,
      govuk_url: gs.govuk_url,
    }));

    const services = [...fullServices, ...graphServices];
    const lifeEvents = listLifeEvents();

    return NextResponse.json({ services, lifeEvents });
  } catch (error) {
    console.error("Error loading services:", error);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}

/**
 * POST /api/services
 * Creates a new service. Body must include manifest with name, department, description.
 * Optionally includes policy, stateModel, consent.
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

    const serviceId = generateServiceId(department, name);

    // Check for collisions
    const store = await getArtefactStore();
    if (store.get(serviceId)) {
      return NextResponse.json(
        { error: `Service "${serviceId}" already exists` },
        { status: 409 }
      );
    }

    // Build the manifest with generated ID
    const manifest = {
      ...body.manifest,
      id: serviceId,
      version: body.manifest.version || "1.0.0",
    };

    const artefacts = {
      manifest,
      policy: body.policy || undefined,
      stateModel: body.stateModel || undefined,
      consent: body.consent || undefined,
    };

    await store.saveService(getServicesDirectory(), serviceId, artefacts);
    invalidateArtefactStore();

    return NextResponse.json({ serviceId }, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
