import { NextRequest, NextResponse } from "next/server";
import { getArtefactStore, invalidateArtefactStore, getServicesDirectory } from "@/lib/artefacts";

/**
 * POST /api/services/[serviceId]/promote
 * Toggles the `promoted` flag on a service manifest.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    console.log(`[Promote] Toggle requested for: "${serviceId}"`);

    const store = await getArtefactStore();
    const allIds = store.listServices();
    console.log(`[Promote] Known services: ${allIds.join(", ")}`);

    const artefacts = store.get(serviceId);

    if (!artefacts) {
      console.error(`[Promote] Service "${serviceId}" not found in store`);
      return NextResponse.json({ error: `Service "${serviceId}" not found` }, { status: 404 });
    }

    // Toggle promoted
    const newPromoted = !artefacts.manifest.promoted;
    const updatedManifest = { ...artefacts.manifest, promoted: newPromoted };
    const updatedArtefacts = { ...artefacts, manifest: updatedManifest };

    const dir = getServicesDirectory();
    console.log(`[Promote] Saving to: ${dir}, promoted=${newPromoted}`);
    await store.saveService(dir, serviceId, updatedArtefacts);
    invalidateArtefactStore();

    console.log(`[Promote] Success — ${serviceId} promoted=${newPromoted}`);
    return NextResponse.json({ promoted: newPromoted });
  } catch (error) {
    console.error("Error toggling promotion:", error);
    return NextResponse.json({ error: "Failed to toggle promotion" }, { status: 500 });
  }
}
