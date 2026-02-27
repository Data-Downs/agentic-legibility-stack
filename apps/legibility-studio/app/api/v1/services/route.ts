import { NextRequest } from "next/server";
import { getServiceArtefactStore, getServiceGraphStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/v1/services
 * List all services with optional filtering.
 * Query params: department, source, promoted, search, serviceType
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const filter = {
      department: url.searchParams.get("department") || undefined,
      source: (url.searchParams.get("source") as "full" | "graph") || undefined,
      promoted: url.searchParams.has("promoted")
        ? url.searchParams.get("promoted") === "true"
        : undefined,
      search: url.searchParams.get("search") || undefined,
      serviceType: url.searchParams.get("serviceType") || undefined,
    };

    const store = await getServiceArtefactStore();
    const services = await store.listServices(filter);

    // Also return life events for convenience
    const graphStore = await getServiceGraphStore();
    const lifeEvents = await graphStore.getLifeEvents();

    return jsonWithCors({ services, lifeEvents, total: services.length });
  } catch (error) {
    console.error("[v1/services] Error:", error);
    return jsonWithCors({ error: "Failed to list services" }, { status: 500 });
  }
}

/**
 * POST /api/v1/services
 * Create a new service. Body: { manifest, policy?, stateModel?, consent? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = body.manifest?.name;
    const department = body.manifest?.department;
    const description = body.manifest?.description;

    if (!name || !department || !description) {
      return jsonWithCors(
        { error: "manifest.name, manifest.department, and manifest.description are required" },
        { status: 400 }
      );
    }

    const store = await getServiceArtefactStore();
    const serviceId = body.manifest.id || `${slugify(department)}.${slugify(name)}`;

    // Check collision
    const existing = await store.getService(serviceId);
    if (existing) {
      return jsonWithCors({ error: `Service "${serviceId}" already exists` }, { status: 409 });
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

    return jsonWithCors({ serviceId }, { status: 201 });
  } catch (error) {
    console.error("[v1/services] POST error:", error);
    return jsonWithCors({ error: "Failed to create service" }, { status: 500 });
  }
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
