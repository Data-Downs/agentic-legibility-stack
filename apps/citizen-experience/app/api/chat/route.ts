import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import * as mcpClient from "@/lib/mcp-client";
import * as localMcpClient from "@/lib/local-mcp-client";
import {
  CapabilityInvoker,
  Orchestrator,
  JsonServiceStrategy,
  McpServiceStrategy,
} from "@als/runtime";
import type { LLMAdapter, LLMChatResult, OrchestratorOutput } from "@als/runtime";
import { AnthropicAdapter } from "@als/adapters";
import type { AnthropicChatInput, AnthropicChatOutput } from "@als/adapters";
import type { InvocationContext, PolicyRuleset, StateModelDefinition, StateInstructions } from "@als/schemas";
import { getTraceEmitter, getReceiptGenerator } from "@/lib/evidence";
import { getServiceArtefact, getPersonaData, getPersonaMapping, getPromptFile, getAnyManifest, getGraphNode } from "@/lib/service-data";
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
      let apiKey = process.env.ANTHROPIC_API_KEY;
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

/** Wrap AnthropicAdapter to satisfy the Orchestrator's LLMAdapter interface */
function wrapAsLLMAdapter(adapter: AnthropicAdapter): LLMAdapter {
  return {
    async chat(params): Promise<LLMChatResult> {
      const adapterInput: AnthropicChatInput = {
        systemPrompt: params.systemPrompt,
        messages: params.messages,
        tools: params.tools ? (params.tools as unknown as Array<Record<string, unknown>>) : undefined,
      };
      const result = await adapter.execute({
        input: adapterInput,
        context: { sessionId: "", traceId: "", userId: "" },
      });
      if (!result.success) {
        throw new Error(result.error || "LLM adapter call failed");
      }
      const output = result.output as AnthropicChatOutput;
      return {
        responseText: output.responseText,
        reasoning: output.reasoning || "",
        toolCalls: output.toolCalls,
        rawContent: output.rawContent,
        stopReason: output.stopReason,
      };
    },
  };
}

// ── Singleton CapabilityInvoker ──
const invoker = new CapabilityInvoker();

// ── Scenario → service mapping ──
const LEGACY_SCENARIO_MAP: Record<string, string> = {
  driving: "dvla.renew-driving-licence",
  benefits: "dwp.apply-universal-credit",
  parenting: "dwp.check-state-pension",
};

function resolveServiceId(scenario: string): string {
  if (LEGACY_SCENARIO_MAP[scenario]) return LEGACY_SCENARIO_MAP[scenario];
  if (scenario.includes(".")) return scenario;
  const graphNode = getGraphNode(scenario);
  if (graphNode) return graphNode.id;
  return scenario;
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

// ── Data Loading (app layer — filesystem/DB access) ──

async function loadFile(filePath: string): Promise<string> {
  const bundled = getPromptFile(filePath);
  if (bundled) return bundled;
  const fullPath = path.join(process.cwd(), filePath);
  return fs.readFile(fullPath, "utf-8");
}

async function loadPersonaData(personaId: string) {
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
  const bundled = getPersonaData(personaId);
  if (bundled) return bundled;
  const raw = await loadFile(`data/${personaId}.json`);
  return JSON.parse(raw);
}

function serviceDirSlug(serviceId: string): string {
  const parts = serviceId.split(".");
  return parts.length > 1 ? parts.slice(1).join(".") : parts[0];
}

async function loadPolicyRuleset(serviceId: string): Promise<PolicyRuleset | null> {
  const bundled = await getServiceArtefact(serviceId, "policy");
  if (bundled) return bundled as unknown as PolicyRuleset;
  const slug = serviceDirSlug(serviceId);
  for (const base of [
    path.join(process.cwd(), "..", "..", "data", "services"),
    path.join(process.cwd(), "data", "services"),
  ]) {
    try {
      const raw = await fs.readFile(path.join(base, slug, "policy.json"), "utf-8");
      return JSON.parse(raw);
    } catch { continue; }
  }
  return null;
}

async function loadStateModel(serviceId: string): Promise<StateModelDefinition | null> {
  const bundled = await getServiceArtefact(serviceId, "stateModel");
  if (bundled) return bundled as unknown as StateModelDefinition;
  const slug = serviceDirSlug(serviceId);
  for (const base of [
    path.join(process.cwd(), "..", "..", "data", "services"),
    path.join(process.cwd(), "data", "services"),
  ]) {
    try {
      const raw = await fs.readFile(path.join(base, slug, "state-model.json"), "utf-8");
      return JSON.parse(raw);
    } catch { continue; }
  }
  return null;
}

async function loadConsentModel(serviceId: string): Promise<Record<string, unknown> | null> {
  const bundled = await getServiceArtefact(serviceId, "consent");
  if (bundled) return bundled;
  const slug = serviceDirSlug(serviceId);
  for (const base of [
    path.join(process.cwd(), "..", "..", "data", "services"),
    path.join(process.cwd(), "data", "services"),
  ]) {
    try {
      const raw = await fs.readFile(path.join(base, slug, "consent.json"), "utf-8");
      return JSON.parse(raw);
    } catch { continue; }
  }
  return null;
}

async function loadStateInstructions(serviceId: string): Promise<StateInstructions | null> {
  // State instructions are a new artefact type — load from filesystem only
  // (not yet in service-store or bundled data)
  const slug = serviceDirSlug(serviceId);
  for (const base of [
    path.join(process.cwd(), "..", "..", "data", "services"),
    path.join(process.cwd(), "data", "services"),
  ]) {
    try {
      const raw = await fs.readFile(path.join(base, slug, "state-instructions.json"), "utf-8");
      return JSON.parse(raw);
    } catch { continue; }
  }
  return null;
}

async function loadManifest(serviceId: string): Promise<Record<string, unknown> | null> {
  const bundled = await getServiceArtefact(serviceId, "manifest");
  if (bundled) return bundled;
  const slug = serviceDirSlug(serviceId);
  for (const base of [
    path.join(process.cwd(), "..", "..", "data", "services"),
    path.join(process.cwd(), "data", "services"),
  ]) {
    try {
      const raw = await fs.readFile(path.join(base, slug, "manifest.json"), "utf-8");
      return JSON.parse(raw);
    } catch { continue; }
  }
  return null;
}

function generateScenarioPrompt(manifest: Record<string, unknown>, serviceId?: string): string {
  const lines: string[] = [];
  lines.push(`SERVICE: ${manifest.name}`);
  lines.push(`DEPARTMENT: ${manifest.department}`);
  lines.push(`DESCRIPTION: ${manifest.description}`);

  const graphNode = serviceId ? getGraphNode(serviceId) : null;
  if (graphNode) {
    lines.push("");
    lines.push(`GOV.UK PAGE: ${graphNode.govuk_url}`);
    lines.push(`SERVICE TYPE: ${graphNode.serviceType}`);
    if (graphNode.deadline) lines.push(`DEADLINE: ${graphNode.deadline}`);
    lines.push("");
    lines.push(`ELIGIBILITY SUMMARY: ${graphNode.eligibility.summary}`);
    if (graphNode.eligibility.means_tested) lines.push("NOTE: This service is means-tested.");
    if (graphNode.eligibility.criteria.length > 0) {
      lines.push("");
      lines.push("ELIGIBILITY CRITERIA:");
      for (const c of graphNode.eligibility.criteria) {
        lines.push(`  - [${c.factor}] ${c.description}`);
      }
    }
    if (graphNode.eligibility.keyQuestions.length > 0) {
      lines.push("");
      lines.push("KEY QUESTIONS TO ASK THE CITIZEN:");
      for (const q of graphNode.eligibility.keyQuestions) {
        lines.push(`  - ${q}`);
      }
    }
    if (graphNode.eligibility.exclusions?.length) {
      lines.push("");
      lines.push("COMMON EXCLUSIONS:");
      for (const e of graphNode.eligibility.exclusions) {
        lines.push(`  - ${e}`);
      }
    }
    if (graphNode.eligibility.evidenceRequired?.length) {
      lines.push("");
      lines.push("EVIDENCE TYPICALLY REQUIRED:");
      for (const e of graphNode.eligibility.evidenceRequired) {
        lines.push(`  - ${e}`);
      }
    }
  } else {
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
  }

  lines.push("");
  lines.push("You are helping a citizen with this government service.");
  lines.push("Use the service details above to answer their questions accurately.");
  lines.push("If the service has eligibility criteria or policy rules, apply them to the citizen's situation.");
  lines.push("If you don't have enough information to determine eligibility, ask the citizen for the missing details.");

  return lines.join("\n");
}

function extractEmploymentStatus(employment: Record<string, unknown> | undefined): string {
  if (!employment) return "unknown";
  if (typeof employment.status === "string") return employment.status;
  for (const val of Object.values(employment)) {
    if (typeof val === "object" && val !== null && "status" in (val as Record<string, unknown>)) {
      return (val as Record<string, unknown>).status as string;
    }
  }
  return "unknown";
}

function buildPolicyContext(personaData: Record<string, unknown>): Record<string, unknown> {
  const contact = personaData.primaryContact as Record<string, unknown> | undefined;
  const dob = (contact?.dateOfBirth as string) || (personaData.date_of_birth as string) || undefined;
  const address = personaData.address as Record<string, unknown> | undefined;

  let age = (personaData.age as number) || 0;
  if (!age && dob) {
    const birthDate = new Date(dob);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  }

  const financials = personaData.financials as Record<string, unknown> | undefined;
  let savings = (personaData.savings as number) || 0;
  if (!savings && financials?.savingsAccount) {
    savings = (financials.savingsAccount as Record<string, unknown>)?.balance as number || 0;
  }

  const employment = personaData.employment as Record<string, unknown> | undefined;
  const empStatus = (personaData.employment_status as string) || extractEmploymentStatus(employment);
  const niNumber = (personaData.national_insurance_number as string) || (contact?.nationalInsuranceNumber as string) || undefined;

  const healthInfo = personaData.healthInfo as Record<string, unknown> | undefined;
  const conditions = (healthInfo?.conditions || []) as Array<Record<string, unknown>>;
  const hasMobilityCondition = conditions.some((c) => {
    const name = ((c.name as string) || "").toLowerCase();
    const affects = ((c.affectsMobility as string) || (c.affects_mobility as string) || "").toLowerCase();
    return affects === "yes" || affects === "true" || name.includes("mobility") || name.includes("arthritis") || name.includes("wheelchair");
  });

  return {
    age,
    jurisdiction: (personaData.jurisdiction as string) || "England",
    national_insurance_number: niNumber,
    driving_licence_number: personaData.vehicles ? "exists" : (personaData.credentials ? "exists" : undefined),
    savings,
    bank_account: personaData.bank_account ?? true,
    self_employed: empStatus === "Self-employed" || empStatus === "self-employed",
    employment_status: empStatus,
    over_70: (personaData.over_70 as boolean) ?? age >= 70,
    no_fixed_address: !address,
    licence_status: "valid",
    has_mobility_condition: hasMobilityCondition,
    has_health_conditions: conditions.length > 0,
    ...personaData,
  };
}

async function getLocalFloodData(city: string): Promise<string> {
  try {
    const raw = await mcpClient.callTool("ea_current_floods", { severity: 3, limit: 100 });
    let data: Record<string, unknown>;
    try {
      data = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
    } catch {
      return JSON.stringify({ warnings: [], summary: "No flood data available." });
    }
    const result = data?.result as Record<string, unknown> | undefined;
    const items = ((result?.items || data?.items) as Array<Record<string, unknown>>) || [];
    if (items.length === 0) {
      return JSON.stringify({ warnings: [], summary: "No active flood warnings anywhere in England." });
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
  } catch (error) {
    console.error("Flood data lookup failed:", error);
    return JSON.stringify({ error: "Flood data temporarily unavailable." });
  }
}

// ── Chat Handler — delegates to Orchestrator ──

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

type ChatOutput = OrchestratorOutput;

async function chatHandler(input: unknown): Promise<ChatOutput> {
  const { persona, agent, scenario, messages, generateTitle, ucState: clientUcState, ucStateHistory: clientStateHistory, serviceMode } = input as ChatInput;

  const isMcpMode = serviceMode === "mcp";

  await ensureMcpConnection();
  if (isMcpMode) {
    await ensureLocalMcpConnection();
  }

  console.log(`\n--- Chat Request ---`);
  console.log(`Persona: ${persona}, Agent: ${agent}, Scenario: ${scenario}, Mode: ${isMcpMode ? "MCP" : "JSON"}`);
  console.log(`Messages: ${messages.length} in history`);

  // ── Load data ──
  const personaData = await loadPersonaData(persona);
  const agentPrompt = await loadFile(`data/prompts/${agent}-system.txt`);

  const personaPromptId = getPersonaMapping(persona);
  let personaPrompt: string;
  try {
    personaPrompt = await loadFile(`data/prompts/persona-${personaPromptId}.txt`);
  } catch {
    const personaData2 = getPersonaData(persona);
    const name = (personaData2?.name as string) || persona;
    personaPrompt = `You are communicating with ${name}. Be helpful, clear, and respectful.`;
  }

  const serviceId = resolveServiceId(scenario);

  let scenarioPrompt: string;
  try {
    scenarioPrompt = await loadFile(`data/prompts/scenario-${scenario}.txt`);
  } catch {
    const manifest = await loadManifest(serviceId);
    if (manifest) {
      scenarioPrompt = generateScenarioPrompt(manifest, serviceId);
    } else {
      const graphManifest = await getAnyManifest(serviceId);
      scenarioPrompt = graphManifest
        ? generateScenarioPrompt(graphManifest as unknown as Record<string, unknown>, serviceId)
        : `You are helping a citizen with a government service related to: ${scenario}. Answer their questions helpfully.`;
    }
  }

  // ── Load service artefacts ──
  const policyRuleset = isMcpMode ? null : await loadPolicyRuleset(serviceId);
  const stateModelDef = isMcpMode ? null : await loadStateModel(serviceId);
  const consentModelRaw = isMcpMode ? null : await loadConsentModel(serviceId);
  const stateInstructions = isMcpMode ? null : await loadStateInstructions(serviceId);
  const manifest = await loadManifest(serviceId);

  const currentState = clientUcState || "not-started";

  if (stateModelDef) {
    (await getTraceEmitter()).setTotalStates(serviceId, stateModelDef.states.length);
  }

  // ── Known facts for dedup ──
  let factsAlreadyKnown = "";
  let unresolvedContradictions = "";
  try {
    const inferredStoreForPrompt = await getInferredStore();
    const allFacts = await inferredStoreForPrompt.getAll(persona);
    const activeFacts = allFacts.filter(f => !f.supersededBy).slice(0, 30);
    if (activeFacts.length > 0) {
      factsAlreadyKnown = "\n\nFACTS ALREADY KNOWN (from previous chat):\n" +
        activeFacts.map(f => `- ${f.fieldKey}: ${JSON.stringify(f.fieldValue)} (confidence: ${f.confidence}, mentions: ${f.mentions})`).join("\n") +
        "\n\nIMPORTANT: Use the EXACT key names listed above when re-referencing these facts. Do NOT re-extract facts that have the same key AND the same value as above.";
    }
    const contradictions = await inferredStoreForPrompt.getContradictions(persona);
    if (contradictions.length > 0) {
      unresolvedContradictions = "\n\nUNRESOLVED CONTRADICTIONS:\n" +
        contradictions.map(c => `- "${c.old.fieldKey}": was "${JSON.stringify(c.old.fieldValue)}", now "${JSON.stringify(c.new.fieldValue)}"`).join("\n") +
        "\n\nIMPORTANT: Ask the user to clarify which value is correct for the contradictions above.";
    }
  } catch (err) {
    console.warn("Failed to load existing facts for prompt:", err);
  }

  // ── Build strategy ──
  const adapter = wrapAsLLMAdapter(await getLLMAdapter());
  const policyContext = buildPolicyContext(personaData);

  let strategy;
  if (isMcpMode) {
    const localTools = localMcpClient.getLocalToolsForClaude();
    const govmcpTools = mcpClient.getToolsForClaude();
    strategy = new McpServiceStrategy({
      localTools,
      govmcpTools,
      localToolDispatcher: async (name, toolInput) => {
        const result = await localMcpClient.callLocalTool(name, toolInput as Record<string, unknown>);
        return typeof result === "string" ? result : JSON.stringify(result);
      },
      govmcpToolDispatcher: async (name, toolInput) => {
        const result = await mcpClient.callTool(name, toolInput as Record<string, unknown>);
        return typeof result === "string" ? result : JSON.stringify(result);
      },
      mcpResourceReader: async (uri) => localMcpClient.readLocalResource(uri),
      mcpPromptReader: async (name) => localMcpClient.getLocalPrompt(name),
    });
  } else {
    const govmcpTools = mcpClient.getToolsForClaude();
    strategy = new JsonServiceStrategy({
      govmcpTools,
      toolDispatcher: async (name, toolInput) => {
        const result = await mcpClient.callTool(name, toolInput as Record<string, unknown>);
        return typeof result === "string" ? result : JSON.stringify(result);
      },
    });
  }

  // ── Run Orchestrator ──
  const orchestrator = new Orchestrator({ adapter, strategy });

  const result = await orchestrator.run({
    persona,
    agent,
    scenario,
    serviceId,
    messages,
    generateTitle,
    currentState,
    stateHistory: clientStateHistory || [],
    personaData,
    agentPrompt,
    personaPrompt,
    scenarioPrompt,
    policyRuleset: policyRuleset || undefined,
    stateModelDef: stateModelDef || undefined,
    consentModel: consentModelRaw ? {
      id: (consentModelRaw.id as string) || serviceId,
      version: (consentModelRaw.version as string) || "1.0.0",
      grants: ((consentModelRaw.grants || []) as Array<Record<string, unknown>>).map(g => ({
        id: g.id as string,
        description: g.description as string,
        data_shared: g.data_shared as string[],
        source: g.source as string,
        purpose: g.purpose as string,
        duration: (g.duration as "session" | "until-revoked") || "session",
        required: (g.required as boolean) ?? true,
      })),
    } : undefined,
    stateInstructions: stateInstructions || undefined,
    policyContext,
    factsAlreadyKnown,
    unresolvedContradictions,
    floodDataHandler: getLocalFloodData,
    artefacts: manifest ? {
      manifest: manifest as unknown as import("@als/schemas").CapabilityManifest,
    } : undefined,
  });

  // ── Store extracted facts (Tier 3) ──
  if (result.extractedFields && result.extractedFields.length > 0) {
    try {
      const inferredStoreInstance = await getInferredStore();
      const sessionId = `session_${Date.now()}`;
      for (const fact of result.extractedFields) {
        const storeResult = await inferredStoreInstance.storeOrMerge(persona, {
          fieldKey: fact.key,
          fieldValue: fact.value,
          confidence: fact.confidence,
          source: "conversation",
          sessionId,
          extractedFrom: fact.source_snippet,
        });
        console.log(`   Fact "${fact.key}": ${storeResult.outcome}${storeResult.outcome === "contradiction" ? ` (was: ${JSON.stringify(storeResult.existing?.fieldValue)}, now: ${JSON.stringify(fact.value)})` : ""}`);
      }
    } catch (err) {
      console.warn("Failed to store extracted facts:", err);
    }
  }

  // ── Wire consent grants to service access records ──
  if (result.ucState?.trigger === "grant-consent" && consentModelRaw) {
    try {
      const accessStoreInstance = await getServiceAccessStore();
      const TIER1_FIELDS = new Set(["national_insurance_number", "full_name", "date_of_birth", "name", "ni_number", "nino"]);
      const grants = (consentModelRaw.grants || []) as Array<Record<string, unknown>>;
      for (const g of grants) {
        const dataShared = (g.data_shared || []) as string[];
        for (const field of dataShared) {
          const tier = TIER1_FIELDS.has(field.toLowerCase()) ? "tier1" : "tier2";
          await accessStoreInstance.grant(persona, {
            serviceId,
            fieldKey: field,
            dataTier: tier,
            purpose: g.purpose as string || "service access",
            consentRecordId: g.id as string,
          });
        }
      }
    } catch (err) {
      console.warn("Failed to create service access records:", err);
    }
  }

  console.log(
    `   Done. Tools: ${result.toolsUsed.length > 0 ? result.toolsUsed.join(", ") : "none"}${result.conversationTitle ? `, Title: "${result.conversationTitle}"` : ""}${result.tasks.length > 0 ? `, Tasks: ${result.tasks.length}` : ""}`
  );

  return result;
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

    const context: InvocationContext = {
      sessionId,
      traceId,
      userId: persona,
    };

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

    await emitter.emitBatch(result.traceEvents);

    const serviceId = resolveServiceId(scenario);
    if (output.policyResult && serviceId) {
      await emitter.emit("policy.evaluated", chatSpan, {
        serviceId,
        eligible: output.policyResult.eligible,
        explanation: output.policyResult.explanation,
        rulesPassed: output.policyResult.passedCount,
        rulesFailed: output.policyResult.failedCount,
        edgeCases: output.policyResult.edgeCaseCount,
        ...(output.versionMetadata || {}),
      });
    }

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

    if (output.ucState?.previousState && output.ucState?.trigger) {
      await emitter.emit("state.transition", chatSpan, {
        serviceId,
        fromState: output.ucState.previousState,
        toState: output.ucState.currentState,
        trigger: output.ucState.trigger,
      });
    }

    if (output.handoff?.triggered) {
      await emitter.emit("handoff.initiated", chatSpan, {
        serviceId,
        reason: output.handoff.reason,
        description: output.handoff.description,
        urgency: output.handoff.urgency,
      });
    }

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

    await emitter.emit("llm.response", chatSpan, {
      toolsUsed: output.toolsUsed,
      tasksGenerated: output.tasks.length,
      hasTitle: !!output.conversationTitle,
      responseLength: output.response.length,
      policyEvaluated: !!output.policyResult,
      handoffTriggered: output.handoff?.triggered || false,
      ...(output.versionMetadata || {}),
    });

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
