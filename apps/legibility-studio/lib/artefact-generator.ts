/**
 * Artefact Generator Engine
 *
 * Takes GOV.UK content + service metadata + interaction type → generates
 * policy.json, state-model.json, consent.json via LLM.
 *
 * Uses AnthropicAdapter → Sonnet, 16K max tokens, 8K thinking budget.
 */

import { getAnthropicAdapter } from "./adapter-init";
import { extractGovukContent } from "./govuk-content-extractor";
import { getEnrichment, type CsvEnrichment } from "./csv-enrichment";
import {
  INTERACTION_TYPE_MAP,
  inferInteractionType,
  type InteractionType,
} from "./interaction-types";
import type { ServiceWithArtefacts } from "@als/service-store";
import type { AnthropicChatOutput } from "@als/adapters";

export interface GeneratedArtefacts {
  policy: Record<string, unknown>;
  stateModel: Record<string, unknown>;
  consent: Record<string, unknown>;
  interactionType: InteractionType;
  govukContent: { title: string; documentType: string; sectionCount: number } | null;
  enrichment: CsvEnrichment | null;
}

// ── Few-shot examples (abridged from data/services/) ──

const EXAMPLE_POLICY = `{
  "id": "dvla.renew-licence.eligibility",
  "version": "1.0.0",
  "rules": [
    { "id": "age-minimum", "description": "Applicant must be at least 16 years old", "condition": { "field": "age", "operator": ">=", "value": 16 }, "reason_if_failed": "You must be at least 16 years old to hold a driving licence", "evidence_source": "identity-verified" },
    { "id": "has-licence", "description": "Applicant must have an existing driving licence", "condition": { "field": "driving_licence_number", "operator": "exists" }, "reason_if_failed": "You need an existing driving licence to renew. Apply for a new licence instead.", "alternative_service": "dvla.apply-provisional-licence" },
    { "id": "uk-resident", "description": "Applicant must be a UK resident", "condition": { "field": "jurisdiction", "operator": "in", "value": ["England", "Wales", "Scotland"] }, "reason_if_failed": "This service is for UK residents only" },
    { "id": "not-revoked", "description": "Licence must not be currently revoked", "condition": { "field": "licence_status", "operator": "!=", "value": "revoked" }, "reason_if_failed": "Your licence has been revoked. Contact DVLA for reinstatement.", "triggers_handoff": true }
  ],
  "explanation_template": "Driving licence renewal eligibility: {outcome}",
  "edge_cases": [
    { "id": "medical-condition", "description": "Applicant has a medical condition that may affect driving", "detection": "medical_conditions", "action": "Route to medical assessment. DVLA form C1 required." },
    { "id": "over-70", "description": "Applicant is over 70 (different renewal cycle)", "detection": "over_70", "action": "Over-70 renewal is free but requires medical self-declaration." }
  ]
}`;

const EXAMPLE_STATE_MODEL = `{
  "id": "dvla.renew-licence.states",
  "version": "1.0.0",
  "states": [
    { "id": "not-started", "type": "initial" },
    { "id": "identity-verified" },
    { "id": "eligibility-checked" },
    { "id": "consent-given" },
    { "id": "details-confirmed" },
    { "id": "photo-submitted" },
    { "id": "payment-made", "receipt": true },
    { "id": "application-submitted", "receipt": true },
    { "id": "completed", "type": "terminal", "receipt": true },
    { "id": "rejected", "type": "terminal", "receipt": true },
    { "id": "handed-off", "type": "terminal", "receipt": true }
  ],
  "transitions": [
    { "from": "not-started", "to": "identity-verified", "trigger": "verify-identity" },
    { "from": "identity-verified", "to": "eligibility-checked", "trigger": "check-eligibility" },
    { "from": "eligibility-checked", "to": "consent-given", "trigger": "grant-consent", "condition": "eligible" },
    { "from": "eligibility-checked", "to": "rejected", "trigger": "reject", "condition": "not-eligible" },
    { "from": "eligibility-checked", "to": "handed-off", "trigger": "handoff", "condition": "edge-case" },
    { "from": "consent-given", "to": "details-confirmed", "trigger": "confirm-details" },
    { "from": "details-confirmed", "to": "photo-submitted", "trigger": "submit-photo" },
    { "from": "photo-submitted", "to": "payment-made", "trigger": "make-payment" },
    { "from": "payment-made", "to": "application-submitted", "trigger": "submit-application" },
    { "from": "application-submitted", "to": "completed", "trigger": "complete" }
  ]
}`;

const EXAMPLE_CONSENT = `{
  "id": "dvla.renew-licence.consent",
  "version": "1.0.0",
  "grants": [
    { "id": "identity-verification", "description": "Verify your identity using your GOV.UK One Login credentials", "data_shared": ["full_name", "date_of_birth", "national_insurance_number"], "source": "one-login", "purpose": "To confirm you are who you say you are before processing the renewal", "duration": "session", "required": true },
    { "id": "photo-sharing", "description": "Share your passport photo with DVLA for the new licence", "data_shared": ["passport_photo"], "source": "hmpo-passport-office", "purpose": "DVLA will use your most recent passport photo for the new licence card", "duration": "session", "required": true },
    { "id": "address-confirmation", "description": "Confirm your current address for the licence and DVLA records", "data_shared": ["address_line_1", "address_line_2", "city", "postcode"], "source": "citizen-provided", "purpose": "The new licence will be posted to this address", "duration": "session", "required": true }
  ],
  "revocation": { "mechanism": "Contact DVLA or revoke through your GOV.UK account", "effect": "Application will be cancelled if consent is revoked before completion" },
  "delegation": { "agent_identity": "GOV.UK AI Agent", "scopes": ["read-personal-data", "submit-to-dvla"], "limitations": "Agent cannot make payment on your behalf. Agent cannot change your address without your explicit confirmation." }
}`;

// ── System prompt ──

function buildSystemPrompt(): string {
  return `You are a UK government service architect generating machine-readable artefacts for the Agentic Legibility Stack.

You produce three JSON artefacts for each service:

## 1. PolicyRuleset
TypeScript interface:
\`\`\`
interface PolicyRuleset {
  id: string;                    // e.g. "dept.service-name.eligibility"
  version: string;               // "1.0.0"
  rules: PolicyRule[];           // at least 1 rule
  explanation_template?: string; // e.g. "Eligibility: {outcome}"
  edge_cases?: PolicyEdgeCase[]; // special circumstances
}
interface PolicyRule {
  id: string;
  description: string;
  condition: {
    field: string;
    operator: ">=" | "<=" | "==" | "!=" | "exists" | "not-exists" | "in";
    value?: unknown;
  };
  reason_if_failed: string;
  evidence_source?: string;
  alternative_service?: string;
  triggers_handoff?: boolean;
}
interface PolicyEdgeCase {
  id: string; description: string; detection?: string; action: string;
}
\`\`\`

## 2. StateModelDefinition
\`\`\`
interface StateModelDefinition {
  id: string;                       // e.g. "dept.service-name.states"
  version: string;
  states: StateDefinition[];        // exactly 1 initial, at least 1 terminal
  transitions: TransitionDefinition[];
}
interface StateDefinition { id: string; type?: "initial" | "terminal"; receipt?: boolean; }
interface TransitionDefinition { from: string; to: string; trigger?: string; condition?: string; }
\`\`\`

## 3. ConsentModel
\`\`\`
interface ConsentModel {
  id: string;                    // e.g. "dept.service-name.consent"
  version: string;
  grants: ConsentGrant[];        // at least 1 grant
  revocation?: { mechanism: string; effect: string; };
  delegation?: { agent_identity: string; scopes: string[]; limitations: string; };
}
interface ConsentGrant {
  id: string; description: string; data_shared: string[];
  source: string; purpose: string; duration: "session" | "until-revoked"; required: boolean;
}
\`\`\`

## Key rules
- The GOV.UK page describes the **guidance before** the service. The state model describes the journey **within** the service, starting after "Start now".
- Policy rules should capture real eligibility criteria from the guidance (age, residency, etc.).
- Edge cases should capture safeguarding concerns, medical conditions, or unusual circumstances.
- Consent grants should reflect what data the service actually collects and from what source.
- State IDs should be kebab-case. Trigger names should be kebab-case verbs.
- Always include at least: identity-verification consent grant, initial "not-started" state, and terminal states for completed/rejected/handed-off.
- The delegation section should describe what an AI agent CAN and CANNOT do on behalf of the citizen.

## Output format
Output exactly three labeled JSON code blocks:

\`\`\`json policy
{ ... }
\`\`\`

\`\`\`json state-model
{ ... }
\`\`\`

\`\`\`json consent
{ ... }
\`\`\`

## Example (Renew Driving Licence — license type)

\`\`\`json policy
${EXAMPLE_POLICY}
\`\`\`

\`\`\`json state-model
${EXAMPLE_STATE_MODEL}
\`\`\`

\`\`\`json consent
${EXAMPLE_CONSENT}
\`\`\``;
}

// ── User prompt ──

function buildUserPrompt(
  service: ServiceWithArtefacts,
  govukContent: string | null,
  interactionType: InteractionType,
  enrichment: CsvEnrichment | null
): string {
  const typeInfo = INTERACTION_TYPE_MAP[interactionType];

  let prompt = `Generate the three artefacts (policy, state-model, consent) for this UK government service.

## Service
- ID: ${service.id}
- Name: ${service.name}
- Department: ${service.department}
- Description: ${service.description}
- Service type: ${service.serviceType || "unknown"}
- Interaction type: ${interactionType} — "${typeInfo.description}"
- Example of this type: ${typeInfo.example}

## State model template for "${interactionType}" type
Use this as your starting point and customise it for this specific service:
\`\`\`json
${JSON.stringify(typeInfo.stateModelTemplate, null, 2)}
\`\`\`
`;

  if (enrichment) {
    prompt += `
## CDDO enrichment data
- Behind login: ${enrichment.behindLogin ? "Yes" : "No"}
- Eligibility complexity: ${enrichment.eligibilityComplexity}
- Data collected: ${enrichment.dataCollected.length > 0 ? enrichment.dataCollected.join(", ") : "unknown"}
${enrichment.actualServiceUrl ? `- Actual service URL: ${enrichment.actualServiceUrl}` : ""}
`;
  }

  if (service.eligibilitySummary) {
    prompt += `
## Eligibility summary (from service graph)
${service.eligibilitySummary}
`;
  }

  if (govukContent) {
    prompt += `
## GOV.UK page content
${govukContent}
`;
  } else {
    prompt += `
## GOV.UK content
Not available. Use the service description and eligibility summary to generate artefacts.
`;
  }

  prompt += `
## ID conventions
- Policy ID: "${service.id.replace(/^[^.]+\./, (m) => m)}eligibility" (e.g. for id "dvla.renew-driving-licence" → "dvla.renew-driving-licence.eligibility")
- State model ID: "${service.id}.states"
- Consent ID: "${service.id}.consent"

Generate the three artefacts now. Remember to customise the state model template for this specific service.`;

  return prompt;
}

// ── Response parsing ──

function parseLabeledJsonBlocks(
  text: string
): { policy: unknown; stateModel: unknown; consent: unknown } | null {
  const blockPattern = /```json\s+(policy|state-model|consent)\s*\n([\s\S]*?)```/g;
  const blocks: Record<string, unknown> = {};

  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(text)) !== null) {
    const label = match[1];
    try {
      blocks[label] = JSON.parse(match[2].trim());
    } catch (e) {
      console.warn(`[ArtefactGenerator] Failed to parse ${label} JSON:`, e);
      return null;
    }
  }

  if (!blocks["policy"] || !blocks["state-model"] || !blocks["consent"]) {
    // Fallback: try unlabeled blocks in order
    const fallbackPattern = /```json\s*\n([\s\S]*?)```/g;
    const allBlocks: unknown[] = [];
    while ((match = fallbackPattern.exec(text)) !== null) {
      try {
        allBlocks.push(JSON.parse(match[1].trim()));
      } catch {
        // skip malformed
      }
    }
    if (allBlocks.length >= 3) {
      return {
        policy: allBlocks[0],
        stateModel: allBlocks[1],
        consent: allBlocks[2],
      };
    }
    console.warn("[ArtefactGenerator] Could not find all 3 labeled blocks");
    return null;
  }

  return {
    policy: blocks["policy"],
    stateModel: blocks["state-model"],
    consent: blocks["consent"],
  };
}

// ── Normalization ──

const OPERATOR_ALIASES: Record<string, string> = {
  ">": ">=",
  "<": "<=",
  "=": "==",
  "equals": "==",
  "equal": "==",
  "is": "==",
  "not-equal": "!=",
  "not_equal": "!=",
  "not-equals": "!=",
  "not_exists": "not-exists",
  "notExists": "not-exists",
  "not_exist": "not-exists",
  "contains": "in",
  "includes": "in",
  "one-of": "in",
  "one_of": "in",
  "true": "exists",
  "false": "not-exists",
  "present": "exists",
  "absent": "not-exists",
};

const VALID_OPS = new Set([">=", "<=", "==", "!=", "exists", "not-exists", "in"]);

/** Normalize LLM-generated operators to our valid set. Mutates in place. */
function normalizePolicy(p: Record<string, unknown>): void {
  const rules = p.rules as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(rules)) return;
  for (const rule of rules) {
    const cond = rule.condition as Record<string, unknown> | undefined;
    if (!cond || !cond.operator) continue;
    const op = String(cond.operator).trim();
    if (!VALID_OPS.has(op)) {
      const mapped = OPERATOR_ALIASES[op.toLowerCase()];
      if (mapped) {
        cond.operator = mapped;
      }
    }
  }
}

// ── Validation ──

function validatePolicy(p: Record<string, unknown>): boolean {
  if (!p.id || !p.version) return false;
  const rules = p.rules as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(rules) || rules.length === 0) return false;
  for (const rule of rules) {
    const cond = rule.condition as Record<string, unknown> | undefined;
    if (!cond || !cond.field || !VALID_OPS.has(cond.operator as string)) {
      return false;
    }
  }
  return true;
}

function validateStateModel(sm: Record<string, unknown>): boolean {
  if (!sm.id || !sm.version) return false;
  const states = sm.states as Array<{ id: string; type?: string }> | undefined;
  const transitions = sm.transitions as Array<{ from: string; to: string }> | undefined;
  if (!Array.isArray(states) || states.length === 0) return false;
  if (!Array.isArray(transitions) || transitions.length === 0) return false;
  const hasInitial = states.some((s) => s.type === "initial");
  const hasTerminal = states.some((s) => s.type === "terminal");
  if (!hasInitial || !hasTerminal) return false;
  // Check all transitions reference valid state IDs
  const stateIds = new Set(states.map((s) => s.id));
  for (const t of transitions) {
    if (!stateIds.has(t.from) || !stateIds.has(t.to)) return false;
  }
  return true;
}

function validateConsent(c: Record<string, unknown>): boolean {
  if (!c.id || !c.version) return false;
  const grants = c.grants as Array<{ data_shared?: string[] }> | undefined;
  if (!Array.isArray(grants) || grants.length === 0) return false;
  for (const g of grants) {
    if (!Array.isArray(g.data_shared) || g.data_shared.length === 0) return false;
  }
  return true;
}

// ── Main generator ──

export async function generateArtefacts(
  service: ServiceWithArtefacts
): Promise<GeneratedArtefacts> {
  // 1. Determine interaction type
  const enrichment = getEnrichment(service.govukUrl);
  const interactionType: InteractionType =
    enrichment?.interactionType || inferInteractionType(service.serviceType);

  // 2. Fetch GOV.UK content
  let govukContentResult: Awaited<ReturnType<typeof extractGovukContent>> = null;
  if (service.govukUrl) {
    try {
      govukContentResult = await extractGovukContent(service.govukUrl);
    } catch (e) {
      console.warn("[ArtefactGenerator] GOV.UK content extraction failed:", e);
    }
  }

  // 3. Build prompts
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(
    service,
    govukContentResult?.fullText || null,
    interactionType,
    enrichment
  );

  // 4. Call LLM
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

  // 5. Parse response
  const parsed = parseLabeledJsonBlocks(responseText);
  if (!parsed) {
    throw new Error("Failed to parse LLM response into three artefact blocks");
  }

  const policy = parsed.policy as Record<string, unknown>;
  const stateModel = parsed.stateModel as Record<string, unknown>;
  const consent = parsed.consent as Record<string, unknown>;

  // 5b. Normalize LLM output before validation
  normalizePolicy(policy);

  // 6. Validate
  if (!validatePolicy(policy)) {
    throw new Error("Generated policy failed validation");
  }
  if (!validateStateModel(stateModel)) {
    throw new Error("Generated state model failed validation");
  }
  if (!validateConsent(consent)) {
    throw new Error("Generated consent model failed validation");
  }

  return {
    policy,
    stateModel,
    consent,
    interactionType,
    govukContent: govukContentResult
      ? {
          title: govukContentResult.title,
          documentType: govukContentResult.documentType,
          sectionCount: govukContentResult.sections.length,
        }
      : null,
    enrichment,
  };
}
