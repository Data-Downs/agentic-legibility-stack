import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import * as mcpClient from "@/lib/mcp-client";
import * as localMcpClient from "@/lib/local-mcp-client";
import { CapabilityInvoker, HandoffManager } from "@als/runtime";
import { AnthropicAdapter } from "@als/adapters";
import type { AnthropicChatInput, AnthropicChatOutput } from "@als/adapters";
import type { InvocationContext, PolicyRuleset, StateModelDefinition } from "@als/schemas";
import { PolicyEvaluator, StateMachine } from "@als/legibility";
import { getTraceEmitter, getReceiptGenerator } from "@/lib/evidence";
import { getRegistry } from "@/lib/registry";
import { extractStructuredOutput } from "@/lib/extract-structured-output";
import { getServiceArtefact, getPersonaData, getPromptFile } from "@/lib/service-data";
import { getInferredStore, getServiceAccessStore, getSubmittedStore } from "@/lib/personal-data-store";

// ── AnthropicAdapter — the ONLY Anthropic SDK usage ──
// Lazy-initialized at request time so Cloudflare Worker secrets are available
let llmAdapter: AnthropicAdapter | null = null;
let llmAdapterPromise: Promise<AnthropicAdapter> | null = null;

async function getLLMAdapter(): Promise<AnthropicAdapter> {
  if (llmAdapter) return llmAdapter;
  if (llmAdapterPromise) return llmAdapterPromise;

  llmAdapterPromise = (async () => {
    try {
      // Try process.env first (works in local dev)
      let apiKey = process.env.ANTHROPIC_API_KEY;
      // On Cloudflare Workers, secrets live in getCloudflareContext().env
      if (!apiKey) {
        try {
          const { getCloudflareContext } = await import("@opennextjs/cloudflare");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { env } = getCloudflareContext() as { env: any };
          apiKey = env?.ANTHROPIC_API_KEY;
        } catch {
          // Not on Cloudflare
        }
      }
      if (!apiKey) {
        console.warn("⚠️  ANTHROPIC_API_KEY is not set — chat will fail.");
      }
      llmAdapter = new AnthropicAdapter();
      llmAdapter.initialize({ apiKey });
      return llmAdapter;
    } catch (err) {
      llmAdapterPromise = null;
      throw err;
    }
  })();

  return llmAdapterPromise;
}

// ── Singleton CapabilityInvoker ──
const invoker = new CapabilityInvoker();

// ── PolicyEvaluator + HandoffManager ──
const policyEvaluator = new PolicyEvaluator();
const handoffManager = new HandoffManager();

// ── Scenario → service mapping (known services; new services fall through) ──
const SCENARIO_TO_SERVICE: Record<string, string> = {
  driving: "dvla.renew-driving-licence",
  benefits: "dwp.apply-universal-credit",
  parenting: "dwp.check-state-pension",
};

/** Resolve a scenario name to a serviceId — checks known map first, falls through to scenario itself */
function resolveServiceId(scenario: string): string {
  return SCENARIO_TO_SERVICE[scenario] || scenario;
}

// ── MCP connection ──
let mcpConnected = false;
async function ensureMcpConnection() {
  if (!mcpConnected) {
    mcpConnected = true;
    mcpClient.connect().then((success) => {
      if (success) {
        console.log("MCP connected — live GOV.UK data available");
      } else {
        console.log("MCP unavailable — chat works without live data");
      }
    });
  }
}

// ── Local MCP connection (for MCP mode) ──
let localMcpConnecting = false;
async function ensureLocalMcpConnection() {
  if (localMcpClient.isLocalConnected()) return;
  if (localMcpConnecting) return;
  localMcpConnecting = true;
  try {
    const success = await localMcpClient.connectLocal();
    if (success) {
      console.log("Local MCP connected — service tools available");
    } else {
      console.warn("Local MCP unavailable — MCP mode will have no service tools");
    }
  } finally {
    localMcpConnecting = false;
  }
}

/** Check if a tool name belongs to the local MCP service tools */
const SERVICE_TOOL_ACTIONS = [
  "_check_eligibility",
  "_advance_state",
];
function isLocalServiceTool(name: string): boolean {
  return SERVICE_TOOL_ACTIONS.some((action) => name.endsWith(action));
}

async function loadFile(filePath: string): Promise<string> {
  // Try bundled data first (works on Cloudflare + local)
  const bundled = getPromptFile(filePath);
  if (bundled) return bundled;
  // Fallback to filesystem (local dev only)
  const fullPath = path.join(process.cwd(), filePath);
  return fs.readFile(fullPath, "utf-8");
}

async function loadPersonaData(personaId: string) {
  // Try DB first (single source of truth)
  try {
    const submittedStore = await getSubmittedStore();
    const bundled = getPersonaData(personaId);
    if (bundled) {
      await submittedStore.seedFromPersona(personaId, bundled);
    }
    const data = await submittedStore.reconstructPersonaData(personaId);
    if (data) return data;
  } catch {
    // Fall through to bundled/filesystem
  }
  // Fallback to bundled data (works on Cloudflare + local)
  const bundled = getPersonaData(personaId);
  if (bundled) return bundled;
  // Fallback to filesystem
  const raw = await loadFile(`data/${personaId}.json`);
  return JSON.parse(raw);
}

/** Extract the directory slug from a serviceId (e.g. "dvla.renew-driving-licence" → "renew-driving-licence") */
function serviceDirSlug(serviceId: string): string {
  const parts = serviceId.split(".");
  return parts.length > 1 ? parts.slice(1).join(".") : parts[0];
}

/** Load a policy ruleset for any service — works for both known and Studio-created services */
async function loadPolicyRuleset(serviceId: string): Promise<PolicyRuleset | null> {
  // Try bundled data first
  const bundled = getServiceArtefact(serviceId, "policy");
  if (bundled) return bundled as unknown as PolicyRuleset;
  // Fallback to filesystem
  const slug = serviceDirSlug(serviceId);
  for (const base of [
    path.join(process.cwd(), "..", "..", "data", "services"),
    path.join(process.cwd(), "data", "services"),
  ]) {
    try {
      const raw = await fs.readFile(path.join(base, slug, "policy.json"), "utf-8");
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  return null;
}

/** Build a policy context object for evaluation from persona data + test users */
function buildPolicyContext(personaData: Record<string, unknown>): Record<string, unknown> {
  const contact = personaData.primaryContact as Record<string, unknown> | undefined;
  const dob = contact?.dateOfBirth as string | undefined;
  const address = personaData.address as Record<string, unknown> | undefined;

  // Calculate age
  let age = 0;
  if (dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  }

  // Extract financial data
  const financials = personaData.financials as Record<string, unknown> | undefined;
  let savings = 0;
  if (financials?.savingsAccount) {
    savings = (financials.savingsAccount as Record<string, unknown>)?.balance as number || 0;
  }

  // Derive health/mobility fields for services like Blue Badge
  const healthInfo = personaData.healthInfo as Record<string, unknown> | undefined;
  const conditions = (healthInfo?.conditions || []) as Array<Record<string, unknown>>;
  const hasMobilityCondition = conditions.some(
    (c) => {
      const name = ((c.name as string) || "").toLowerCase();
      const affects = ((c.affectsMobility as string) || (c.affects_mobility as string) || "").toLowerCase();
      return affects === "yes" || affects === "true" || name.includes("mobility") || name.includes("arthritis") || name.includes("wheelchair");
    }
  );

  // Spread full persona data so any service's policy rules can reference any field
  return {
    // Explicit computed fields
    age,
    jurisdiction: "England",
    national_insurance_number: contact?.nationalInsuranceNumber,
    driving_licence_number: personaData.vehicles ? "exists" : undefined,
    savings,
    bank_account: true,
    self_employed: (personaData.employment as Record<string, unknown>)?.status === "Self-employed",
    over_70: age >= 70,
    no_fixed_address: false,
    licence_status: "valid",
    has_mobility_condition: hasMobilityCondition,
    has_health_conditions: conditions.length > 0,
    // Spread full persona data for custom service rules
    ...personaData,
  };
}

/** Load a manifest for a service */
async function loadManifest(serviceId: string): Promise<Record<string, unknown> | null> {
  const bundled = getServiceArtefact(serviceId, "manifest");
  if (bundled) return bundled;
  const slug = serviceDirSlug(serviceId);
  for (const base of [
    path.join(process.cwd(), "..", "..", "data", "services"),
    path.join(process.cwd(), "data", "services"),
  ]) {
    try {
      const raw = await fs.readFile(path.join(base, slug, "manifest.json"), "utf-8");
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  return null;
}

/** Generate a scenario prompt from a manifest — used as fallback when no scenario-{name}.txt exists */
function generateScenarioPrompt(manifest: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`SERVICE: ${manifest.name}`);
  lines.push(`DEPARTMENT: ${manifest.department}`);
  lines.push(`DESCRIPTION: ${manifest.description}`);

  const constraints = manifest.constraints as Record<string, unknown> | undefined;
  if (constraints) {
    if (constraints.sla) lines.push(`SLA: ${constraints.sla}`);
    if (constraints.fee) {
      const fee = constraints.fee as Record<string, unknown>;
      lines.push(`FEE: ${fee.amount} ${fee.currency}`);
    }
    if (constraints.availability) lines.push(`AVAILABILITY: ${constraints.availability}`);
  }

  const redress = manifest.redress as Record<string, unknown> | undefined;
  if (redress) {
    if (redress.complaint_url) lines.push(`COMPLAINTS: ${redress.complaint_url}`);
    if (redress.appeal_process) lines.push(`APPEALS: ${redress.appeal_process}`);
    if (redress.ombudsman) lines.push(`OMBUDSMAN: ${redress.ombudsman}`);
  }

  const handoff = manifest.handoff as Record<string, unknown> | undefined;
  if (handoff) {
    if (handoff.escalation_phone) lines.push(`PHONE: ${handoff.escalation_phone}`);
    if (handoff.opening_hours) lines.push(`HOURS: ${handoff.opening_hours}`);
  }

  const inputSchema = manifest.input_schema as Record<string, unknown> | undefined;
  if (inputSchema?.properties) {
    const props = Object.keys(inputSchema.properties as Record<string, unknown>);
    lines.push(`INPUTS REQUIRED: ${props.join(", ")}`);
  }

  lines.push("");
  lines.push("You are helping a citizen with this government service.");
  lines.push("Use the service details above to answer their questions accurately.");
  lines.push("If the service has eligibility criteria or policy rules, apply them to the citizen's situation.");
  lines.push("If you don't have enough information to determine eligibility, ask the citizen for the missing details.");

  return lines.join("\n");
}

/** Load a state model for a service */
async function loadStateModel(serviceId: string): Promise<StateModelDefinition | null> {
  const bundled = getServiceArtefact(serviceId, "stateModel");
  if (bundled) return bundled as unknown as StateModelDefinition;
  const slug = serviceDirSlug(serviceId);
  for (const base of [
    path.join(process.cwd(), "..", "..", "data", "services"),
    path.join(process.cwd(), "data", "services"),
  ]) {
    try {
      const raw = await fs.readFile(path.join(base, slug, "state-model.json"), "utf-8");
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  return null;
}

/** Load consent model for a service */
async function loadConsentModel(serviceId: string): Promise<Record<string, unknown> | null> {
  const bundled = getServiceArtefact(serviceId, "consent");
  if (bundled) return bundled;
  const slug = serviceDirSlug(serviceId);
  for (const base of [
    path.join(process.cwd(), "..", "..", "data", "services"),
    path.join(process.cwd(), "data", "services"),
  ]) {
    try {
      const raw = await fs.readFile(path.join(base, slug, "consent.json"), "utf-8");
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  return null;
}

/** Per-state instructions for the UC journey.
 *
 * DESIGN RULES:
 *  - Each state does ONE thing, then emits ONE transition (or waits for user input).
 *  - The LLM must NEVER claim an action has happened that requires a later state
 *    (e.g. "your claim is submitted" while still at consent-given).
 *  - The LLM must NEVER fabricate payment amounts, dates, or reference numbers.
 *  - States that collect structured data (housing, bank) must NOT include tasks in the JSON block —
 *    the server injects them deterministically.
 */
const UC_STATE_INSTRUCTIONS: Record<string, string> = {
  "not-started": `The citizen has just started. They are already authenticated via GOV.UK One Login — identity verification is complete.
Welcome them and explain briefly what Universal Credit is.
The system will automatically check their eligibility — present the eligibility results in this same response.
Use the POLICY EVALUATION section above to explain whether they are eligible and why.
If eligible, explain that you need their consent to share certain data with DWP before proceeding.
Interactive consent cards will appear automatically below your message for the citizen to review.
Set "stateTransition" to "check-eligibility" in the JSON block.
Do NOT skip ahead — do not mention housing, bank details, or submission yet.
Do NOT include any tasks in the JSON block — the eligibility check is automatic, not a task.`,

  "identity-verified": `Identity has been verified. Check eligibility and present the results.
Use the POLICY EVALUATION section above. If eligible, explain consent is needed next.
Set "stateTransition" to "check-eligibility" in the JSON block.
Do NOT include any tasks in the JSON block.
Do NOT discuss any later steps yet.`,

  "eligibility-checked": `Eligibility has already been checked and results were presented.
The citizen is now reviewing consent cards that appeared below your previous message.
If the citizen's message contains consent decisions (granted/denied), acknowledge them, thank the citizen, and then present their personal details for confirmation (name, DOB, NI number, address). Ask "Does everything look correct?"
Set "stateTransition" to "grant-consent" in the JSON block so the system records consent.
If the citizen asks a question, answer it — but remind them to review the consent cards below. Do NOT set a transition.
Do NOT re-explain eligibility — it's already done.
Do NOT discuss housing, bank details, income, or any later steps yet.
Do NOT include any tasks in the JSON block.`,

  "consent-given": `Consent has been granted and personal details have been confirmed from records.
Thank the citizen for granting consent. Confirm you have their personal details on file (name, DOB, NI number, address — list them briefly).
Explain that a housing details form will appear below for them to fill in.
Do NOT include any tasks in the JSON block — the system provides the housing card automatically.
Do NOT discuss bank details, income, or submission yet.`,

  "personal-details-collected": `Personal details are confirmed.
Now explain that you need their housing details to calculate any housing support.
An interactive card will appear below for them to fill in their housing situation — tell them to use it.
Do NOT include any tasks in the JSON block — the system provides the card automatically.
If the user's message already contains housing details (e.g. "I am a private renter and pay £400"), acknowledge the housing data, then confirm the employment data on file (status, previous employer, end date) is correct, and mention that a bank account card will appear next.
Set "stateTransition" to "collect-housing-details" in the JSON block.
Otherwise, briefly explain what's needed and STOP. Do not transition until their housing data arrives.
Do NOT discuss submission yet.`,

  "housing-details-collected": `Housing details have been collected.
The system has automatically confirmed the employment and income data on file.
An interactive bank account card will appear for the citizen to select a payment account.
Briefly acknowledge the housing data, confirm the employment details on record (status, employer, end date), and tell them to choose their bank account using the card below.
Do NOT include any tasks in the JSON block — the system provides the bank card automatically.
Do NOT discuss submission or payment amounts yet.`,

  "income-details-collected": `Income and employment details confirmed.
Now explain you need a bank account for UC payments.
An interactive card will appear for them to select a saved account or enter a new one.
Do NOT include any tasks in the JSON block — the system provides the card automatically.
If the user's message already contains bank details (sort code, account number), acknowledge and set "stateTransition" to "verify-bank-details" in the JSON block.
Otherwise, briefly explain what's needed and STOP. Do not transition until bank data arrives.
Do NOT discuss submission or payment amounts yet.`,

  "bank-details-verified": `Bank details verified. Now present a COMPLETE SUMMARY of everything collected:
- Personal details (name, DOB, NI number, address)
- Housing (tenure type, rent amount)
- Employment (status, previous employer)
- Bank account (bank name, last 4 digits only — do NOT show full sort code/account number)
Ask: "Shall I submit your Universal Credit application now?"
When the citizen confirms, set "stateTransition" to "submit-claim" in the JSON block.
Do NOT fabricate any payment amounts or dates.`,

  "claim-submitted": `The claim has been submitted successfully!
Tell the citizen:
- Their claim is now with DWP for processing
- The standard assessment period is 5 weeks before the first payment
- They will receive an exact payment calculation from DWP
- They will need to attend an interview at their local Jobcentre Plus
- They should set up their UC online journal (link will be in their confirmation email)
Do NOT fabricate specific payment amounts, exact dates, or reference numbers — say "DWP will confirm these details".
Set "stateTransition" to "schedule-interview" in the JSON block.
Do NOT set any other transitions.`,

  "awaiting-interview": `An interview is being arranged. Tell the citizen:
- They will be contacted by their local Jobcentre Plus to schedule an initial interview
- What to bring: photo ID, bank statements, tenancy agreement, proof of housing costs
- What to expect: discussion of their work search plans and claimant commitment
Set "stateTransition" to "activate-claim" in the JSON block.
Do NOT set any other transitions.`,

  "claim-active": `The UC claim is now active! Congratulate them warmly.
Explain:
- DWP will confirm their exact payment amount and date by post and in their UC journal
- They must keep their UC journal updated with job search activity
- They must report any changes in circumstances immediately
This is the FINAL message of the journey — do NOT ask follow-up questions or prompt for further input.
End with a warm closing statement.
Do NOT include any tasks in the JSON block.
Do NOT fabricate payment amounts or dates.`,

  "rejected": `The application was not successful. Explain why clearly and sympathetically.
Mention:
- Mandatory reconsideration: they can ask DWP to look at the decision again within 1 month
- Appeal: they can appeal to an independent tribunal if reconsideration is unsuccessful
- DWP helpline: 0800 328 5644 (Mon-Fri 8am-6pm)
This is the FINAL message — do NOT ask follow-up questions.
Do NOT include any tasks in the JSON block.`,

  "handed-off": `This case has been referred to a human advisor for further review.
Explain why, and provide:
- DWP helpline: 0800 328 5644 (Mon-Fri 8am-6pm)
- They can also visit their local Jobcentre Plus
This is the FINAL message — do NOT ask follow-up questions.
Do NOT include any tasks in the JSON block.`,
};

/** Check if a serviceId is the Universal Credit service (UC-specific state logic applies) */
function isUcService(serviceId: string): boolean {
  return serviceId === "dwp.apply-universal-credit";
}

/** Build state-aware context for the system prompt */
function buildStateContext(
  stateModel: StateModelDefinition,
  consentModel: Record<string, unknown> | null,
  currentState: string,
  personaData: Record<string, unknown>,
  serviceId: string,
  manifest: Record<string, unknown> | null,
): string {
  const sm = new StateMachine(stateModel);
  sm.setState(currentState);

  const allowed = sm.allowedTransitions();

  // For non-UC services, build a generic state context from the state model
  if (!isUcService(serviceId)) {
    const serviceName = (manifest?.name as string) || serviceId;
    let ctx = `\n\n---\n\nSTATE MODEL JOURNEY:\n`;
    ctx += `You are guiding the citizen through the "${serviceName}" service.\n`;
    ctx += `Current state: ${currentState}\n`;
    ctx += `Is terminal: ${sm.isTerminal() ? "YES — journey complete" : "NO — journey in progress"}\n`;
    if (allowed.length > 0) {
      ctx += `Available transitions: ${allowed.map(t => `${t.trigger} → ${t.to}`).join(", ")}\n`;
    }
    ctx += `\nAll states: ${stateModel.states.map(s => `${s.id} (${s.type})`).join(", ")}\n`;

    // Consent info
    if (consentModel) {
      const grants = (consentModel.grants || []) as Array<Record<string, unknown>>;
      if (grants.length > 0) {
        ctx += `\nCONSENT REQUIREMENTS:\n`;
        for (const grant of grants) {
          ctx += `- ${grant.id}: ${grant.description} (data: ${(grant.data_shared as string[]).join(", ")})\n`;
        }
      }
    }

    ctx += `\nGuide the citizen naturally through the service states. Use the POLICY EVALUATION above (if present) to determine eligibility. If eligible, help them proceed.\n`;
    ctx += `When a state transition should happen, set "stateTransition" in the JSON block to the trigger name.\n`;
    return ctx;
  }

  // UC-specific state context
  const stateInstruction = UC_STATE_INSTRUCTIONS[currentState] || "";

  let ctx = `\n\n---\n\nSTATE MODEL JOURNEY:\n`;
  ctx += `You are guiding the citizen through a structured state-model journey for Apply for Universal Credit.\n`;
  ctx += `Current state: ${currentState}\n`;
  ctx += `Is terminal: ${sm.isTerminal() ? "YES — journey complete" : "NO — journey in progress"}\n`;

  if (allowed.length > 0) {
    ctx += `Available transitions: ${allowed.map(t => `${t.trigger} → ${t.to}`).join(", ")}\n`;
  }

  if (stateInstruction) {
    ctx += `\nINSTRUCTIONS FOR THIS STATE:\n${stateInstruction}\n`;
  }

  // Data availability analysis
  const contact = personaData.primaryContact as Record<string, unknown> | undefined;
  const financials = personaData.financials as Record<string, unknown> | undefined;
  const employment = personaData.employment as Record<string, unknown> | undefined;
  const address = personaData.address as Record<string, unknown> | undefined;

  ctx += `\nDATA AVAILABILITY:\n`;
  ctx += `- Name: ${contact?.firstName ? "AVAILABLE" : "NEED TO ASK"}\n`;
  ctx += `- DOB: ${contact?.dateOfBirth ? "AVAILABLE" : "NEED TO ASK"}\n`;
  ctx += `- NI Number: ${contact?.nationalInsuranceNumber ? "AVAILABLE" : "NEED TO ASK"}\n`;
  ctx += `- Address: ${address?.postcode ? "AVAILABLE" : "NEED TO ASK"}\n`;
  ctx += `- Employment: ${employment ? "AVAILABLE" : "NEED TO ASK"}\n`;
  ctx += `- Income: ${financials ? "PARTIALLY AVAILABLE" : "NEED TO ASK"}\n`;
  ctx += `- Housing tenure: ${address?.housingStatus ? "AVAILABLE" : "NEED TO ASK"}\n`;
  const bankAccounts = (financials?.bankAccounts as Array<Record<string, unknown>>) || [];
  ctx += `- Bank accounts: ${bankAccounts.length > 0 ? `${bankAccounts.length} ON FILE — citizen selects which one (or enters a different one)` : "NOT AVAILABLE — MUST ASK CITIZEN"}\n`;

  // Consent grants needed
  if (consentModel) {
    const grants = (consentModel.grants || []) as Array<Record<string, unknown>>;
    if (grants.length > 0) {
      ctx += `\nCONSENT REQUIREMENTS:\n`;
      for (const grant of grants) {
        ctx += `- ${grant.id}: ${grant.description} (data: ${(grant.data_shared as string[]).join(", ")})\n`;
      }
    }
  }

  ctx += `\nSTATE TRANSITIONS:\n`;
  ctx += `When you determine a state transition should happen, set the "stateTransition" field in the JSON block to the trigger name.\n`;
  ctx += `For example: "stateTransition": "verify-identity"\n`;
  ctx += `IMPORTANT: Only set ONE state transition per response. Do NOT skip ahead or combine steps.\n`;
  ctx += `IMPORTANT: For states that collect data (housing, bank details, income), do NOT set a transition until the user has actually provided the information in a message. Ask for the data and STOP — wait for their reply.\n`;

  return ctx;
}

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
      return JSON.stringify({
        warnings: [],
        summary: "No active flood warnings anywhere in England.",
      });
    }

    const cityLower = (city || "").toLowerCase();
    const localWarnings = items.filter((item) => {
      const floodArea = item.floodArea as Record<string, string> | undefined;
      const county = (floodArea?.county || "").toLowerCase();
      const area = ((item.eaAreaName as string) || "").toLowerCase();
      const desc = ((item.description as string) || "").toLowerCase();
      return (
        county.includes(cityLower) ||
        area.includes(cityLower) ||
        desc.includes(cityLower)
      );
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
      summary:
        summary.length > 0
          ? `${summary.length} active flood warning(s) near ${city}.`
          : `No active flood warnings near ${city}. There are ${items.length} warnings elsewhere in England.`,
    });
  } catch (error) {
    console.error("Flood data lookup failed:", error);
    return JSON.stringify({ error: "Flood data temporarily unavailable." });
  }
}

// ── Register the chat handler on the invoker ──

interface ChatInput {
  persona: string;
  agent: string;
  scenario: string;
  messages: Array<{ role: string; content: unknown }>;
  generateTitle?: boolean;
  ucState?: string;
  ucStateHistory?: string[];
  serviceMode?: "json" | "mcp";
}

interface ChatOutput {
  response: string;
  reasoning: string;
  toolsUsed: string[];
  conversationTitle: string | null;
  tasks: Array<{
    id: string;
    description: string;
    detail: string;
    type: string;
    dueDate: string | null;
    dataNeeded: string[];
  }>;
  policyResult?: {
    eligible: boolean;
    explanation: string;
    passedCount: number;
    failedCount: number;
    edgeCaseCount: number;
  };
  handoff?: {
    triggered: boolean;
    reason?: string;
    description?: string;
    urgency?: string;
    routing?: Record<string, unknown>;
  };
  ucState?: {
    currentState: string;
    previousState?: string;
    trigger?: string;
    allowedTransitions: string[];
    stateHistory: string[];
  };
  consentRequests?: Array<{
    id: string;
    description: string;
    data_shared: string[];
    source: string;
    purpose: string;
  }>;
}

async function chatHandler(input: unknown): Promise<ChatOutput> {
  const { persona, agent, scenario, messages, generateTitle, ucState: clientUcState, ucStateHistory: clientStateHistory, serviceMode } = input as ChatInput;

  const isMcpMode = serviceMode === "mcp";

  await ensureMcpConnection();
  if (isMcpMode) {
    await ensureLocalMcpConnection();
  }

  console.log(`\n--- Chat Request ---`);
  console.log(`Persona: ${persona}, Agent: ${agent}, Scenario: ${scenario}`);
  console.log(`Messages: ${messages.length} in history`);

  // Load data and prompts
  const personaData = await loadPersonaData(persona);
  const agentPrompt = await loadFile(`data/prompts/${agent}-system.txt`);
  const personaPrompt = await loadFile(`data/prompts/persona-${persona}.txt`);
  // Load scenario prompt — try file first, fall back to generating from manifest
  let scenarioPrompt: string;
  try {
    scenarioPrompt = await loadFile(`data/prompts/scenario-${scenario}.txt`);
  } catch {
    // No scenario file — generate prompt from manifest for dynamic/new services
    const serviceId = resolveServiceId(scenario);
    const manifest = await loadManifest(serviceId);
    scenarioPrompt = manifest
      ? generateScenarioPrompt(manifest)
      : `You are helping a citizen with a government service related to: ${scenario}. Answer their questions helpfully.`;
  }

  const userPostcode = personaData.address?.postcode || "";
  const govmcpTools = mcpClient.getToolsForClaude();

  // In MCP mode, combine local service tools + govmcp tools
  // In JSON mode, only use govmcp tools (service logic handled inline)
  let allTools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  if (isMcpMode) {
    const localTools = localMcpClient.getLocalToolsForClaude();
    allTools = [...localTools, ...govmcpTools];
    console.log(`   MCP mode: ${localTools.length} local + ${govmcpTools.length} govmcp = ${allTools.length} tools`);
  } else {
    allTools = govmcpTools;
  }
  const hasTools = allTools.length > 0;

  // ── Policy Evaluation (JSON mode only — MCP mode delegates to tools) ──
  const serviceId = resolveServiceId(scenario);
  let policyResultInfo: ChatOutput["policyResult"] | undefined;
  let policyContext = "";

  if (!isMcpMode && serviceId) {
    const ruleset = await loadPolicyRuleset(serviceId);
    if (ruleset) {
      const context = buildPolicyContext(personaData);
      const result = policyEvaluator.evaluate(ruleset, context);

      policyResultInfo = {
        eligible: result.eligible,
        explanation: result.explanation,
        passedCount: result.passed.length,
        failedCount: result.failed.length,
        edgeCaseCount: result.edgeCases.length,
      };

      // Build policy context for the system prompt
      const passedRules = result.passed.map((r) => `  - ${r.description}`).join("\n");
      const failedRules = result.failed.map((r) => `  - ${r.description}: ${r.reason_if_failed}`).join("\n");
      const edgeCases = result.edgeCases.map((e) => `  - ${e.description}: ${e.action}`).join("\n");

      policyContext = `\n\n---\n\nPOLICY EVALUATION (${serviceId}):\nEligibility: ${result.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}\n${result.explanation}\n`;
      if (passedRules) policyContext += `\nRules passed:\n${passedRules}\n`;
      if (failedRules) policyContext += `\nRules failed:\n${failedRules}\n`;
      if (edgeCases) policyContext += `\nEdge cases detected:\n${edgeCases}\nIMPORTANT: Mention relevant edge cases to the user and explain any implications.\n`;

      console.log(`   Policy: ${result.eligible ? "eligible" : "not eligible"} (${result.passed.length} passed, ${result.failed.length} failed, ${result.edgeCases.length} edge cases)`);
    }
  }

  // Build system prompt
  let systemPrompt = `${agentPrompt}\n\n---\n\n${personaPrompt}\n\n---\n\n${scenarioPrompt}\n\n---\n\nPERSONA DATA AVAILABLE:\nYou have access to the following data about the user. Use this according to your agent personality (DOT asks permission, MAX auto-fills).\n\n${JSON.stringify(personaData, null, 2)}`;

  // Add policy context
  if (policyContext) {
    systemPrompt += policyContext;
  }

  // Personal data extraction prompt
  systemPrompt += `\n\n---\n\nPERSONAL DATA EXTRACTION:
When the user reveals personal facts in conversation, include an "extractedFacts" array in your JSON block.
Rules:
- Only extract NEW facts not already known from persona data
- Max 5 facts per response
- Use snake_case keys (e.g. "number_of_children", "lives_in", "marital_status")
- Confidence levels: "high" (user stated directly), "medium" (strongly implied), "low" (loosely inferred)
- Include a short source_snippet from their message

Example:
"extractedFacts": [
  { "key": "number_of_daughters", "value": 2, "confidence": "high", "source_snippet": "I have 2 daughters" }
]`;


  // ── State Model Journey (JSON mode: inline, MCP mode: via tools) ──
  let stateMachine: StateMachine | null = null;
  let consentModel: Record<string, unknown> | null = null;
  // For UC, default to "not-started"; for other services, use the initial state from the state model
  const isUc = isUcService(serviceId);
  const currentUcState = clientUcState || (isUc ? "not-started" : undefined);

  if (!isMcpMode && serviceId) {
    const stateModelDef = await loadStateModel(serviceId);
    consentModel = await loadConsentModel(serviceId);
    const manifest = await loadManifest(serviceId);

    if (stateModelDef) {
      stateMachine = new StateMachine(stateModelDef);
      // For UC, restore client state; for other services, start at initial state from model
      if (currentUcState) {
        stateMachine.setState(currentUcState);
      }

      // Register total states so the case store can calculate progress %
      (await getTraceEmitter()).setTotalStates(serviceId, stateModelDef.states.length);

      const stateContext = buildStateContext(stateModelDef, consentModel, stateMachine.getState(), personaData, serviceId, manifest);
      systemPrompt += stateContext;

      console.log(`   State: ${stateMachine.getState()}, Allowed: ${stateMachine.allowedTransitions().map(t => t.trigger).join(", ")}`);
    }
  }

  if (hasTools) {
    if (isMcpMode) {
      // MCP mode: load service context from MCP resources + prompts
      let mcpServiceContext = "";
      try {
        const manifestJson = await localMcpClient.readLocalResource(`service://${serviceId}/manifest`);
        const policyJson = await localMcpClient.readLocalResource(`service://${serviceId}/policy`);
        const consentJson = await localMcpClient.readLocalResource(`service://${serviceId}/consent`);
        const stateModelJson = await localMcpClient.readLocalResource(`service://${serviceId}/state-model`);

        if (manifestJson) mcpServiceContext += `\nSERVICE MANIFEST:\n${manifestJson}\n`;
        if (policyJson) mcpServiceContext += `\nPOLICY RULES:\n${policyJson}\n`;
        if (consentJson) mcpServiceContext += `\nCONSENT MODEL:\n${consentJson}\n`;
        if (stateModelJson) mcpServiceContext += `\nSTATE MODEL:\n${stateModelJson}\n`;
      } catch (err) {
        console.warn("Failed to read MCP resources:", err instanceof Error ? err.message : err);
      }

      // Try to use journey prompt template from MCP server
      const slug = serviceId.split(".").slice(1).join(".").replace(/-/g, "_");
      try {
        const journeyPrompt = await localMcpClient.getLocalPrompt(`${slug}_journey`);
        if (journeyPrompt?.messages?.[0]?.content?.text) {
          mcpServiceContext += `\nJOURNEY GUIDE:\n${journeyPrompt.messages[0].content.text}\n`;
        }
      } catch {
        // Journey prompt not available — continue without it
      }

      systemPrompt += `\n\n---\n\nSERVICE CONTEXT (MCP MODE):\n${mcpServiceContext}`;

      systemPrompt += `\n\nSERVICE TOOLS (MCP MODE):\nYou have access to tools for the government service the citizen is using.\n\nFor the current service, use these tools to guide the citizen:\n- Use the _check_eligibility tool to evaluate whether the citizen qualifies (pass their data as citizen_data)\n- Use the _advance_state tool to transition to the next step (provide current_state and trigger)\n\nService metadata, requirements, and consent model are already loaded above from MCP resources.\n\nIMPORTANT: The citizen's current state is "${currentUcState || stateMachine?.getState() || "not-started"}". When using _advance_state, pass this as current_state.\nAfter advancing state, tell the citizen what happened and what comes next.\nDo NOT fabricate eligibility results, payment amounts, dates, or reference numbers — use the tools.\n\nThe citizen's data for eligibility checks:\n${JSON.stringify(buildPolicyContext(personaData), null, 2)}`;

      systemPrompt += `\n\nLIVE GOV.UK DATA TOOLS:\nYou also have access to tools for real UK government data.\nFor example:\n- search_govuk for official guidance\n- lookup_postcode for local info (citizen postcode: ${userPostcode})\n- find_mp for constituency MP\n- ea_current_floods for flood warnings\n\nPresent all information naturally. Do NOT mention "tools" or "MCP" to the user.`;
    } else {
      // JSON mode: only govmcp tool instructions
      systemPrompt += `\n\n---\n\nLIVE GOV.UK DATA TOOLS:\nYou have access to tools that can look up real, current UK government data.\nUse these when the user asks questions that benefit from real, up-to-date information.\nFor example:\n- search_govuk to find official guidance on benefits, driving, parenting, tax\n- govuk_content to fetch a specific GOV.UK page by its path\n- find_mp to look up the user's MP (their postcode is ${userPostcode})\n- lookup_postcode for local council and constituency info (their postcode is ${userPostcode})\n- ea_current_floods to check flood warnings in their area\n- get_bank_holidays for upcoming bank holidays\n- search_hansard to find what Parliament has discussed on a topic\n- find_courts to find nearby courts\n- fsa_food_alerts_search for current food safety alerts\n\nWhen you use these tools, present the information naturally as part of your response.\nDo NOT mention "tools" or "MCP" to the user — just weave the real data into your answer.\nAlways prefer real data from tools over making up or guessing information.`;
    }
  }

  systemPrompt += `\n\n---\n\nRemember: Stay in character as ${agent.toUpperCase()} agent, communicate according to the persona style, and help with the ${scenario} scenario.`;

  systemPrompt += `\n\nACCURACY GUARDRAILS — CRITICAL:
- Do NOT fabricate specific payment amounts (e.g. "£393.45/month"). Instead say "DWP will calculate and confirm your exact payment amount."
- Do NOT fabricate specific payment dates (e.g. "14th March 2026"). Instead say "Your first payment will be approximately 5 weeks after your claim date."
- Do NOT fabricate claim reference numbers. Instead say "You will receive a reference number by email/post."
- Do NOT perform benefit calculations — these are complex and depend on many factors only DWP can assess.
- You MAY mention general facts: the 5-week waiting period, the UC journal requirement, Jobcentre Plus interviews.
- When presenting data from the citizen's records, show EXACTLY what is in the data — do not embellish or assume.`;

  if (generateTitle) {
    systemPrompt += `\n\nCONVERSATION TITLE:\nSince this is the start of a new conversation, include a "title" field in the JSON block at the end of your response.\nThe title should be a short 3-8 word phrase describing the user's intent or action (e.g. "Renewing MOT for Ford Focus", "Checking flood warnings in Cambridge", "Understanding PIP eligibility").`;
  }

  systemPrompt += `\n\nACTIONABLE TASKS:\nWhen your response contains actionable next steps, include them in the "tasks" array of the JSON block.\nEach task object has these fields:\n- "description": short summary (max 60 chars)\n- "detail": one-sentence explanation (max 150 chars)\n- "type": "agent" (something you can do) or "user" (something the citizen must do)\n- "dueDate": optional, ISO date string YYYY-MM-DD (only when there is a genuine deadline)\n- "dataNeeded": optional array of persona data field names relevant to the task\n\nRules:\n- Maximum 3 tasks per response\n- Only create tasks for genuinely actionable items, not general advice`;

  systemPrompt += `\n\nSTRUCTURED OUTPUT FORMAT — CRITICAL:\nAt the END of every response, you MUST append a fenced JSON block containing structured metadata.\nThe block must be the LAST thing in your response, after all conversational text.\nFormat:\n\`\`\`json\n{\n  "title": "Short title or null",\n  "tasks": [],\n  "stateTransition": "trigger-name or null"\n}\n\`\`\`\n\nRules:\n- ALWAYS include the JSON block, even if all fields are null/empty\n- "title": set only when instructed (first message of a new conversation), otherwise null\n- "tasks": array of task objects (see ACTIONABLE TASKS above), or empty array []\n- "stateTransition": the trigger name for the current state transition, or null if none\n- The JSON block will be stripped before showing your response to the citizen`;

  // Agentic loop — ALL LLM calls go through the AnthropicAdapter
  let loopMessages = [...messages];
  let reasoning = "";
  let responseText = "";
  const toolsUsed: string[] = [];
  const MAX_ITERATIONS = 5;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`   Agentic loop iteration ${i + 1}...`);

    const adapterInput: AnthropicChatInput = {
      systemPrompt,
      messages: loopMessages,
      tools: hasTools ? (allTools as unknown as Array<Record<string, unknown>>) : undefined,
    };

    const adapterResult = await (await getLLMAdapter()).execute({
      input: adapterInput,
      context: { sessionId: "", traceId: "", userId: "" },
    });

    if (!adapterResult.success) {
      throw new Error(adapterResult.error || "LLM adapter call failed");
    }

    const llmOutput = adapterResult.output as AnthropicChatOutput;

    console.log(
      `   Response: stop_reason=${llmOutput.stopReason}, tool_calls=${llmOutput.toolCalls.length}`
    );

    if (llmOutput.stopReason === "tool_use") {
      // Extract reasoning so far
      if (llmOutput.reasoning) {
        reasoning = llmOutput.reasoning;
      }

      // Add assistant message with raw content (needed for tool_use protocol)
      loopMessages.push({ role: "assistant" as const, content: llmOutput.rawContent });

      const toolResults: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
      }> = [];

      for (const toolCall of llmOutput.toolCalls) {
        console.log(
          `   Tool call: ${toolCall.name}(${JSON.stringify(toolCall.input).slice(0, 80)})`
        );
        toolsUsed.push(toolCall.name);

        let toolResult: string | { error: string };
        if (toolCall.name === "ea_current_floods") {
          const city = personaData.address?.city || "";
          toolResult = await getLocalFloodData(city);
        } else if (isMcpMode && isLocalServiceTool(toolCall.name)) {
          toolResult = await localMcpClient.callLocalTool(toolCall.name, toolCall.input);
        } else {
          toolResult = await mcpClient.callTool(toolCall.name, toolCall.input);
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content:
            typeof toolResult === "string"
              ? toolResult
              : JSON.stringify(toolResult),
        });
      }

      loopMessages.push({ role: "user" as const, content: toolResults });
      continue;
    }

    // Final response
    responseText = llmOutput.responseText;
    reasoning = llmOutput.reasoning || reasoning;
    break;
  }

  // ── Extract structured output (title, tasks, stateTransition) from JSON block ──
  const { parsed: structuredOutput, cleanText } = extractStructuredOutput(responseText);
  responseText = cleanText;

  // Title
  let conversationTitle: string | null = null;
  if (generateTitle && structuredOutput?.title) {
    conversationTitle = structuredOutput.title;
  }

  // ── Store extracted facts (Tier 3) ──
  if (structuredOutput?.extractedFacts && structuredOutput.extractedFacts.length > 0) {
    try {
      const inferredStoreInstance = await getInferredStore();
      const sessionId = `session_${Date.now()}`;
      for (const fact of structuredOutput.extractedFacts) {
        await inferredStoreInstance.store(persona, {
          fieldKey: fact.key,
          fieldValue: fact.value,
          confidence: fact.confidence,
          source: "conversation",
          sessionId,
          extractedFrom: fact.source_snippet,
        });
      }
      console.log(`   Extracted ${structuredOutput.extractedFacts.length} personal fact(s)`);
    } catch (err) {
      console.warn("Failed to store extracted facts:", err);
    }
  }

  // Tasks — from structured output
  const tasks: Array<{
    id: string;
    description: string;
    detail: string;
    type: string;
    dueDate: string | null;
    dataNeeded: string[];
  }> = (structuredOutput?.tasks || []).map((t, i) => ({
    id: `task_${Date.now()}_${i}`,
    description: t.description,
    detail: t.detail,
    type: t.type,
    dueDate: t.dueDate || null,
    dataNeeded: t.dataNeeded || [],
  }));

  // ── State Transition Parsing ──
  const stateTransitions: Array<{ fromState: string; toState: string; trigger: string }> = [];
  let ucStateInfo: ChatOutput["ucState"] | undefined;

  // In MCP mode, extract state transitions from tool call results
  if (isMcpMode) {
    // Parse state transitions from _advance_state tool results
    for (const toolName of toolsUsed) {
      if (toolName.endsWith("_advance_state")) {
        // The tool result was already fed back to Claude; we can also parse from
        // the loopMessages to extract the actual state transition data
        // Look for tool_result messages that contain advance_state results
        for (const msg of loopMessages) {
          if (msg.role === "user" && Array.isArray(msg.content)) {
            for (const part of msg.content as Array<Record<string, unknown>>) {
              if (part.type === "tool_result" && typeof part.content === "string") {
                try {
                  const parsed = JSON.parse(part.content);
                  if (parsed.success && parsed.fromState && parsed.toState) {
                    stateTransitions.push({
                      fromState: parsed.fromState,
                      toState: parsed.toState,
                      trigger: parsed.trigger || "unknown",
                    });
                  }
                } catch {
                  // Not JSON or not a state transition result
                }
              }
            }
          }
        }
      }
    }

    // Build ucStateInfo from MCP tool results
    const mcpCurrentState = currentUcState || "not-started";
    const latestState = stateTransitions.length > 0
      ? stateTransitions[stateTransitions.length - 1].toState
      : mcpCurrentState;

    const updatedHistory = [...(clientStateHistory || [])];
    if (!updatedHistory.includes(mcpCurrentState)) {
      updatedHistory.push(mcpCurrentState);
    }
    for (const t of stateTransitions) {
      if (!updatedHistory.includes(t.toState)) {
        updatedHistory.push(t.toState);
      }
    }

    ucStateInfo = {
      currentState: latestState,
      previousState: stateTransitions.length > 0 ? stateTransitions[0].fromState : undefined,
      trigger: stateTransitions.length > 0 ? stateTransitions[stateTransitions.length - 1].trigger : undefined,
      allowedTransitions: [], // MCP mode: agent discovers these via tools
      stateHistory: updatedHistory,
    };
  } else if (stateMachine) {
    // State transition — from structured output
    if (structuredOutput?.stateTransition) {
      const trigger = structuredOutput.stateTransition;
      const result = stateMachine.transition(trigger);
      if (result.success) {
        stateTransitions.push({
          fromState: result.fromState,
          toState: result.toState,
          trigger: result.trigger,
        });
        console.log(`   State transition: ${result.fromState} → ${result.toState} (${trigger})`);
      } else {
        console.warn(`   State transition FAILED: ${result.error}`);
      }
    }

    // ── UC-specific deterministic transition fallback ──
    // Only applies to the Universal Credit service — other services let the LLM
    // drive transitions based on generic state context.
    if (isUc) {
      // Two categories:
      //  1. FORCED transitions — states where the outcome is deterministic and
      //     does not depend on user input (eligibility check uses data we already have).
      //  2. PATTERN transitions — states where structured data arrives from task card
      //     forms. These match the user's message content.

      const FORCED_TRANSITIONS: Record<string, string> = {
        "not-started": "verify-identity",
        "identity-verified": "check-eligibility",
        "consent-given": "collect-personal-details",
        "housing-details-collected": "collect-income-details",
      };

      {
        let forcedTrigger = FORCED_TRANSITIONS[stateMachine.getState()];
        while (forcedTrigger) {
          const result = stateMachine.transition(forcedTrigger);
          if (result.success) {
            stateTransitions.push({
              fromState: result.fromState,
              toState: result.toState,
              trigger: result.trigger,
            });
            console.log(`   Forced transition (deterministic): ${result.fromState} → ${result.toState} (${forcedTrigger})`);
            forcedTrigger = FORCED_TRANSITIONS[stateMachine.getState()];
          } else {
            break;
          }
        }
      }

      if (stateTransitions.length === 0) {
        const lastUserMsg = messages.filter((m: { role: string }) => m.role === "user").pop();
        const userText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";

        const AUTO_TRANSITIONS: Record<string, { trigger: string; pattern: RegExp }> = {
          "eligibility-checked": {
            trigger: "grant-consent",
            pattern: /I have reviewed all consent|consent.*granted|granted.*consent|please proceed/i,
          },
          "consent-given": {
            trigger: "collect-personal-details",
            pattern: /everything.*correct|looks correct|details.*correct|yes.*correct|confirm|that's right|all correct/i,
          },
          "personal-details-collected": {
            trigger: "collect-housing-details",
            pattern: /housing details|private renter|council tenant|homeowner|living with family|tenure/i,
          },
          "housing-details-collected": {
            trigger: "collect-income-details",
            pattern: /yes|correct|that's right|confirm|looks good|all correct|no changes/i,
          },
          "income-details-collected": {
            trigger: "verify-bank-details",
            pattern: /sort code|account number|bank.*account|please use my/i,
          },
          "bank-details-verified": {
            trigger: "submit-claim",
            pattern: /yes|submit|go ahead|confirm|please submit/i,
          },
        };

        const currentStateKey = stateMachine.getState();
        const autoConfig = AUTO_TRANSITIONS[currentStateKey];
        if (autoConfig && autoConfig.pattern.test(userText)) {
          const result = stateMachine.transition(autoConfig.trigger);
          if (result.success) {
            stateTransitions.push({
              fromState: result.fromState,
              toState: result.toState,
              trigger: result.trigger,
            });
            console.log(`   Auto-transition (LLM fallback): ${result.fromState} → ${result.toState} (${autoConfig.trigger})`);
          }
        }
      }

      // Second pass — chain forced transitions after pattern transitions.
      {
        let forcedTrigger = FORCED_TRANSITIONS[stateMachine.getState()];
        while (forcedTrigger) {
          const result = stateMachine.transition(forcedTrigger);
          if (result.success) {
            stateTransitions.push({
              fromState: result.fromState,
              toState: result.toState,
              trigger: result.trigger,
            });
            console.log(`   Forced transition (post-pattern): ${result.fromState} → ${result.toState} (${forcedTrigger})`);
            forcedTrigger = FORCED_TRANSITIONS[stateMachine.getState()];
          } else {
            break;
          }
        }
      }
    } // end if (isUc)

    const currentStateForHistory = currentUcState || stateMachine.getState();
    const updatedHistory = [...(clientStateHistory || [])];
    if (!updatedHistory.includes(currentStateForHistory)) {
      updatedHistory.push(currentStateForHistory);
    }
    if (stateTransitions.length > 0) {
      for (const t of stateTransitions) {
        if (!updatedHistory.includes(t.toState)) {
          updatedHistory.push(t.toState);
        }
      }
    }

    ucStateInfo = {
      currentState: stateMachine.getState(),
      previousState: stateTransitions.length > 0 ? stateTransitions[0].fromState : undefined,
      trigger: stateTransitions.length > 0 ? stateTransitions[stateTransitions.length - 1].trigger : undefined,
      allowedTransitions: stateMachine.allowedTransitions().map(t => t.trigger!).filter(Boolean),
      stateHistory: updatedHistory,
    };
  }

  // ── Consent Requests ──
  // In MCP mode, consent info comes from _get_consent_model tool calls (agent-driven)
  // In JSON mode, consent cards are surfaced at specific states
  let consentRequests: ChatOutput["consentRequests"] | undefined;
  if (!isMcpMode && consentModel && stateMachine) {
    const currentStateId = stateMachine.getState();
    if (currentStateId === "eligibility-checked") {
      const grants = (consentModel.grants || []) as Array<Record<string, unknown>>;
      consentRequests = grants.map(g => ({
        id: g.id as string,
        description: g.description as string,
        data_shared: g.data_shared as string[],
        source: g.source as string,
        purpose: g.purpose as string,
      }));
    }
  }

  // ── Wire consent grants to service access records ──
  // When the state transitions through consent (eligibility-checked → consent-given),
  // create service access records for the data fields granted.
  if (stateTransitions.some(t => t.trigger === "grant-consent") && consentModel) {
    try {
      const accessStoreInstance = await getServiceAccessStore();
      const TIER1_FIELDS = new Set(["national_insurance_number", "full_name", "date_of_birth", "name", "ni_number", "nino"]);
      const grants = (consentModel.grants || []) as Array<Record<string, unknown>>;
      for (const g of grants) {
        const dataShared = (g.data_shared || []) as string[];
        for (const field of dataShared) {
          const tier = TIER1_FIELDS.has(field.toLowerCase()) ? "tier1" : "tier2";
          await accessStoreInstance.grant(persona, {
            serviceId: serviceId || scenario,
            fieldKey: field,
            dataTier: tier,
            purpose: g.purpose as string || "service access",
            consentRecordId: g.id as string,
          });
        }
      }
      console.log(`   Created ${grants.reduce((sum, g) => sum + ((g.data_shared as string[]) || []).length, 0)} service access record(s)`);
    } catch (err) {
      console.warn("Failed to create service access records:", err);
    }
  }

  // ── Deterministic Task Injection for data-collection states ──
  // ONLY inject structured-form tasks at the correct states. The LLM is told
  // not to include tasks for these states, but if it does anyway we
  // replace its tasks with our deterministic ones (correct dataNeeded fields).
  if (stateMachine) {
    const preTransitionState = currentUcState;
    const postTransitionState = stateMachine.getState();
    const HOUSING_DATA_FIELDS = new Set(["tenure_type", "housing_tenure", "housing_status", "monthly_rent", "rent", "address", "housing tenure"]);
    const BANK_DATA_FIELDS = new Set(["sort_code", "account_number", "bank_accounts", "bank_account", "bank_details", "bank accounts"]);
    // Match the same keyword patterns the TaskCard UI uses to detect form types,
    // so tasks whose description mentions "housing" don't render as housing forms.
    const HOUSING_KEYWORDS = /housing|tenure|rent|own.*home|accommodation/i;
    const BANK_KEYWORDS = /bank\s*account|payment\s*account|sort\s*code/i;
    function taskMatchesHousing(t: { dataNeeded: string[]; description: string; detail: string }) {
      return t.dataNeeded.some(d => HOUSING_DATA_FIELDS.has(d)) || HOUSING_KEYWORDS.test(`${t.description} ${t.detail}`);
    }
    function taskMatchesBank(t: { dataNeeded: string[]; description: string; detail: string }) {
      return t.dataNeeded.some(d => BANK_DATA_FIELDS.has(d)) || BANK_KEYWORDS.test(`${t.description} ${t.detail}`);
    }

    const transitioned = stateTransitions.length > 0;
    // Only inject the structured form task when we're AT the data-collection state
    // and did NOT just transition OUT of it (which means data was already submitted).
    const isHousingState = (
      (postTransitionState === "personal-details-collected") ||
      (preTransitionState === "personal-details-collected" && !transitioned)
    );
    const isBankState = (
      (postTransitionState === "income-details-collected") ||
      (preTransitionState === "income-details-collected" && !transitioned)
    );

    if (isHousingState) {
      // Remove any LLM-generated housing tasks (by dataNeeded OR description keywords)
      const filtered = tasks.filter(t => !taskMatchesHousing(t));
      tasks.length = 0;
      tasks.push(...filtered);
      // Inject the correct deterministic task
      tasks.push({
        id: `task_housing_${Date.now()}`,
        description: "Provide your housing details",
        detail: "Select your housing situation and enter your monthly rent if applicable",
        type: "user",
        dueDate: null,
        dataNeeded: ["tenure_type", "monthly_rent"],
      });
    }

    if (isBankState) {
      // Remove any LLM-generated bank tasks (by dataNeeded OR description keywords)
      const filtered = tasks.filter(t => !taskMatchesBank(t));
      tasks.length = 0;
      tasks.push(...filtered);
      // Inject the correct deterministic task
      tasks.push({
        id: `task_bank_${Date.now()}`,
        description: "Select a bank account for UC payments",
        detail: "Choose which account you'd like Universal Credit payments sent to, or enter new details",
        type: "user",
        dueDate: null,
        dataNeeded: ["sort_code", "account_number"],
      });
    }

    // For states that should NOT have housing/bank tasks, strip any the LLM generated
    if (!isHousingState && !isBankState) {
      const stripped = tasks.filter(t => !taskMatchesHousing(t) && !taskMatchesBank(t));
      tasks.length = 0;
      tasks.push(...stripped);
    }

    // Strip eligibility-related tasks — eligibility is checked automatically by the
    // server, never as a user-clickable task card.
    const ELIGIBILITY_KEYWORDS = /eligib|verify.*identity|identity.*verif|check.*uc|uc.*check/i;
    const preEligibilityStrip = tasks.filter(t => {
      const text = `${t.description} ${t.detail}`;
      return !ELIGIBILITY_KEYWORDS.test(text);
    });
    tasks.length = 0;
    tasks.push(...preEligibilityStrip);
  }

  // ── Handoff Detection ──
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  const lastUserText = typeof lastUserMessage?.content === "string" ? lastUserMessage.content : "";
  const handoffCheck = handoffManager.evaluateTriggers(lastUserText, {
    policyEdgeCase: policyResultInfo ? policyResultInfo.edgeCaseCount > 0 : false,
  });

  let handoffInfo: ChatOutput["handoff"] | undefined;
  if (handoffCheck.triggered) {
    const registry = await getRegistry();
    const serviceManifest = serviceId ? registry.lookup(serviceId) : undefined;

    const contact = personaData.primaryContact as Record<string, string>;
    const handoffPackage = handoffManager.createPackage({
      reason: handoffCheck.reason!,
      description: handoffCheck.description!,
      agentAssessment: `Agent ${agent.toUpperCase()} detected handoff trigger during ${scenario} scenario.`,
      citizen: {
        name: `${contact.firstName} ${contact.lastName}`,
        phone: contact.phone,
        email: contact.email,
      },
      service: serviceManifest,
      stepsCompleted: [`Chat conversation (${messages.length} messages)`],
      stepsBlocked: [handoffCheck.description || "Trigger detected"],
      dataCollected: Object.keys(personaData).filter((k) => k !== "communicationStyle"),
      timeSpent: `${messages.length} exchanges`,
      traceId: "",
      receiptIds: [],
    });

    handoffInfo = {
      triggered: true,
      reason: handoffCheck.reason,
      description: handoffCheck.description,
      urgency: handoffPackage.urgency,
      routing: handoffPackage.routing as unknown as Record<string, unknown>,
    };

    console.log(`   HANDOFF triggered: ${handoffCheck.reason} — ${handoffCheck.description}`);
  }

  console.log(
    `   Done. Tools: ${toolsUsed.length > 0 ? toolsUsed.join(", ") : "none"}${conversationTitle ? `, Title: "${conversationTitle}"` : ""}${tasks.length > 0 ? `, Tasks: ${tasks.length}` : ""}`
  );

  return {
    response: responseText,
    reasoning: reasoning || "No internal reasoning available for this response.",
    toolsUsed,
    conversationTitle,
    tasks,
    policyResult: policyResultInfo,
    handoff: handoffInfo,
    ucState: ucStateInfo,
    consentRequests,
  };
}

// Register the handler
invoker.registerHandler("agent.chat", chatHandler);

// ── POST /api/chat ──

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { persona, agent, scenario, messages, generateTitle, ucState, ucStateHistory, serviceMode } = body;

    if (!persona || !agent || !scenario || !messages) {
      return NextResponse.json(
        { error: "Missing required fields: persona, agent, scenario, messages" },
        { status: 400 }
      );
    }

    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const sessionId = `session_${Date.now()}`;

    // Build invocation context
    const context: InvocationContext = {
      sessionId,
      traceId,
      userId: persona,
    };

    // Emit LLM request trace event
    const emitter = await getTraceEmitter();
    const resolvedServiceId = resolveServiceId(scenario);
    const chatSpan = emitter.startSpan({
      traceId,
      sessionId,
      userId: persona,
      capabilityId: resolvedServiceId || "agent.chat",
    });
    await emitter.emit("llm.request", chatSpan, {
      persona,
      agent,
      scenario,
      messageCount: messages.length,
    });

    // Route through CapabilityInvoker — the ONLY way to call services
    const result = await invoker.invoke(
      "agent.chat",
      { persona, agent, scenario, messages, generateTitle, ucState, ucStateHistory, serviceMode },
      context
    );

    if (!result.success) {
      await emitter.emit("error.raised", chatSpan, {
        error: result.error,
        capabilityId: "agent.chat",
      });
      return NextResponse.json(
        { error: result.error || "Chat invocation failed" },
        { status: 500 }
      );
    }

    const output = result.output as ChatOutput;

    // Persist invoker trace events
    await emitter.emitBatch(result.traceEvents);

    // Emit policy evaluation trace event
    const serviceId = resolveServiceId(scenario);
    if (output.policyResult && serviceId) {
      await emitter.emit("policy.evaluated", chatSpan, {
        serviceId,
        eligible: output.policyResult.eligible,
        explanation: output.policyResult.explanation,
        rulesPassed: output.policyResult.passedCount,
        rulesFailed: output.policyResult.failedCount,
        edgeCases: output.policyResult.edgeCaseCount,
      });
    }

    // Emit consent trace events (DOT asks, MAX auto-grants)
    if (serviceId) {
      const consentType = agent === "dot" ? "requested" : "auto-granted";
      await emitter.emit("consent.granted", chatSpan, {
        serviceId,
        consentType,
        agent,
        dataCategories: ["personal-details", "financial-data"],
        purpose: `Access to data for ${serviceId}`,
      });
    }

    // Emit state transition trace events
    if (output.ucState?.previousState && output.ucState?.trigger) {
      await emitter.emit("state.transition", chatSpan, {
        serviceId,
        fromState: output.ucState.previousState,
        toState: output.ucState.currentState,
        trigger: output.ucState.trigger,
      });
    }

    // Emit handoff trace events
    if (output.handoff?.triggered) {
      await emitter.emit("handoff.initiated", chatSpan, {
        serviceId,
        reason: output.handoff.reason,
        description: output.handoff.description,
        urgency: output.handoff.urgency,
      });
    }

    // Persist receipt
    if (result.receipt) {
      const receiptGen = await getReceiptGenerator();
      await receiptGen.create({
        traceId,
        capabilityId: serviceId || "agent.chat",
        citizen: { id: persona },
        action: result.receipt.action,
        outcome: result.receipt.outcome,
        details: {
          ...result.receipt.details,
          policyEligible: output.policyResult?.eligible,
          handoffTriggered: output.handoff?.triggered || false,
        },
      });
    }

    // Emit LLM response trace event
    await emitter.emit("llm.response", chatSpan, {
      toolsUsed: output.toolsUsed,
      tasksGenerated: output.tasks.length,
      hasTitle: !!output.conversationTitle,
      responseLength: output.response.length,
      policyEvaluated: !!output.policyResult,
      handoffTriggered: output.handoff?.triggered || false,
    });

    // Return trace ID in response so client can look up evidence
    return NextResponse.json({
      ...output,
      traceId,
    });
  } catch (error) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json(
      {
        error: "Failed to get response from AI agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
