import { NextRequest, NextResponse } from "next/server";
import * as mcpClient from "@/lib/mcp-client";
import { getSubmittedStore } from "@/lib/personal-data-store";
import { getPersonaData } from "@/lib/service-data";

interface FloodWarning {
  severity: string;
  description: string;
  area: string;
}

interface BankHoliday {
  title: string;
  date: string;
  daysUntil: number;
}

interface EnrichedData {
  enriched: true;
  postcode: {
    admin_district: string;
    parliamentary_constituency: string;
    region: string;
  };
  mp: {
    name: string;
    party: string;
    constituency: string;
  };
  floods: {
    count: number;
    warnings: FloodWarning[];
  };
  bankHolidays: BankHoliday[];
}

function parseResult(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    if (typeof raw === "string") return JSON.parse(raw);
    if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function extractPostcodeData(raw: unknown): EnrichedData["postcode"] {
  const data = parseResult(raw);
  if (!data) return { admin_district: "", parliamentary_constituency: "", region: "" };

  // govmcp lookup_postcode returns result nested under .result
  const result = (data.result as Record<string, unknown>) || data;

  return {
    admin_district: (result.admin_district as string) || "",
    parliamentary_constituency: (result.parliamentary_constituency as string) || "",
    region: (result.region as string) || "",
  };
}

function extractMpData(raw: unknown): EnrichedData["mp"] {
  const data = parseResult(raw);
  if (!data) return { name: "", party: "", constituency: "" };

  // govmcp find_mp returns result nested under .result or directly
  const result = (data.result as Record<string, unknown>) || data;
  const member = (result.member as Record<string, unknown>) || result;

  return {
    name: (member.name as string) || (member.nameDisplayAs as string) || "",
    party: (member.party as string) || (member.latestParty as Record<string, unknown>)?.name as string || "",
    constituency: (member.constituency as string) || (member.membershipFrom as string) || "",
  };
}

function extractFloodData(raw: unknown): EnrichedData["floods"] {
  const data = parseResult(raw);
  if (!data) return { count: 0, warnings: [] };

  const result = (data.result as Record<string, unknown>) || data;
  const items = ((result.items || data.items) as Array<Record<string, unknown>>) || [];

  const warnings: FloodWarning[] = items.slice(0, 10).map((item) => {
    const floodArea = (item.floodArea as Record<string, string>) || {};
    return {
      severity: String(item.severityLevel || item.severity || "Unknown"),
      description: String(item.description || item.message || "").slice(0, 200),
      area: floodArea.county || (item.eaAreaName as string) || "",
    };
  });

  return {
    count: items.length,
    warnings,
  };
}

function extractBankHolidays(raw: unknown): BankHoliday[] {
  const data = parseResult(raw);
  if (!data) return [];

  // govmcp get_bank_holidays returns division data with events array
  const result = (data.result as Record<string, unknown>) || data;
  const division = (result["england-and-wales"] as Record<string, unknown>) || result;
  const events = ((division.events || result.events || data.events) as Array<Record<string, unknown>>) || [];

  const now = new Date();
  const cutoff = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days

  return events
    .map((event) => {
      const dateStr = (event.date as string) || "";
      const eventDate = new Date(dateStr);
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return {
        title: (event.title as string) || "",
        date: dateStr,
        daysUntil,
      };
    })
    .filter((h) => h.daysUntil >= 0 && h.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const { personaId } = await params;

    if (!mcpClient.isConnected()) {
      return NextResponse.json({ enriched: false, reason: "MCP not connected" });
    }

    // Load persona data from DB (single source of truth)
    const submittedStore = await getSubmittedStore();
    const bundled = getPersonaData(personaId);
    if (bundled) {
      await submittedStore.seedFromPersona(personaId, bundled);
    }
    const personaData =
      (await submittedStore.reconstructPersonaData(personaId)) || bundled;
    if (!personaData) {
      return NextResponse.json({ enriched: false, reason: "Persona not found" });
    }

    const address = personaData.address as Record<string, unknown> | undefined;
    const postcode = address?.postcode as string | undefined;

    if (!postcode) {
      return NextResponse.json({ enriched: false, reason: "No postcode" });
    }

    // Call all MCP tools in parallel using cached client
    const [postcodeResult, mpResult, floodsResult, holidaysResult] =
      await Promise.allSettled([
        mcpClient.callToolCached("lookup_postcode", { postcode }),
        mcpClient.callToolCached("find_mp", { postcode }),
        mcpClient.callToolCached("ea_current_floods", { severity: 3, limit: 50 }),
        mcpClient.callToolCached("get_bank_holidays", {
          division: "england-and-wales",
        }),
      ]);

    const getValue = (r: PromiseSettledResult<unknown>) =>
      r.status === "fulfilled" ? r.value : null;

    const enriched: EnrichedData = {
      enriched: true,
      postcode: extractPostcodeData(getValue(postcodeResult)),
      mp: extractMpData(getValue(mpResult)),
      floods: extractFloodData(getValue(floodsResult)),
      bankHolidays: extractBankHolidays(getValue(holidaysResult)),
    };

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error in /api/enrich:", error);
    return NextResponse.json({
      enriched: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
