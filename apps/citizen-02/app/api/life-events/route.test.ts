// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/service-data", () => ({
  getLifeEvents: vi.fn(),
  getGraphEngine: vi.fn(),
  getPersonaData: vi.fn(),
}));

vi.mock("@/lib/eligibility-filter", () => ({
  checkPersonaEligibility: vi.fn().mockReturnValue({ eligible: true }),
}));

import { GET } from "./route";
import { getLifeEvents, getGraphEngine, getPersonaData } from "@/lib/service-data";
import { checkPersonaEligibility } from "@/lib/eligibility-filter";

const mockedGetLifeEvents = vi.mocked(getLifeEvents);
const mockedGetGraphEngine = vi.mocked(getGraphEngine);
const mockedGetPersonaData = vi.mocked(getPersonaData);
const mockedCheckEligibility = vi.mocked(checkPersonaEligibility);

/** Create a minimal NextRequest-like object */
function makeRequest(url = "http://localhost:3102/api/life-events") {
  const parsed = new URL(url);
  return { nextUrl: parsed } as never;
}

describe("GET /api/life-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckEligibility.mockReturnValue({ eligible: true });
  });

  it("returns life events with services and computed fields", async () => {
    const mockEngine = {
      getLifeEventServices: vi.fn().mockReturnValue([
        {
          id: "apply-uc",
          name: "Apply for UC",
          dept: "DWP",
          serviceType: "benefit",
          proactive: true,
          gated: false,
          desc: "Apply for Universal Credit",
          govuk_url: "https://gov.uk/uc",
          eligibility: { summary: "18+ and in UK" },
        },
      ]),
      getLifeEventPlan: vi.fn().mockReturnValue({
        entryServiceIds: ["apply-uc"],
        edges: [],
      }),
    };

    mockedGetGraphEngine.mockReturnValue(mockEngine as never);
    mockedGetLifeEvents.mockResolvedValue([
      {
        id: "losing-job",
        icon: "💼",
        name: "Losing Your Job",
        desc: "Support when you lose employment",
        entryNodes: ["apply-uc"],
      },
    ] as never[]);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.lifeEvents).toHaveLength(1);
    const le = data.lifeEvents[0];
    expect(le.id).toBe("losing-job");
    expect(le.name).toBe("Losing Your Job");
    expect(le.totalServiceCount).toBe(1);
    expect(le.services[0].id).toBe("apply-uc");
    expect(le.services[0].eligibility_summary).toBe("18+ and in UK");
    expect(le.plan).toEqual({ entryServiceIds: ["apply-uc"], edges: [] });
  });

  it("handles empty life events array", async () => {
    const mockEngine = {
      getLifeEventServices: vi.fn().mockReturnValue([]),
      getLifeEventPlan: vi.fn().mockReturnValue(null),
    };

    mockedGetGraphEngine.mockReturnValue(mockEngine as never);
    mockedGetLifeEvents.mockResolvedValue([]);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.lifeEvents).toEqual([]);
  });

  it("falls back to description field when desc is missing", async () => {
    const mockEngine = {
      getLifeEventServices: vi.fn().mockReturnValue([]),
      getLifeEventPlan: vi.fn().mockReturnValue(null),
    };

    mockedGetGraphEngine.mockReturnValue(mockEngine as never);
    mockedGetLifeEvents.mockResolvedValue([
      {
        id: "test",
        icon: "🔧",
        name: "Test Event",
        desc: undefined,
        description: "Fallback description",
      },
    ] as never[]);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.lifeEvents[0].desc).toBe("Fallback description");
  });

  it("filters ineligible services when persona is provided", async () => {
    mockedGetPersonaData.mockReturnValue({ id: "mary-summers" });
    mockedCheckEligibility.mockImplementation((eligibility) => {
      const e = eligibility as { summary: string };
      if (e.summary === "first-time buyers only") return { eligible: false, reason: "owns property" };
      return { eligible: true };
    });

    const mockEngine = {
      getLifeEventServices: vi.fn().mockReturnValue([
        {
          id: "help-to-buy", name: "Help to Buy", dept: "HE",
          serviceType: "grant", proactive: true, gated: false,
          desc: "First-time buyer scheme", govuk_url: "https://gov.uk/htb",
          eligibility: { summary: "first-time buyers only" },
        },
        {
          id: "sdlt", name: "Stamp Duty", dept: "HMRC",
          serviceType: "obligation", proactive: true, gated: true,
          desc: "File SDLT return", govuk_url: "https://gov.uk/sdlt",
          eligibility: { summary: "all property purchases" },
        },
      ]),
      getLifeEventPlan: vi.fn().mockReturnValue({
        entryServiceIds: ["help-to-buy", "sdlt"],
        groups: [{ depth: 0, label: "Start here", prerequisiteIds: [], serviceIds: ["help-to-buy", "sdlt"] }],
        edges: [{ from: "help-to-buy", to: "sdlt", type: "ENABLES" }],
      }),
    };

    mockedGetGraphEngine.mockReturnValue(mockEngine as never);
    mockedGetLifeEvents.mockResolvedValue([
      { id: "buying-home", icon: "🏠", name: "Buying a Home", desc: "Buy a home", entryNodes: ["help-to-buy", "sdlt"] },
    ] as never[]);

    const response = await GET(makeRequest("http://localhost:3102/api/life-events?persona=mary-summers"));
    const data = await response.json();

    const le = data.lifeEvents[0];
    expect(le.services).toHaveLength(1);
    expect(le.services[0].id).toBe("sdlt");
    expect(le.totalServiceCount).toBe(1);
    expect(le.plan.entryServiceIds).toEqual(["sdlt"]);
    expect(le.plan.groups[0].serviceIds).toEqual(["sdlt"]);
    expect(le.plan.edges).toEqual([]); // edge referencing help-to-buy removed
  });

  it("returns unfiltered results when no persona param", async () => {
    mockedGetPersonaData.mockReturnValue(null);

    const mockEngine = {
      getLifeEventServices: vi.fn().mockReturnValue([
        {
          id: "svc-1", name: "Service 1", dept: "D", serviceType: "benefit",
          proactive: false, gated: false, desc: "desc", govuk_url: "https://gov.uk",
          eligibility: { summary: "any" },
        },
      ]),
      getLifeEventPlan: vi.fn().mockReturnValue(null),
    };

    mockedGetGraphEngine.mockReturnValue(mockEngine as never);
    mockedGetLifeEvents.mockResolvedValue([
      { id: "ev", icon: "📋", name: "Event", desc: "desc", entryNodes: [] },
    ] as never[]);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.lifeEvents[0].services).toHaveLength(1);
    expect(mockedCheckEligibility).not.toHaveBeenCalled();
  });
});
