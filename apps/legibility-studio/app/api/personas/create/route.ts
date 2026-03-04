import { NextRequest, NextResponse } from "next/server";
import { getUser, createUser } from "@/lib/persona-store";
import { nameToId, buildBlankPersona } from "@/lib/persona-generator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Please enter a name (at least 2 characters)" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    let id = nameToId(trimmedName);

    if (!id) {
      return NextResponse.json(
        { error: "Could not generate a valid ID from the name" },
        { status: 400 }
      );
    }

    // Check for collision — append suffix if needed
    let suffix = 1;
    let finalId = id;
    while (await getUser(finalId)) {
      suffix++;
      finalId = `${id}-${suffix}`;
    }
    id = finalId;

    // Build blank persona
    const persona = buildBlankPersona(trimmedName, id);

    // Save to file
    await createUser(id, persona);

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (err) {
    console.error("[PersonaCreate]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to create persona",
      },
      { status: 500 }
    );
  }
}
