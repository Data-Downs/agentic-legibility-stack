import { NextResponse } from "next/server";
import { ServiceRegistry } from "@als/runtime";
import path from "path";

/** Force Next.js to run this handler on every request (no static caching) */
export const dynamic = "force-dynamic";

/**
 * GET /api/services
 * Returns all services from data/services/ for the Dashboard.
 * Creates a fresh registry each time so Studio-created services appear immediately.
 */
export async function GET() {
  try {
    const reg = new ServiceRegistry();
    const monorepoDir = path.join(process.cwd(), "..", "..", "data", "services");
    const localDir = path.join(process.cwd(), "data", "services");
    try {
      await reg.loadFromDirectory(monorepoDir);
    } catch {
      await reg.loadFromDirectory(localDir);
    }

    const services = reg.listAll().map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      department: m.department,
      promoted: !!m.promoted,
    }));

    return NextResponse.json({ services });
  } catch (error) {
    console.error("Error loading services:", error);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}
