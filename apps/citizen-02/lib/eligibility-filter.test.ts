import { describe, it, expect } from "vitest";
import {
  checkPersonaEligibility,
  extractNumberFromText,
  getPersonaAge,
} from "./eligibility-filter";
import type { EligibilityInfo } from "@als/service-graph";

// ── Helper tests ──

describe("extractNumberFromText", () => {
  it("extracts £80,000 from income description", () => {
    expect(extractNumberFromText("Household income cap up to £80,000", ["income"])).toBe(80000);
  });

  it("extracts £450,000 from property description", () => {
    expect(extractNumberFromText("Property must cost £450,000 or less", ["property", "cost"])).toBe(450000);
  });

  it("returns null when no keyword matches", () => {
    expect(extractNumberFromText("Property must cost £450,000", ["income"])).toBeNull();
  });

  it("returns null when no number found", () => {
    expect(extractNumberFromText("Must have low income", ["income"])).toBeNull();
  });
});

describe("getPersonaAge", () => {
  it("calculates age from primaryContact.dateOfBirth", () => {
    const age = getPersonaAge({
      primaryContact: { dateOfBirth: "1961-06-15" },
    });
    expect(age).toBeGreaterThanOrEqual(63);
    expect(age).toBeLessThanOrEqual(65);
  });

  it("calculates age from top-level date_of_birth", () => {
    const age = getPersonaAge({ date_of_birth: "1990-01-01" });
    expect(age).toBeGreaterThanOrEqual(35);
    expect(age).toBeLessThanOrEqual(37);
  });

  it("returns null when no DOB available", () => {
    expect(getPersonaAge({})).toBeNull();
  });
});

// ── Core eligibility checks ──

const universalService: EligibilityInfo = {
  summary: "Required for all property purchases",
  universal: true,
  criteria: [{ factor: "property", description: "Any property purchase" }],
  keyQuestions: [],
  means_tested: false,
};

const firstTimeBuyerGrant: EligibilityInfo = {
  summary: "First Homes scheme for first-time buyers",
  universal: false,
  criteria: [
    { factor: "property", description: "First-time buyer purchasing a new-build property." },
    { factor: "income", description: "Household income cap up to £80,000 (£90,000 in London)." },
  ],
  keyQuestions: [],
  exclusions: ["Not available to existing homeowners or those who have previously owned property."],
  means_tested: true,
};

const lisaService: EligibilityInfo = {
  summary: "Lifetime ISA for first-time buyers",
  universal: false,
  criteria: [
    { factor: "age", description: "Must have opened the LISA before age 40, and be at least 18." },
    { factor: "property", description: "Property must cost £450,000 or less and be the buyer's first home." },
  ],
  keyQuestions: [],
  exclusions: ["Not available for second homes or existing property owners."],
  means_tested: false,
};

// Mary Summers: 64, retired, owns 2 properties, £183k combined income, £250k savings
const marySummers: Record<string, unknown> = {
  primaryContact: { dateOfBirth: "1961-06-15" },
  financials: {
    combinedAnnualIncome: 183400,
    properties: [
      { address: "12 Barnsbury Square", type: "Primary residence" },
      { address: "Pen-y-Bryn, Brecon", type: "Second home" },
    ],
  },
  savings: 250000,
  housing: { type: "Owner occupier" },
};

// Emma Parker: 28, employed, renting, no property, £58k combined income
const emmaParker: Record<string, unknown> = {
  primaryContact: { dateOfBirth: "1997-09-12" },
  financials: {
    combinedAnnualIncome: 58000,
  },
  savings: 8500,
  address: { housingStatus: "renting" },
};

describe("checkPersonaEligibility", () => {
  it("universal service → always eligible", () => {
    const result = checkPersonaEligibility(universalService, marySummers);
    expect(result.eligible).toBe(true);
  });

  it("first-time buyer exclusion: property-owning persona → ineligible", () => {
    const result = checkPersonaEligibility(firstTimeBuyerGrant, marySummers);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Excluded");
  });

  it("first-time buyer grant: renting persona → eligible", () => {
    const result = checkPersonaEligibility(firstTimeBuyerGrant, emmaParker);
    expect(result.eligible).toBe(true);
  });

  it("LISA: property-owning persona → ineligible via exclusion", () => {
    const result = checkPersonaEligibility(lisaService, marySummers);
    expect(result.eligible).toBe(false);
  });

  it("LISA: young renting persona → eligible", () => {
    const result = checkPersonaEligibility(lisaService, emmaParker);
    expect(result.eligible).toBe(true);
  });

  it("means-tested service: high-income persona over threshold → ineligible", () => {
    const meansTested: EligibilityInfo = {
      summary: "Grant for low-income households",
      universal: false,
      criteria: [
        { factor: "income", description: "Household income must be below £30,000 per year." },
      ],
      keyQuestions: [],
      means_tested: true,
    };
    const result = checkPersonaEligibility(meansTested, marySummers);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("income");
  });

  it("means-tested but income under threshold → eligible", () => {
    const meansTested: EligibilityInfo = {
      summary: "Grant for moderate-income households",
      universal: false,
      criteria: [
        { factor: "income", description: "Household income up to £200,000." },
      ],
      keyQuestions: [],
      means_tested: true,
    };
    const result = checkPersonaEligibility(meansTested, marySummers);
    expect(result.eligible).toBe(true);
  });

  it("age-gated service: out of range → ineligible", () => {
    const ageGated: EligibilityInfo = {
      summary: "Youth support grant",
      universal: false,
      criteria: [
        { factor: "age", description: "Must be aged 18 to 30." },
      ],
      keyQuestions: [],
      means_tested: false,
    };
    const result = checkPersonaEligibility(ageGated, marySummers);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Age");
  });

  it("age-gated service: in range → eligible", () => {
    const ageGated: EligibilityInfo = {
      summary: "Youth support grant",
      universal: false,
      criteria: [
        { factor: "age", description: "Must be aged 18 to 30." },
      ],
      keyQuestions: [],
      means_tested: false,
    };
    const result = checkPersonaEligibility(ageGated, emmaParker);
    expect(result.eligible).toBe(true);
  });

  it("conservative default: unknown factor → eligible", () => {
    const unknownFactor: EligibilityInfo = {
      summary: "Complex eligibility",
      universal: false,
      criteria: [
        { factor: "caring", description: "Must be a registered carer for at least 35 hours per week." },
      ],
      keyQuestions: [],
      means_tested: false,
    };
    const result = checkPersonaEligibility(unknownFactor, marySummers);
    expect(result.eligible).toBe(true);
  });

  it("no exclusions and no criteria → eligible", () => {
    const minimal: EligibilityInfo = {
      summary: "A service",
      universal: false,
      criteria: [],
      keyQuestions: [],
      means_tested: false,
    };
    const result = checkPersonaEligibility(minimal, marySummers);
    expect(result.eligible).toBe(true);
  });
});

describe("Mary Summers vs Buying a Home integration", () => {
  // Simulates what the API route does for the buying-home life event
  const buyingHomeServices = [
    { id: "other-help-to-buy", eligibility: firstTimeBuyerGrant },
    { id: "hmrc-lisa", eligibility: lisaService },
    { id: "hmrc-sdlt", eligibility: universalService },
  ];

  it("Mary should be excluded from first-time buyer services", () => {
    const excluded = buyingHomeServices
      .filter((svc) => !checkPersonaEligibility(svc.eligibility, marySummers).eligible)
      .map((svc) => svc.id);

    expect(excluded).toContain("other-help-to-buy");
    expect(excluded).toContain("hmrc-lisa");
    expect(excluded).not.toContain("hmrc-sdlt");
  });

  it("Emma should see all buying-home services", () => {
    const excluded = buyingHomeServices
      .filter((svc) => !checkPersonaEligibility(svc.eligibility, emmaParker).eligible)
      .map((svc) => svc.id);

    expect(excluded).toHaveLength(0);
  });
});
