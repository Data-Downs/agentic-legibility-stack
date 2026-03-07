import { NextResponse } from "next/server";

/**
 * POST /api/v1/seed-personas
 * Upserts all persona JSON blobs into D1.
 * Body: { personas: Array<{ id: string; [key: string]: unknown }> }
 */
export async function POST(request: Request) {
  try {
    let db: D1Database;
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const ctx = getCloudflareContext();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db = (ctx.env as any).SERVICE_STORE_DB;
      if (!db) throw new Error("SERVICE_STORE_DB binding not found");
    } catch (err) {
      return NextResponse.json(
        { error: "D1 not available: " + (err instanceof Error ? err.message : String(err)) },
        { status: 500 },
      );
    }

    const body = await request.json();
    const personas: Array<Record<string, unknown>> = body.personas;
    if (!Array.isArray(personas) || personas.length === 0) {
      return NextResponse.json({ error: "Body must contain a non-empty 'personas' array" }, { status: 400 });
    }

    // Ensure table exists
    await db.prepare(
      "CREATE TABLE IF NOT EXISTS personas (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))"
    ).run();

    let upserted = 0;
    for (const persona of personas) {
      const id = persona.id as string;
      if (!id) continue;
      const json = JSON.stringify(persona);
      await db
        .prepare("INSERT OR REPLACE INTO personas (id, data, updated_at) VALUES (?, ?, datetime('now'))")
        .bind(id, json)
        .run();
      upserted++;
    }

    return NextResponse.json({ ok: true, upserted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 },
    );
  }
}
