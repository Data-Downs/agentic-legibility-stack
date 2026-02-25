import { NextRequest, NextResponse } from "next/server";
import * as mcpClient from "@/lib/mcp-client";
import { getSubmittedStore } from "@/lib/personal-data-store";
import { getPersonaData } from "@/lib/service-data";

async function getLocalFloodData(city: string): Promise<string> {
  try {
    const raw = await mcpClient.callTool("ea_current_floods", {
      severity: 3,
      limit: 100,
    });
    let data: Record<string, unknown>;
    try {
      data = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
    } catch {
      return JSON.stringify({ warnings: [], summary: "No flood data available." });
    }
    const result = data?.result as Record<string, unknown> | undefined;
    const items = ((result?.items || data?.items) as Array<Record<string, unknown>>) || [];
    if (items.length === 0) {
      return JSON.stringify({ warnings: [], summary: "No active flood warnings." });
    }
    const cityLower = (city || "").toLowerCase();
    const localWarnings = items.filter((item) => {
      const floodArea = item.floodArea as Record<string, string> | undefined;
      const county = (floodArea?.county || "").toLowerCase();
      const area = ((item.eaAreaName as string) || "").toLowerCase();
      const desc = ((item.description as string) || "").toLowerCase();
      return county.includes(cityLower) || area.includes(cityLower) || desc.includes(cityLower);
    });
    const summary = localWarnings.map((w) => ({
      area: w.description,
      severity: w.severity,
      river: (w.floodArea as Record<string, string>)?.riverOrSea || "Unknown",
      message: ((w.message as string) || "").slice(0, 200),
      updated: w.timeMessageChanged,
    }));
    return JSON.stringify({
      localWarnings: summary.length,
      nationalWarnings: items.length,
      location: city,
      warnings: summary,
      summary: summary.length > 0
        ? `${summary.length} active flood warning(s) near ${city}.`
        : `No active flood warnings near ${city}. There are ${items.length} warnings elsewhere in England.`,
    });
  } catch {
    return JSON.stringify({ error: "Flood data temporarily unavailable." });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const { personaId } = await params;

    if (!mcpClient.isConnected()) {
      return NextResponse.json({ enriched: false });
    }

    // Load persona data from DB (single source of truth)
    const submittedStore = await getSubmittedStore();
    const bundled = getPersonaData(personaId);
    if (bundled) {
      await submittedStore.seedFromPersona(personaId, bundled);
    }
    const personaData = await submittedStore.reconstructPersonaData(personaId) || bundled;
    if (!personaData) {
      return NextResponse.json({ enriched: false, reason: "Persona not found" });
    }
    const address = personaData.address as Record<string, unknown> | undefined;
    const postcode = address?.postcode as string | undefined;

    if (!postcode) {
      return NextResponse.json({ enriched: false, reason: "No postcode" });
    }

    const city = (address?.city as string) || "";
    const [postcodeResult, mpResult, floodsResult, holidaysResult] =
      await Promise.allSettled([
        mcpClient.callToolCached("lookup_postcode", { postcode }),
        mcpClient.callToolCached("find_mp", { postcode }),
        getLocalFloodData(city),
        mcpClient.callToolCached("get_bank_holidays", {
          division: "england-and-wales",
        }),
      ]);

    const extract = (result: PromiseSettledResult<unknown>) => {
      if (result.status === "fulfilled" && result.value) {
        try {
          return typeof result.value === "string"
            ? JSON.parse(result.value)
            : result.value;
        } catch {
          return result.value;
        }
      }
      return null;
    };

    return NextResponse.json({
      enriched: true,
      postcode,
      localArea: extract(postcodeResult),
      mp: extract(mpResult),
      floods: extract(floodsResult),
      bankHolidays: extract(holidaysResult),
    });
  } catch (error) {
    console.error("Error in /api/enrich:", error);
    return NextResponse.json({
      enriched: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
