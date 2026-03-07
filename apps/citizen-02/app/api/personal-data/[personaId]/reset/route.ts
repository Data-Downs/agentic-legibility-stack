import { NextRequest, NextResponse } from "next/server";
import { getPersonalDataAdapter } from "@/lib/personal-data-store";
import { getCaseStore, getTraceStore, getEvidenceAdapter } from "@/lib/evidence";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * DELETE /api/personal-data/[personaId]/reset
 *
 * Wipes ALL interaction data for a persona:
 * - Personal data DB: submitted_data, inferred_data, service_access, data_updates
 * - Evidence DB: cases and traces for this user
 *
 * Does NOT delete the persona definition itself (that's static fixture data).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> },
) {
  try {
    const { personaId } = await params;
    const decoded = decodeURIComponent(personaId);
    const results: Record<string, number> = {};

    // 1. Clear personal data tables
    const db = await getPersonalDataAdapter();

    const submitted = await db.run("DELETE FROM submitted_data WHERE user_id = ?", decoded);
    results.submitted_data = submitted?.changes ?? 0;

    const inferred = await db.run("DELETE FROM inferred_data WHERE user_id = ?", decoded);
    results.inferred_data = inferred?.changes ?? 0;

    const access = await db.run("DELETE FROM service_access WHERE user_id = ?", decoded);
    results.service_access = access?.changes ?? 0;

    const updates = await db.run("DELETE FROM data_updates WHERE user_id = ?", decoded);
    results.data_updates = updates?.changes ?? 0;

    // 2. Clear evidence: cases and traces
    let casesDeleted = 0;
    try {
      const evidenceDb = await getEvidenceAdapter();
      const caseStore = await getCaseStore();
      const traceStore = await getTraceStore();

      // Find all cases for this user
      const userCases = await evidenceDb.all<{ id: string; service_id: string }>(
        "SELECT id, service_id FROM cases WHERE user_id = ?", decoded,
      );

      for (const c of userCases) {
        await caseStore.deleteCase(c.id);
        await traceStore.deleteTracesByUser(decoded, c.service_id);
        casesDeleted++;
      }

      // Also delete any orphan traces not linked to a case
      await evidenceDb.run("DELETE FROM traces WHERE user_id = ?", decoded);
    } catch (err) {
      console.warn("[Reset] Evidence cleanup skipped:", err);
    }

    results.cases = casesDeleted;

    console.log(`[Reset] Persona ${decoded} reset:`, results);

    return NextResponse.json({
      success: true,
      personaId: decoded,
      deleted: results,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("[Reset] Error:", error);
    return NextResponse.json(
      { error: "Failed to reset persona data" },
      { status: 500, headers: corsHeaders },
    );
  }
}
