import { NextResponse } from "next/server";
import { getTestUsers } from "@/lib/identity";

/**
 * GET /api/auth/test-users
 *
 * Returns available test users for the simulated One Login picker.
 */
export async function GET() {
  try {
    const users = await getTestUsers();

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        date_of_birth: u.date_of_birth,
        age: u.age,
        address: { city: u.address.city, postcode: u.address.postcode },
        employment_status: u.employment_status,
        credentials: u.credentials.map((c) => ({
          type: c.type,
          status: c.status,
        })),
      })),
    });
  } catch (error) {
    console.error("Error loading test users:", error);
    return NextResponse.json({ error: "Failed to load test users" }, { status: 500 });
  }
}
