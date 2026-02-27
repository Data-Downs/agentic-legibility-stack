import { getServiceGraphStore } from "@/lib/service-store-init";
import { handleOptions, jsonWithCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * GET /api/v1/departments
 * Returns all departments with service counts.
 */
export async function GET() {
  try {
    const graphStore = await getServiceGraphStore();
    const departments = await graphStore.getDepartments();

    return jsonWithCors({ departments, total: departments.length });
  } catch (error) {
    console.error("[v1/departments] Error:", error);
    return jsonWithCors({ error: "Failed to list departments" }, { status: 500 });
  }
}
