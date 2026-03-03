import { NextRequest, NextResponse } from "next/server";
import { getSubmittedStore } from "@/lib/personal-data-store";
import { getPersonaData } from "@/lib/service-data";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const submittedStore = await getSubmittedStore();

    // Seed from bundled data on first access
    const bundled = getPersonaData(id);
    if (bundled) {
      await submittedStore.seedFromPersona(id, bundled);
    }

    // Try DB first
    const data = await submittedStore.reconstructPersonaData(id);
    if (data) {
      return NextResponse.json(data);
    }

    // Fallback to bundled data
    if (bundled) {
      return NextResponse.json(bundled);
    }

    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }
}
