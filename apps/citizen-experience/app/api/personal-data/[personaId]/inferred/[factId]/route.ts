import { NextRequest, NextResponse } from "next/server";
import { getInferredStore } from "@/lib/personal-data-store";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ personaId: string; factId: string }> }
) {
  const { factId } = await params;

  try {
    const inferredStore = await getInferredStore();
    const removed = await inferredStore.remove(factId);

    if (!removed) {
      return NextResponse.json(
        { error: "Fact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PersonalData] DELETE inferred error:", error);
    return NextResponse.json(
      { error: "Failed to delete fact" },
      { status: 500 }
    );
  }
}
