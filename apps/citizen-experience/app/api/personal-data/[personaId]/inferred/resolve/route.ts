import { NextRequest, NextResponse } from "next/server";
import { getInferredStore } from "@/lib/personal-data-store";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;

  try {
    const body = await request.json();
    const { keepId, deleteId } = body;

    if (!keepId || !deleteId) {
      return NextResponse.json(
        { error: "keepId and deleteId are required" },
        { status: 400 }
      );
    }

    const inferredStore = await getInferredStore();
    const resolved = await inferredStore.resolveContradiction(keepId, deleteId);

    if (!resolved) {
      return NextResponse.json(
        { error: "Could not resolve contradiction" },
        { status: 404 }
      );
    }

    console.log(`[PersonalData] Resolved contradiction for ${personaId}: kept ${keepId}, deleted ${deleteId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PersonalData] POST resolve error:", error);
    return NextResponse.json(
      { error: "Failed to resolve contradiction" },
      { status: 500 }
    );
  }
}
