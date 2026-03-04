/**
 * Persona Generator Engine
 *
 * Takes a scenario description → generates a full unified user persona via LLM.
 *
 * Uses AnthropicAdapter → Sonnet, 16K max tokens, 8K thinking budget.
 * Follows the same pattern as artefact-generator.ts.
 */

import { getAnthropicAdapter } from "./adapter-init";
import type { AnthropicChatOutput } from "@als/adapters";

export interface GeneratePersonaOptions {
  suggestedName?: string;
  servicesOfInterest?: string[];
}

// ── Name → ID helper ──

export function nameToId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Blank persona skeleton ──

export function buildBlankPersona(
  name: string,
  id: string
): Record<string, unknown> {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ") || "";

  return {
    id,
    name,
    personaName: name,
    description: "",
    date_of_birth: "",
    age: 0,
    national_insurance_number: "",
    address: { line_1: "", city: "", postcode: "" },
    jurisdiction: "England",
    credentials: [],
    employment_status: "employed",
    income: 0,
    savings: 0,
    bank_account: true,
    primaryContact: {
      firstName,
      lastName,
      dateOfBirth: "",
      nationalInsuranceNumber: "",
      email: "",
      phone: "",
    },
    employment: { status: "Employed" },
    financials: {},
    benefits: { currentlyReceiving: [], previousClaims: [] },
    healthInfo: { gpSurgery: "", conditions: [], medications: [] },
    family: { children: [], notes: "", supportNetwork: [] },
    vehicles: [],
    communicationStyle: {
      tone: "",
      techSavvy: "",
      primaryConcerns: [],
      typicalPhrases: [],
    },
  };
}

// ── System prompt ──

function buildSystemPrompt(): string {
  return `You are a UK government test persona generator for the Agentic Legibility Stack.
You create realistic, detailed test user profiles for citizen service simulations.

## Output Format
Output exactly one JSON code block containing the full persona object:

\`\`\`json
{ ... }
\`\`\`

## Schema
The persona JSON must include these top-level keys:

### Required fields
- id (string): kebab-case slug of the full name, e.g. "margaret-thompson"
- name (string): Full legal name, e.g. "Margaret Thompson"
- personaName (string): Display name (may differ for couples, e.g. "Emma & Liam Parker")
- description (string): One-line summary of the persona situation
- date_of_birth (string): ISO date, e.g. "1955-09-14"
- age (number): Current age (relative to March 2026)
- national_insurance_number (string): UK format, e.g. "AB123456C"
- address (object): { line_1, line_2?, city, county?, postcode, country? }
- jurisdiction (string): "England" | "Wales" | "Scotland" | "Northern Ireland"
- credentials (array): Each: { type, issuer, number, issued, expires?, status }
  - type: "driving-licence" | "national-insurance" | "proof-of-address" | "passport"
  - status: "valid" | "expired" | "revoked" | "suspended"
- employment_status (string): "employed" | "self-employed" | "unemployed" | "retired"
- income (number): Annual income
- savings (number): Total savings
- bank_account (boolean): Whether they have a bank account
- primaryContact (object): { firstName, middleName?, lastName, dateOfBirth, nationalInsuranceNumber, email, phone }
- employment (object): Varies by status:
  - Employed: { status: "Employed", employer, jobTitle, startDate?, annualIncome?, taxCode?, payrollNumber? }
  - Self-employed: { status: "Self-employed", businessName, companyNumber?, vatNumber?, businessStartDate?, annualRevenue? }
  - Unemployed: { status: "Unemployed", previousEmployer?, previousJobTitle?, employmentEndDate?, endReason? }
  - Retired: { status: "Retired", previousEmployer?, retirementDate?, pension? }
  - For couples: use per-person sub-objects: { personName1: { status, ... }, personName2: { status, ... } }
- financials (object): {
    householdIncome?, combinedAnnualIncome?, monthlyRent?, monthlyMortgage?, councilTaxBand?, councilTaxAnnual?,
    currentAccount?: { bank, sortCode, accountNumber, balance },
    savingsAccount?: { bank, sortCode, accountNumber, balance },
    jointAccount?: { bank, sortCode, accountNumber, balance },
    businessAccount?: { bank, sortCode, accountNumber, balance },
    statePension?: { weeklyAmount, annualAmount },
    privatePension?: { provider, monthlyAmount, annualAmount },
    investments?: { provider, type, value }
  }
- benefits (object): {
    currentlyReceiving: [{ type, amount, frequency, startDate, reason? }],
    previousClaims: [{ type, startDate, endDate, reason }],
    potentiallyEligibleFor?: string[]
  }
- healthInfo (object): {
    gpSurgery, nhsNumber?, conditions: [{ name, diagnosed?, severity?, management? }],
    medications: [{ name, dosage?, purpose? }],
    mobilityAids?: string[],
    hospitalAppointments?: [{ type, frequency?, lastAppointment? }]
  }
  For couples: use per-person sub-objects: { personName1: { gpSurgery, ... }, personName2: { ... } }
- family (object): {
    children: [{ firstName, lastName, dateOfBirth, childBenefitNumber? }],
    notes: string,
    supportNetwork: string[]
  }
- vehicles (array): Each: { make, model, year, color, registrationNumber, owner?, motExpiry?, taxExpiry?, insuranceExpiry?, businessUse?, annualMileage?, notes? }
- communicationStyle (object): {
    tone: string (personality description),
    techSavvy: string (digital literacy description),
    primaryConcerns: string[] (3-5 worries),
    typicalPhrases: string[] (4-6 characteristic phrases in first person)
  }

### Optional/conditional sections (include when relevant)
- partner (object): { firstName, middleName?, lastName, dateOfBirth, nationalInsuranceNumber, email, phone }
- spouse (object): same structure as partner
- housing (object): { type: "Private rental"|"Council rental"|"Owner occupier"|"Social housing", landlord?, leaseEnd?, monthlyRent?, depositPaid?, housingBenefitEligible? }
- pregnancy (object): { dueDate, hospital, midwife, firstBaby, expectedArrival }
- deceased (object): { spouse: { firstName, lastName, dateOfBirth, dateOfDeath, relationship } }
- businessAssets (object): { homeOffice?: { location, equipment: string[], claimableExpenses: boolean } }
- spouseEmployment (object): same structure as employment for the spouse
- self_employed (boolean), over_70 (boolean), no_fixed_address (boolean)
- pension_qualifying_years (number)
- employer (string): top-level shortcut when single employed person

## Rules
1. Use realistic UK data: proper NI number format (AB123456C), real UK cities and postcodes, UK phone numbers (07xxx), NHS-style GP surgery names
2. The communicationStyle should reflect the persona's background, age, tech literacy, and emotional state
3. Set the age field to match the date_of_birth relative to March 2026
4. Credentials should include at least national-insurance (always valid) and 1-2 others
5. Financial data must be internally consistent (income matches employment, savings plausible for circumstances)
6. Include conditional sections (partner, housing, pregnancy, deceased, etc.) ONLY when relevant to the scenario
7. For couples, use the primary person's data at the top level and add the partner/spouse section
8. The typicalPhrases should sound natural and specific to this person's situation
9. Do NOT include sections that don't apply — keep the persona focused and realistic

## Example 1: Simple persona (single, unemployed)

\`\`\`json
{
  "id": "david-evans",
  "name": "David Evans",
  "personaName": "David Evans",
  "description": "Recently redundant warehouse worker, struggling with finances",
  "date_of_birth": "1992-01-30",
  "age": 34,
  "national_insurance_number": "EF345678G",
  "address": { "line_1": "Flat 3, 28 High Street", "city": "Bristol", "postcode": "BS1 4AQ" },
  "jurisdiction": "England",
  "credentials": [
    { "type": "national-insurance", "issuer": "HMRC", "number": "EF345678G", "issued": "2010-01-30", "status": "valid" },
    { "type": "proof-of-address", "issuer": "Royal Mail", "number": "PAF-DE-BS14AQ", "issued": "2025-03-01", "expires": "2026-03-01", "status": "valid" }
  ],
  "employment_status": "unemployed",
  "income": 0,
  "savings": 800,
  "bank_account": true,
  "no_fixed_address": false,
  "primaryContact": { "firstName": "David", "middleName": "Thomas", "lastName": "Evans", "dateOfBirth": "1992-01-30", "nationalInsuranceNumber": "EF345678G", "email": "dave.evans92@gmail.com", "phone": "07534891234" },
  "employment": { "status": "Unemployed", "previousEmployer": "Bristol Distribution Centre (Amazon)", "previousJobTitle": "Warehouse Logistics Coordinator", "employmentEndDate": "2026-02-14", "endReason": "Redundancy - site closure", "yearsWorked": 6, "previousIncome": 26500 },
  "financials": { "currentAccount": { "bank": "Barclays", "sortCode": "20-00-00", "accountNumber": "33445566", "balance": 800 }, "monthlyRent": 875, "councilTaxBand": "A", "councilTaxAnnual": 1420 },
  "benefits": { "currentlyReceiving": [], "previousClaims": [], "potentiallyEligibleFor": ["Universal Credit", "Council Tax Reduction", "Help with Housing Costs"] },
  "healthInfo": { "gpSurgery": "Broadmead Medical Centre", "conditions": [{ "name": "Mild anxiety", "diagnosed": "2026-02-20", "management": "Self-management, considering counselling" }], "medications": [] },
  "family": { "children": [], "notes": "Single. Parents in Cardiff. Younger sister in London.", "supportNetwork": ["Parents in Cardiff", "Mate from warehouse also redundant"] },
  "housing": { "type": "Private rental", "landlord": "Bristol Property Management Ltd", "leaseEnd": "2026-09-30", "monthlyRent": 875, "depositPaid": 875, "housingBenefitEligible": true },
  "vehicles": [],
  "communicationStyle": { "tone": "Casual, slightly frustrated, straightforward", "techSavvy": "Moderate - uses smartphone daily, impatient with long forms", "primaryConcerns": ["Paying next month's rent", "How long until he gets any money", "Not wanting to feel judged"], "typicalPhrases": ["Look, I just need to know when I'll get paid", "I've never had to do this before", "I worked for six years and now I can't even pay my rent"] }
}
\`\`\`

## Example 2: Complex persona (couple, multiple sections)

\`\`\`json
{
  "id": "emma-parker",
  "name": "Emma Parker",
  "personaName": "Emma & Liam Parker",
  "description": "Young expecting couple, first baby on the way",
  "date_of_birth": "1997-03-15",
  "age": 29,
  "national_insurance_number": "AB123456C",
  "address": { "line_1": "Flat 3B, Riverside Apartments", "line_2": "42 Thames View", "city": "London", "postcode": "SE1 7PQ" },
  "jurisdiction": "England",
  "credentials": [
    { "type": "driving-licence", "issuer": "DVLA", "number": "PARKE970315EC9IJ", "issued": "2019-06-01", "expires": "2029-06-01", "status": "valid" },
    { "type": "national-insurance", "issuer": "HMRC", "number": "AB123456C", "issued": "2015-03-15", "status": "valid" }
  ],
  "employment_status": "employed",
  "employer": "NHS Guy's and St Thomas' Hospital Trust",
  "income": 32500,
  "savings": 8500,
  "bank_account": true,
  "primaryContact": { "firstName": "Emma", "middleName": "Charlotte", "lastName": "Parker", "dateOfBirth": "1997-03-15", "nationalInsuranceNumber": "AB123456C", "email": "emma.parker@email.com", "phone": "07712345678" },
  "partner": { "firstName": "Liam", "middleName": "James", "lastName": "Parker", "dateOfBirth": "1996-08-22", "nationalInsuranceNumber": "CD789012E", "email": "liam.parker@email.com", "phone": "07798765432" },
  "employment": {
    "emma": { "status": "Employed", "employer": "NHS Guy's and St Thomas' Hospital Trust", "jobTitle": "Staff Nurse - Maternity Ward", "annualIncome": 32500, "maternityLeaveStart": "2026-07-15" },
    "liam": { "status": "Employed", "employer": "Southwark Primary School", "jobTitle": "Primary School Teacher - Year 3", "annualIncome": 25500 }
  },
  "financials": { "combinedAnnualIncome": 58000, "monthlyMortgage": 1450, "savingsAccount": { "bank": "Lloyds Bank", "sortCode": "30-94-55", "accountNumber": "12345678", "balance": 8500 }, "jointAccount": { "bank": "Lloyds Bank", "sortCode": "30-94-55", "accountNumber": "87654321", "balance": 2300 } },
  "pregnancy": { "dueDate": "2026-08-12", "hospital": "Guy's and St Thomas' Hospital", "midwife": "Sarah Johnson", "firstBaby": true, "expectedArrival": "First child" },
  "benefits": { "currentlyReceiving": [], "previousClaims": [] },
  "healthInfo": { "emma": { "gpSurgery": "Southwark Medical Centre", "conditions": ["Pregnancy - healthy"], "medications": ["Prenatal vitamins"] }, "liam": { "gpSurgery": "Southwark Medical Centre", "conditions": ["None"], "medications": [] } },
  "vehicles": [{ "make": "Ford", "model": "Fiesta", "year": 2019, "color": "Blue", "registrationNumber": "BG19 XYZ", "owner": "Joint", "motExpiry": "2026-04-15" }],
  "communicationStyle": { "tone": "Casual, friendly, slightly anxious", "techSavvy": "Basic - uses smartphone apps but not confident with complex forms", "primaryConcerns": ["Getting all financial support they're entitled to", "Not messing up important paperwork", "Understanding what to do before baby arrives"], "typicalPhrases": ["We just want to make sure we're doing everything right", "This is all new to us", "Will this affect our other benefits?"] }
}
\`\`\``;
}

// ── User prompt ──

function buildUserPrompt(
  scenarioDescription: string,
  options?: GeneratePersonaOptions
): string {
  let prompt = `Generate a complete UK citizen test persona based on this scenario:

## Scenario
${scenarioDescription}
`;

  if (options?.suggestedName) {
    prompt += `
## Suggested Name
${options.suggestedName}
`;
  }

  if (options?.servicesOfInterest && options.servicesOfInterest.length > 0) {
    prompt += `
## Services of Interest
The persona should be in a situation relevant to these government services:
${options.servicesOfInterest.map((s) => `- ${s}`).join("\n")}
`;
  }

  prompt += `
Generate the complete persona JSON now. Include all relevant sections based on the scenario. Use today's date (March 2026) as the reference point.`;

  return prompt;
}

// ── Response parsing ──

function parsePersonaJson(text: string): Record<string, unknown> | null {
  // Try fenced JSON block first
  const fencedPattern = /```json\s*\n([\s\S]*?)```/;
  const match = fencedPattern.exec(text);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e) {
      console.warn("[PersonaGenerator] Failed to parse fenced JSON:", e);
    }
  }

  // Fallback: try to find raw JSON object in the response
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    } catch {
      // skip
    }
  }

  return null;
}

// ── Validation ──

const REQUIRED_KEYS = [
  "id",
  "name",
  "personaName",
  "description",
  "date_of_birth",
  "age",
  "address",
  "credentials",
  "primaryContact",
  "employment",
  "financials",
  "communicationStyle",
];

function validatePersona(
  persona: Record<string, unknown>
): { valid: true } | { valid: false; missing: string[] } {
  const missing = REQUIRED_KEYS.filter((key) => persona[key] === undefined);
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  return { valid: true };
}

// ── Main generator ──

export async function generatePersona(
  scenarioDescription: string,
  options?: GeneratePersonaOptions
): Promise<Record<string, unknown>> {
  // 1. Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(scenarioDescription, options);

  // 2. Call LLM
  const adapter = getAnthropicAdapter();
  const result = await adapter.execute({
    type: "anthropic",
    input: {
      systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      model: "claude-sonnet-4-5-20250929",
      maxTokens: 16000,
      thinkingBudget: 8000,
    },
  });

  if (!result.success || !result.output) {
    throw new Error(`LLM call failed: ${result.error}`);
  }

  const output = result.output as AnthropicChatOutput;
  const responseText = output.responseText;

  // 3. Parse response
  const persona = parsePersonaJson(responseText);
  if (!persona) {
    throw new Error(
      "Failed to parse LLM response into valid persona JSON. Please try again."
    );
  }

  // 4. Validate
  const validation = validatePersona(persona);
  if (!validation.valid) {
    throw new Error(
      `Generated persona missing required fields: ${validation.missing.join(", ")}. Please try again.`
    );
  }

  // 5. Normalize the ID
  if (typeof persona.id === "string") {
    persona.id = nameToId(persona.id);
  } else if (typeof persona.name === "string") {
    persona.id = nameToId(persona.name as string);
  }

  return persona;
}
