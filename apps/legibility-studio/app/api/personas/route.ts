import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/persona-store";

export async function GET() {
  try {
    const users = await getAllUsers();
    const summaries = users.map((u) => {
      const address = u.address as Record<string, unknown> | undefined;
      const credentials = (u.credentials ?? []) as unknown[];
      return {
        id: u.id as string,
        name: u.name as string,
        personaName: (u.personaName as string) ?? u.name,
        description: (u.description as string) ?? "",
        age: u.age as number,
        address: { city: address?.city as string, postcode: address?.postcode as string },
        employment_status: u.employment_status as string,
        credentialCount: credentials.length,
        income: u.income as number,
        savings: u.savings as number,
      };
    });
    return NextResponse.json({ users: summaries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load personas" },
      { status: 500 },
    );
  }
}
