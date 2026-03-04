import { NextRequest, NextResponse } from "next/server";
import { getUser, createUser } from "@/lib/persona-store";
import { generatePersona, nameToId } from "@/lib/persona-generator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scenarioDescription, suggestedName, servicesOfInterest } = body;

    if (
      !scenarioDescription ||
      typeof scenarioDescription !== "string" ||
      scenarioDescription.trim().length < 10
    ) {
      return NextResponse.json(
        { error: "Scenario description must be at least 10 characters" },
        { status: 400 }
      );
    }

    // Generate via LLM
    const persona = await generatePersona(scenarioDescription.trim(), {
      suggestedName,
      servicesOfInterest,
    });

    // Determine ID
    let id = (persona.id as string) || nameToId((persona.name as string) || "generated-persona");

    // Check for collision — append suffix if needed
    let suffix = 1;
    let finalId = id;
    while (await getUser(finalId)) {
      suffix++;
      finalId = `${id}-${suffix}`;
    }
    id = finalId;

    // Update the persona's id to match the file name
    persona.id = id;

    // Save to file
    await createUser(id, persona);

    return NextResponse.json({ success: true, persona, id }, { status: 201 });
  } catch (err) {
    console.error("[PersonaGenerate]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate persona",
      },
      { status: 500 }
    );
  }
}
