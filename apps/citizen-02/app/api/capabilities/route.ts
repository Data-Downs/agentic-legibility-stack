import { NextResponse } from "next/server";
import { getRegistry } from "@/lib/registry";

/**
 * GET /api/capabilities
 *
 * Returns all registered capability manifests from the ServiceRegistry.
 * The agent uses this to discover what government services are available.
 */
export async function GET() {
  try {
    const registry = await getRegistry();
    const capabilities = registry.listAll();

    return NextResponse.json({
      count: capabilities.length,
      capabilities: capabilities.map((cap) => ({
        id: cap.id,
        name: cap.name,
        description: cap.description,
        department: cap.department,
        jurisdiction: cap.jurisdiction,
        constraints: cap.constraints,
        consent_requirements: cap.consent_requirements,
        redress: cap.redress,
        handoff: cap.handoff,
      })),
    });
  } catch (error) {
    console.error("Error loading capabilities:", error);
    return NextResponse.json(
      { error: "Failed to load capabilities" },
      { status: 500 }
    );
  }
}
