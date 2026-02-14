import { NextResponse } from "next/server";
import { getArtefactStore, analyzeGaps } from "@/lib/artefacts";

/**
 * GET /api/services
 * Returns all registered services with their artefact completeness.
 */
export async function GET() {
  try {
    const store = await getArtefactStore();
    const serviceIds = store.listServices();

    const services = serviceIds.map((id) => {
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
        completeness: Math.round((present / total) * 100),
        gapCount: total - present,
      };
    });

    return NextResponse.json({ services });
  } catch (error) {
    console.error("Error loading services:", error);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}
