import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import * as mcpClient from "@/lib/mcp-client";
import { CapabilityInvoker, HandoffManager } from "@als/runtime";
import { AnthropicAdapter } from "@als/adapters";
import type { AnthropicChatInput, AnthropicChatOutput } from "@als/adapters";
import type { InvocationContext, PolicyRuleset, StateModelDefinition } from "@als/schemas";
import { PolicyEvaluator, StateMachine } from "@als/legibility";
import { getTraceEmitter, getReceiptGenerator } from "@/lib/evidence";
import { getRegistry } from "@/lib/registry";

// ── AnthropicAdapter — the ONLY Anthropic SDK usage ──
const llmAdapter = new AnthropicAdapter();
llmAdapter.initialize({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("⚠️  ANTHROPIC_API_KEY is not set — chat will fail. Create apps/citizen-experience/.env.local with your key.");
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

async function loadFile(filePath: string): Promise<string> {
  const fullPath = path.join(process.cwd(), filePath);
  return fs.readFile(fullPath, "utf-8");
}

async function loadPersonaData(personaId: string) {
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
  const slug = serviceDirSlug(serviceId);
  // Try monorepo-relative path first, then cwd-relative
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

/** Per-state instructions for the UC journey */
const UC_STATE_INSTRUCTIONS: Record<string, string> = {
  "not-started": `The citizen has just started. Explain what Universal Credit is, ask if they'd like you to check their eligibility. When ready, emit [STATE_TRANSITION: verify-identity] to begin the process.`,
  "identity-verified": `Identity has been verified using their NI number and DOB. Now check their eligibility against the policy rules. Emit [STATE_TRANSITION: check-eligibility] after explaining the eligibility check.`,
  "eligibility-checked": `Eligibility has been checked. Present the results clearly. If eligible, ask for their consent to share data with DWP. Emit [STATE_TRANSITION: grant-consent] when they agree. If not eligible, emit [STATE_TRANSITION: reject].`,
  "consent-given": `Consent has been granted. Now collect personal details. You already have their name, DOB, NI number, and address from persona data — confirm these with the citizen rather than asking again. Emit [STATE_TRANSITION: collect-personal-details] after confirming.`,
  "personal-details-collected": `Personal details confirmed. Now ask about their housing situation — do they rent or own? How much is their rent? Who is their landlord? Emit [STATE_TRANSITION: collect-housing-details] after collecting.`,
  "housing-details-collected": `Housing details collected. Now ask about their income and employment. You have some data already — confirm it and ask about any changes (e.g. upcoming maternity leave). Emit [STATE_TRANSITION: collect-income-details] after collecting.`,
  "income-details-collected": `Income details collected. Now you MUST ask for bank details — sort code and account number. This data is NOT in the persona data, so you MUST ask the citizen to provide it. Say something like "To receive UC payments, I'll need your bank details. Could you provide your sort code and account number?" Emit [STATE_TRANSITION: verify-bank-details] after they provide them.`,
  "bank-details-verified": `Bank details verified. Summarize everything collected and submit the claim. Emit [STATE_TRANSITION: submit-claim] to finalize.`,
  "claim-submitted": `The claim has been submitted. Provide a claim reference (generate a realistic one like UC-2026-XXXX). Explain: 5-week wait for first payment, they'll need to attend an interview at their local Jobcentre Plus, they should set up their UC journal. Emit [STATE_TRANSITION: schedule-interview].`,
  "awaiting-interview": `An interview has been scheduled. Explain what to expect at the Jobcentre Plus interview, what documents to bring. The journey pauses here until the interview. If the citizen seems ready, emit [STATE_TRANSITION: activate-claim].`,
  "claim-active": `The UC claim is now active! Congratulate them. Explain estimated payment amounts and dates, the UC journal, and reporting requirements. This is the end of the journey.`,
  "rejected": `The application was rejected. Explain why clearly and sympathetically. Mention the mandatory reconsideration and appeal process. Provide the DWP helpline number (0800 328 5644).`,
  "handed-off": `This case has been referred to a human advisor. Explain why and provide the DWP helpline (0800 328 5644, Mon-Fri 8am-6pm).`,
};

/** Build state-aware context for the system prompt */
function buildStateContext(
  stateModel: StateModelDefinition,
  consentModel: Record<string, unknown> | null,
  currentState: string,
  personaData: Record<string, unknown>,
): string {
  const sm = new StateMachine(stateModel);
  sm.setState(currentState);

  const allowed = sm.allowedTransitions();
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
  ctx += `- Bank details: NOT AVAILABLE — MUST ASK CITIZEN\n`;

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

  ctx += `\nSTATE TRANSITION MARKERS:\n`;
  ctx += `When you determine a state transition should happen, include this marker on its own line:\n`;
  ctx += `[STATE_TRANSITION: trigger-name]\n`;
  ctx += `For example: [STATE_TRANSITION: verify-identity]\n`;
  ctx += `You can include multiple transitions in one response if several steps are completed.\n`;
  ctx += `Place transitions AFTER your conversational text but BEFORE any [TASK:] markers.\n`;
  ctx += `The transition markers will be stripped from the displayed response.\n`;

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
  const { persona, agent, scenario, messages, generateTitle, ucState: clientUcState, ucStateHistory: clientStateHistory } = input as ChatInput;

  await ensureMcpConnection();

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
  const mcpTools = mcpClient.getToolsForClaude();
  const hasTools = mcpTools.length > 0;

  // ── Policy Evaluation ──
  const serviceId = resolveServiceId(scenario);
  let policyResultInfo: ChatOutput["policyResult"] | undefined;
  let policyContext = "";

  if (serviceId) {
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

  // ── State Model Journey ──
  let stateMachine: StateMachine | null = null;
  let consentModel: Record<string, unknown> | null = null;
  const currentUcState = clientUcState || "not-started";

  if (serviceId) {
    const stateModelDef = await loadStateModel(serviceId);
    consentModel = await loadConsentModel(serviceId);

    if (stateModelDef) {
      stateMachine = new StateMachine(stateModelDef);
      stateMachine.setState(currentUcState);

      const stateContext = buildStateContext(stateModelDef, consentModel, currentUcState, personaData);
      systemPrompt += stateContext;

      console.log(`   State: ${currentUcState}, Allowed: ${stateMachine.allowedTransitions().map(t => t.trigger).join(", ")}`);
    }
  }

  if (hasTools) {
    systemPrompt += `\n\n---\n\nLIVE GOV.UK DATA TOOLS:\nYou have access to tools that can look up real, current UK government data.\nUse these when the user asks questions that benefit from real, up-to-date information.\nFor example:\n- search_govuk to find official guidance on benefits, driving, parenting, tax\n- govuk_content to fetch a specific GOV.UK page by its path\n- find_mp to look up the user's MP (their postcode is ${userPostcode})\n- lookup_postcode for local council and constituency info (their postcode is ${userPostcode})\n- ea_current_floods to check flood warnings in their area\n- get_bank_holidays for upcoming bank holidays\n- search_hansard to find what Parliament has discussed on a topic\n- find_courts to find nearby courts\n- fsa_food_alerts_search for current food safety alerts\n\nWhen you use these tools, present the information naturally as part of your response.\nDo NOT mention "tools" or "MCP" to the user — just weave the real data into your answer.\nAlways prefer real data from tools over making up or guessing information.`;
  }

  systemPrompt += `\n\n---\n\nRemember: Stay in character as ${agent.toUpperCase()} agent, communicate according to the persona style, and help with the ${scenario} scenario.`;

  if (generateTitle) {
    systemPrompt += `\n\nCONVERSATION TITLE:\nSince this is the start of a new conversation, include a short title on the VERY FIRST line of your response in this exact format:\n[TITLE: Your short 3-8 word title here]\nThe title should describe the user's intent or action (e.g. "Renewing MOT for Ford Focus", "Checking flood warnings in Cambridge", "Understanding PIP eligibility").\nAfter the title line, continue with your normal response. The title line will be stripped before showing the response.`;
  }

  systemPrompt += `\n\nACTIONABLE TASKS:\nWhen your response contains actionable next steps, mark each one using this format on its own line:\n[TASK: short description | detail: one-sentence explanation | type: agent or user | data: comma-separated list of persona data fields needed]\nOptionally add a due date: [TASK: description | detail: explanation | type: user | due: YYYY-MM-DD | data: fields needed]\n\nRules:\n- "type: agent" = something YOU can do (look up data, check eligibility, pre-fill a form)\n- "type: user" = something the USER must do themselves (bring documents, book a test, call a number)\n- "data:" lists what persona data is relevant (e.g. "vehicle registration, MOT date" or "NI number, income")\n- Only include "due" when there is a genuine deadline from the persona's data\n- Keep descriptions under 60 characters, detail under 150 characters\n- Only create tasks for genuinely actionable items, not general advice\n- Maximum 3 tasks per response\n- Place [TASK:] markers at the very end of your response, after all your conversational text`;

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
      tools: hasTools ? (mcpTools as unknown as Array<Record<string, unknown>>) : undefined,
    };

    const adapterResult = await llmAdapter.execute({
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

  // Parse title
  let conversationTitle: string | null = null;
  if (generateTitle) {
    const titleMatch = responseText.match(/^\[TITLE:\s*(.+?)\]\n?/);
    if (titleMatch) {
      conversationTitle = titleMatch[1].trim();
      responseText = responseText.replace(/^\[TITLE:\s*.+?\]\n?/, "").trim();
    }
  }

  // Parse tasks
  const tasks: Array<{
    id: string;
    description: string;
    detail: string;
    type: string;
    dueDate: string | null;
    dataNeeded: string[];
  }> = [];
  const taskRegex =
    /\[TASK:\s*(.+?)\s*\|\s*(?:detail:\s*)?(.+?)\s*\|\s*(?:type:\s*)?(agent|user)(?:\s*\|\s*(?:due:\s*)?(\d{4}-\d{2}-\d{2}))?(?:\s*\|\s*(?:data:\s*)?([^[\]]+?))?\s*\]\n?/gi;
  let taskMatch;
  while ((taskMatch = taskRegex.exec(responseText)) !== null) {
    tasks.push({
      id: `task_${Date.now()}_${tasks.length}`,
      description: taskMatch[1].trim(),
      detail: taskMatch[2].trim(),
      type: taskMatch[3].trim().toLowerCase(),
      dueDate: taskMatch[4] || null,
      dataNeeded: taskMatch[5]
        ? taskMatch[5]
            .trim()
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
    });
  }
  responseText = responseText.replace(taskRegex, "").trim();

  // ── State Transition Parsing ──
  const stateTransitions: Array<{ fromState: string; toState: string; trigger: string }> = [];
  let ucStateInfo: ChatOutput["ucState"] | undefined;

  if (stateMachine) {
    const transitionRegex = /\[STATE_TRANSITION:\s*([^\]]+)\]\n?/gi;
    let transMatch;
    while ((transMatch = transitionRegex.exec(responseText)) !== null) {
      const trigger = transMatch[1].trim();
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
    responseText = responseText.replace(transitionRegex, "").trim();

    const updatedHistory = [...(clientStateHistory || [])];
    if (!updatedHistory.includes(currentUcState)) {
      updatedHistory.push(currentUcState);
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
  let consentRequests: ChatOutput["consentRequests"] | undefined;
  if (consentModel && stateMachine) {
    const currentStateId = stateMachine.getState();
    // Surface consent requests when entering consent-related states
    if (currentStateId === "eligibility-checked" || currentStateId === "consent-given") {
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
    const { persona, agent, scenario, messages, generateTitle, ucState, ucStateHistory } = body;

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
    const emitter = getTraceEmitter();
    const resolvedServiceId = resolveServiceId(scenario);
    const chatSpan = emitter.startSpan({
      traceId,
      sessionId,
      userId: persona,
      capabilityId: resolvedServiceId || "agent.chat",
    });
    emitter.emit("llm.request", chatSpan, {
      persona,
      agent,
      scenario,
      messageCount: messages.length,
    });

    // Route through CapabilityInvoker — the ONLY way to call services
    const result = await invoker.invoke(
      "agent.chat",
      { persona, agent, scenario, messages, generateTitle, ucState, ucStateHistory },
      context
    );

    if (!result.success) {
      emitter.emit("error.raised", chatSpan, {
        error: result.error,
        capabilityId: "agent.chat",
      });
      return NextResponse.json(
        { error: result.error || "Chat invocation failed" },
        { status: 500 }
      );
    }

    const output = result.output as ChatOutput;

    // Persist invoker trace events to SQLite
    emitter.emitBatch(result.traceEvents);

    // Emit policy evaluation trace event
    const serviceId = resolveServiceId(scenario);
    if (output.policyResult && serviceId) {
      emitter.emit("policy.evaluated", chatSpan, {
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
      emitter.emit("consent.granted", chatSpan, {
        serviceId,
        consentType,
        agent,
        dataCategories: ["personal-details", "financial-data"],
        purpose: `Access to data for ${serviceId}`,
      });
    }

    // Emit state transition trace events
    if (output.ucState?.previousState && output.ucState?.trigger) {
      emitter.emit("state.transition", chatSpan, {
        serviceId,
        fromState: output.ucState.previousState,
        toState: output.ucState.currentState,
        trigger: output.ucState.trigger,
      });
    }

    // Emit handoff trace events
    if (output.handoff?.triggered) {
      emitter.emit("handoff.initiated", chatSpan, {
        serviceId,
        reason: output.handoff.reason,
        description: output.handoff.description,
        urgency: output.handoff.urgency,
      });
    }

    // Persist receipt
    if (result.receipt) {
      const receiptGen = getReceiptGenerator();
      receiptGen.create({
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
    emitter.emit("llm.response", chatSpan, {
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
