/**
 * Orchestrator — The deterministic controller for government service journeys.
 *
 * Owns the orchestration loop:
 *   1. Load artefacts → 2. Evaluate policy → 3. Manage state →
 *   4. Build prompt → 5. Call LLM → 6. Validate output →
 *   7. Apply transitions → 8. Emit version-stamped traces
 *
 * The LLM is relegated to language-only work: generating citizen-facing
 * text and proposing (not deciding) state transitions.
 *
 * Uses a pluggable ServiceStrategy so the same loop serves both
 * JSON mode (inline deterministic logic) and MCP mode (tool delegation).
 */

import type {
  PolicyRuleset,
  PolicyResult,
  StateModelDefinition,
  StateInstructions,
  ConsentModel,
  OrchestratorAction,
  FieldExtraction,
  TraceEvent,
  PipelineStep,
  PipelineTrace,
} from "@als/schemas";
import {
  PolicyEvaluator,
  StateMachine,
  FieldCollector,
} from "@als/legibility";
import type { ServiceArtefacts } from "@als/legibility";
import { HandoffManager } from "./handoff-manager";
import type { ServiceStrategy, ToolDefinition } from "./service-strategy";
import {
  ACCURACY_GUARDRAILS,
  TITLE_INSTRUCTIONS,
  TASK_INSTRUCTIONS,
  STRUCTURED_OUTPUT_INSTRUCTIONS,
  FACT_EXTRACTION_INSTRUCTIONS,
} from "./prompt-fragments";

// ── LLM Adapter Interface ──
// Defined here so @als/runtime does NOT import @als/adapters.

export interface LLMChatResult {
  responseText: string;
  reasoning: string;
  toolCalls: Array<{ id: string; name: string; input: unknown }>;
  rawContent: unknown;
  stopReason: string;
}

export interface LLMAdapter {
  chat(params: {
    systemPrompt: string;
    messages: Array<{ role: string; content: unknown }>;
    tools?: Array<ToolDefinition>;
  }): Promise<LLMChatResult>;
}

// ── Orchestrator I/O ──

export interface OrchestratorInput {
  persona: string;
  agent: string;
  scenario: string;
  serviceId: string;
  messages: Array<{ role: string; content: unknown }>;
  generateTitle?: boolean;
  currentState?: string;
  stateHistory?: string[];
  personaData: Record<string, unknown>;
  agentPrompt: string;
  personaPrompt: string;
  scenarioPrompt: string;
  artefacts?: ServiceArtefacts;
  /** Pre-loaded policy ruleset (app layer handles loading) */
  policyRuleset?: PolicyRuleset;
  /** Pre-loaded state model (app layer handles loading) */
  stateModelDef?: StateModelDefinition;
  /** Pre-loaded consent model (app layer handles loading) */
  consentModel?: ConsentModel;
  /** Pre-loaded state instructions (app layer handles loading) */
  stateInstructions?: StateInstructions;
  /** Pre-computed policy context for evaluation */
  policyContext?: Record<string, unknown>;
  /** Known facts for dedup (injected by app layer) */
  factsAlreadyKnown?: string;
  unresolvedContradictions?: string;
  /** Flood data handler (injected by app layer) */
  floodDataHandler?: (city: string) => Promise<string>;
}

export interface OrchestratorOutput {
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
    options: Array<{ value: string; label: string }>;
    fields?: ParsedTaskField[];
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
  extractedFields?: FieldExtraction[];
  /** Version metadata for trace stamping */
  versionMetadata?: {
    modelVersion?: string;
    promptHash?: string;
    rulesetVersion?: string;
    stateModelVersion?: string;
  };
  /** Pipeline trace for transparency UI */
  pipelineTrace?: PipelineTrace;
}

// ── Structured output parser ──

interface ParsedTaskField {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "currency" | "date" | "number" | "confirm" | "select";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  prefill?: string;
  required?: boolean;
}

const VALID_FIELD_TYPES = new Set(["text", "email", "tel", "currency", "date", "number", "confirm", "select"]);

interface ParsedStructuredOutput {
  title?: string;
  proposedTransition?: string;
  tasks?: Array<{
    description: string;
    detail: string;
    type: "agent" | "user";
    dueDate?: string;
    dataNeeded?: string[];
    options?: Array<{ value: string; label: string }>;
    fields?: ParsedTaskField[];
  }>;
  extractedFacts?: FieldExtraction[];
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseStructuredOutput(responseText: string): {
  parsed: ParsedStructuredOutput | null;
  cleanText: string;
} {
  const fencePattern = /```json\s*\n([\s\S]*?)```/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = fencePattern.exec(responseText)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    return { parsed: null, cleanText: responseText };
  }

  const cleanText = (
    responseText.slice(0, lastMatch.index) +
    responseText.slice(lastMatch.index + lastMatch[0].length)
  ).trim();

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(lastMatch[1]);
  } catch {
    return { parsed: null, cleanText };
  }

  const output: ParsedStructuredOutput = {};

  if (typeof raw.title === "string" && raw.title.trim().length > 0) {
    output.title = raw.title.trim();
  }

  // Accept both "stateTransition" (legacy) and "proposedTransition" (new)
  const transition = raw.proposedTransition ?? raw.stateTransition;
  if (typeof transition === "string" && transition.trim().length > 0) {
    output.proposedTransition = transition.trim();
  }

  if (Array.isArray(raw.tasks)) {
    const validated: NonNullable<ParsedStructuredOutput["tasks"]> = [];
    for (const t of raw.tasks.slice(0, 3)) {
      if (typeof t !== "object" || t === null) continue;
      const task = t as Record<string, unknown>;
      const description = typeof task.description === "string" ? task.description.trim().slice(0, 60) : "";
      const detail = typeof task.detail === "string" ? task.detail.trim().slice(0, 150) : "";
      const type = task.type === "agent" || task.type === "user" ? task.type : null;
      if (!description || !detail || !type) continue;
      const entry: NonNullable<ParsedStructuredOutput["tasks"]>[number] = { description, detail, type };
      if (typeof task.dueDate === "string" && ISO_DATE_RE.test(task.dueDate)) {
        entry.dueDate = task.dueDate;
      }
      if (Array.isArray(task.dataNeeded)) {
        entry.dataNeeded = task.dataNeeded.filter((d): d is string => typeof d === "string").map(d => d.trim()).filter(Boolean);
      }
      if (Array.isArray(task.options)) {
        const validOpts: Array<{ value: string; label: string }> = [];
        for (const opt of task.options.slice(0, 5)) {
          if (typeof opt !== "object" || opt === null) continue;
          const o = opt as Record<string, unknown>;
          const value = typeof o.value === "string" ? o.value.trim() : "";
          const label = typeof o.label === "string" ? o.label.trim() : "";
          if (value && label) validOpts.push({ value, label });
        }
        if (validOpts.length > 0) entry.options = validOpts;
      }
      if (Array.isArray(task.fields)) {
        const validFields: ParsedTaskField[] = [];
        for (const f of task.fields.slice(0, 8)) {
          if (typeof f !== "object" || f === null) continue;
          const field = f as Record<string, unknown>;
          const key = typeof field.key === "string" ? field.key.trim() : "";
          const label = typeof field.label === "string" ? field.label.trim() : "";
          const ftype = typeof field.type === "string" ? field.type.trim() : "";
          if (!key || !label || !VALID_FIELD_TYPES.has(ftype)) continue;
          const parsed: ParsedTaskField = { key, label, type: ftype as ParsedTaskField["type"] };
          if (typeof field.placeholder === "string") parsed.placeholder = field.placeholder.trim();
          if (typeof field.prefill === "string") parsed.prefill = field.prefill.trim();
          if (typeof field.required === "boolean") parsed.required = field.required;
          if (ftype === "select" && Array.isArray(field.options)) {
            const selOpts: Array<{ value: string; label: string }> = [];
            for (const so of field.options.slice(0, 6)) {
              if (typeof so !== "object" || so === null) continue;
              const sopt = so as Record<string, unknown>;
              const sv = typeof sopt.value === "string" ? sopt.value.trim() : "";
              const sl = typeof sopt.label === "string" ? sopt.label.trim() : "";
              if (sv && sl) selOpts.push({ value: sv, label: sl });
            }
            if (selOpts.length > 0) parsed.options = selOpts;
          }
          validFields.push(parsed);
        }
        if (validFields.length > 0) entry.fields = validFields;
      }
      validated.push(entry);
    }
    if (validated.length > 0) output.tasks = validated;
  }

  if (Array.isArray(raw.extractedFacts)) {
    const validFacts: FieldExtraction[] = [];
    for (const f of raw.extractedFacts.slice(0, 5)) {
      if (typeof f !== "object" || f === null) continue;
      const fact = f as Record<string, unknown>;
      const key = typeof fact.key === "string" ? fact.key.trim() : "";
      const confidence = (fact.confidence === "high" || fact.confidence === "medium" || fact.confidence === "low") ? fact.confidence : "medium";
      const sourceSnippet = typeof fact.source_snippet === "string" ? fact.source_snippet.trim().slice(0, 200) : "";
      if (!key || fact.value === undefined) continue;
      validFacts.push({ key, value: fact.value, confidence, source_snippet: sourceSnippet });
    }
    if (validFacts.length > 0) output.extractedFacts = validFacts;
  }

  return { parsed: output, cleanText };
}

// ── Prompt hash utility ──

function hashPrompt(prompt: string): string {
  // Simple hash for prompt versioning — Node.js crypto used at runtime
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// ── Deterministic task injection ──

const HOUSING_DATA_FIELDS = new Set(["tenure_type", "housing_tenure", "housing_status", "monthly_rent", "rent", "address", "housing tenure"]);
const BANK_DATA_FIELDS = new Set(["sort_code", "account_number", "bank_accounts", "bank_account", "bank_details", "bank accounts"]);
const HOUSING_KEYWORDS = /housing|tenure|rent|own.*home|accommodation/i;
const BANK_KEYWORDS = /bank\s*account|payment\s*account|sort\s*code/i;
const ELIGIBILITY_KEYWORDS = /eligib|verify.*identity|identity.*verif|check.*uc|uc.*check/i;

interface TaskEntry {
  id: string;
  description: string;
  detail: string;
  type: string;
  dueDate: string | null;
  dataNeeded: string[];
  options: Array<{ value: string; label: string }>;
  fields?: ParsedTaskField[];
}

function taskMatchesHousing(t: { dataNeeded: string[]; description: string; detail: string }) {
  return t.dataNeeded.some(d => HOUSING_DATA_FIELDS.has(d)) || HOUSING_KEYWORDS.test(`${t.description} ${t.detail}`);
}

function taskMatchesBank(t: { dataNeeded: string[]; description: string; detail: string }) {
  return t.dataNeeded.some(d => BANK_DATA_FIELDS.has(d)) || BANK_KEYWORDS.test(`${t.description} ${t.detail}`);
}

function injectDeterministicTasks(
  tasks: TaskEntry[],
  preTransitionState: string | undefined,
  postTransitionState: string,
  transitioned: boolean,
): TaskEntry[] {
  const result = [...tasks];

  const isHousingState = (
    (postTransitionState === "personal-details-collected") ||
    (preTransitionState === "personal-details-collected" && !transitioned)
  );
  const isBankState = (
    (postTransitionState === "income-details-collected") ||
    (preTransitionState === "income-details-collected" && !transitioned)
  );

  if (isHousingState) {
    const filtered = result.filter(t => !taskMatchesHousing(t));
    filtered.push({
      id: `task_housing_${Date.now()}`,
      description: "Provide your housing details",
      detail: "Select your housing situation and enter your monthly rent if applicable",
      type: "user",
      dueDate: null,
      dataNeeded: ["tenure_type", "monthly_rent"],
      options: [],
    });
    return stripEligibility(filtered);
  }

  if (isBankState) {
    const filtered = result.filter(t => !taskMatchesBank(t));
    filtered.push({
      id: `task_bank_${Date.now()}`,
      description: "Select a bank account for UC payments",
      detail: "Choose which account you'd like Universal Credit payments sent to, or enter new details",
      type: "user",
      dueDate: null,
      dataNeeded: ["sort_code", "account_number"],
      options: [],
    });
    return stripEligibility(filtered);
  }

  // For other states, strip housing/bank/eligibility tasks the LLM may have generated
  const stripped = result.filter(t => !taskMatchesHousing(t) && !taskMatchesBank(t));
  return stripEligibility(stripped);
}

function stripEligibility(tasks: TaskEntry[]): TaskEntry[] {
  return tasks.filter(t => !ELIGIBILITY_KEYWORDS.test(`${t.description} ${t.detail}`));
}

// ── Employment status extraction ──

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

// ── Data on file context builder ──

function buildDataOnFileContext(personaData: Record<string, unknown>): string {
  const contact = personaData.primaryContact as Record<string, unknown> | undefined;
  const financials = personaData.financials as Record<string, unknown> | undefined;
  const employment = personaData.employment as Record<string, unknown> | undefined;
  const address = personaData.address as Record<string, unknown> | undefined;

  const personaName = (personaData.name as string) || (contact?.firstName ? `${contact.firstName} ${contact.lastName}` : null);
  const personaDob = (personaData.date_of_birth as string) || (contact?.dateOfBirth as string) || null;
  const personaNI = (personaData.national_insurance_number as string) || (contact?.nationalInsuranceNumber as string) || null;
  const personaSavings = (personaData.savings as number) ?? (financials?.savingsAccount ? ((financials.savingsAccount as Record<string, unknown>).balance as number) || 0 : null);
  const personaEmployer = (personaData.employer as string) || null;
  const empStatus = (personaData.employment_status as string) || extractEmploymentStatus(employment);

  const lines: string[] = [];
  lines.push("DATA ON FILE (from citizen's records — use these values, do not make up others):");
  lines.push(`- Name: ${personaName || "NEED TO ASK"}`);
  lines.push(`- DOB: ${personaDob || "NEED TO ASK"}`);
  lines.push(`- NI Number: ${personaNI || "NEED TO ASK"}`);
  lines.push(`- Address: ${address ? [address.line_1 || address.line1, address.city, address.postcode].filter(Boolean).join(", ") : "NEED TO ASK"}`);

  let empLine = `- Employment status: ${empStatus && empStatus !== "unknown" ? empStatus : "NEED TO ASK"}`;
  if (personaEmployer) {
    empLine += ` (employer: ${personaEmployer})`;
  } else if (employment) {
    for (const val of Object.values(employment)) {
      if (typeof val === "object" && val !== null) {
        const emp = val as Record<string, unknown>;
        if (emp.previousEmployer) empLine += ` (previously: ${emp.previousEmployer}, ended: ${emp.employmentEndDate || "unknown"}, reason: ${emp.endReason || "unknown"})`;
        else if (emp.employer) empLine += ` (employer: ${emp.employer})`;
        break;
      }
    }
    if (employment.previousEmployer) empLine += ` (previously: ${employment.previousEmployer})`;
    if (employment.businessName) empLine += ` (business: ${employment.businessName})`;
  }
  lines.push(empLine);

  lines.push(`- Savings: ${personaSavings !== null ? `£${personaSavings}` : "NEED TO ASK"}`);
  lines.push(`- Housing tenure: ${(address as Record<string, unknown>)?.housingStatus || "NEED TO ASK — citizen must provide"}`);

  const bankAccounts = (financials?.bankAccounts as Array<Record<string, unknown>>) || [];
  lines.push(`- Bank accounts: ${bankAccounts.length > 0 ? bankAccounts.map(a => `${a.bank || a.label} (****${(a.accountNumber as string || "").slice(-4)})`).join(", ") : (personaData.bank_account ? "Yes (details not on file)" : "NEED TO ASK — citizen must provide")}`);

  return lines.join("\n");
}

// ── Main Orchestrator Class ──

export class Orchestrator {
  private adapter: LLMAdapter;
  private strategy: ServiceStrategy;
  private handoffManager: HandoffManager;
  private maxIterations: number;

  constructor(opts: {
    adapter: LLMAdapter;
    strategy: ServiceStrategy;
    handoffManager?: HandoffManager;
    maxIterations?: number;
  }) {
    this.adapter = opts.adapter;
    this.strategy = opts.strategy;
    this.handoffManager = opts.handoffManager || new HandoffManager();
    this.maxIterations = opts.maxIterations || 5;
  }

  async run(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const {
      persona, agent, scenario, serviceId, messages,
      generateTitle, personaData, agentPrompt, personaPrompt, scenarioPrompt,
      policyRuleset, stateModelDef, consentModel, stateInstructions,
      policyContext: policyCtx, factsAlreadyKnown, unresolvedContradictions,
      floodDataHandler,
    } = input;

    const currentState = input.currentState || "not-started";
    const clientStateHistory = input.stateHistory || [];

    const pipelineStart = Date.now();
    const steps: PipelineStep[] = [];

    // ── 1. Policy Evaluation (deterministic) ──
    let policyResult: PolicyResult | undefined;
    let policyResultInfo: OrchestratorOutput["policyResult"] | undefined;

    {
      const t0 = Date.now();
      if (policyRuleset && policyCtx) {
        const evaluator = new PolicyEvaluator();
        policyResult = evaluator.evaluate(policyRuleset, policyCtx);
        policyResultInfo = {
          eligible: policyResult.eligible,
          explanation: policyResult.explanation,
          passedCount: policyResult.passed.length,
          failedCount: policyResult.failed.length,
          edgeCaseCount: policyResult.edgeCases.length,
        };
        steps.push({
          id: "policy-eval", name: "PolicyEvaluator", type: "deterministic",
          label: "Policy evaluation (rule-based)", status: "complete",
          durationMs: Date.now() - t0,
          detail: `Eligible: ${policyResult.eligible}, ${policyResult.passed.length} passed, ${policyResult.failed.length} failed`,
        });
      } else {
        steps.push({
          id: "policy-eval", name: "PolicyEvaluator", type: "deterministic",
          label: "Policy evaluation (rule-based)", status: "skipped",
          durationMs: Date.now() - t0,
          detail: "No policy ruleset provided",
        });
      }
    }

    // ── 2. State Machine Setup ──
    let stateMachine: StateMachine | null = null;
    {
      const t0 = Date.now();
      if (stateModelDef) {
        stateMachine = new StateMachine(stateModelDef);
        stateMachine.setState(currentState);
        steps.push({
          id: "state-setup", name: "StateMachine", type: "deterministic",
          label: "State machine setup", status: "complete",
          durationMs: Date.now() - t0,
          detail: `State: ${currentState}`,
        });
      } else {
        steps.push({
          id: "state-setup", name: "StateMachine", type: "deterministic",
          label: "State machine setup", status: "skipped",
          durationMs: Date.now() - t0,
        });
      }
    }

    // ── 3. FieldCollector ──
    const manifest = input.artefacts?.manifest;
    let fieldCollector: FieldCollector | undefined;
    {
      const t0 = Date.now();
      if (manifest?.input_schema) {
        fieldCollector = new FieldCollector(manifest.input_schema);
        fieldCollector.seedFromPersona(personaData);
        steps.push({
          id: "field-collector", name: "FieldCollector", type: "deterministic",
          label: "Field collection (rule-based)", status: "complete",
          durationMs: Date.now() - t0,
        });
      } else {
        steps.push({
          id: "field-collector", name: "FieldCollector", type: "deterministic",
          label: "Field collection (rule-based)", status: "skipped",
          durationMs: Date.now() - t0,
        });
      }
    }

    // ── Agent Selection (deterministic) ──
    const selectedAgent = Orchestrator.selectAgent(serviceId, stateModelDef, currentState);
    steps.push({
      id: "agent-select", name: "AgentSelector", type: "deterministic",
      label: `Agent selection: ${selectedAgent}`,
      status: "complete", durationMs: 0,
      detail: selectedAgent === "triage"
        ? "No active service journey — using triage agent"
        : "Active service journey — using journey agent",
    });

    // ── 4-5. Build Strategy Context + System Prompt ──
    let systemPrompt: string;
    const strategyCtx = {
      serviceId,
      personaData: policyCtx || personaData,
      currentState: stateMachine?.getState() || currentState,
      stateHistory: clientStateHistory,
      policyResult,
      artefacts: input.artefacts,
      stateInstructions,
    };

    {
      const t0 = Date.now();
      const strategyServiceContext = await Promise.resolve(this.strategy.buildServiceContext(strategyCtx));

      if (selectedAgent === "triage") {
        systemPrompt = this.buildTriagePrompt({
          agent, agentPrompt, personaPrompt, scenarioPrompt,
          personaData, generateTitle,
          strategyServiceContext,
          factsAlreadyKnown, unresolvedContradictions,
        });
      } else {
        systemPrompt = this.buildJourneyPrompt({
          agent, scenario, serviceId,
          agentPrompt, personaPrompt, scenarioPrompt,
          personaData, policyResult,
          stateMachine, consentModel, stateInstructions,
          fieldCollector,
          factsAlreadyKnown, unresolvedContradictions,
          generateTitle,
          strategyServiceContext,
        });
      }

      steps.push({
        id: "prompt-build", name: "PromptBuilder", type: "deterministic",
        label: `${capitalize(selectedAgent)} prompt construction`, status: "complete",
        durationMs: Date.now() - t0,
      });
    }

    // ── 6. Build Tools ──
    let tools: ToolDefinition[];
    let hasTools: boolean;
    {
      const t0 = Date.now();
      tools = this.strategy.buildTools(strategyCtx);
      hasTools = tools.length > 0;
      steps.push({
        id: "tool-build", name: "ToolBuilder", type: "deterministic",
        label: "Tool list construction", status: "complete",
        durationMs: Date.now() - t0,
        detail: `${tools.length} tools available`,
      });
    }

    // ── 7. Agentic Loop ──
    let loopMessages = [...messages];
    let reasoning = "";
    let responseText = "";
    const toolsUsed: string[] = [];

    {
      const t0 = Date.now();
      for (let i = 0; i < this.maxIterations; i++) {
        const llmResult = await this.adapter.chat({
          systemPrompt,
          messages: loopMessages,
          tools: hasTools ? tools : undefined,
        });

        if (llmResult.stopReason === "tool_use") {
          if (llmResult.reasoning) reasoning = llmResult.reasoning;

          loopMessages.push({ role: "assistant", content: llmResult.rawContent });

          const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

          for (const toolCall of llmResult.toolCalls) {
            toolsUsed.push(toolCall.name);

            let toolResult: string;
            if (toolCall.name === "ea_current_floods" && floodDataHandler) {
              const city = (personaData.address as Record<string, unknown>)?.city as string || "";
              toolResult = await floodDataHandler(city);
            } else {
              toolResult = await this.strategy.dispatchToolCall(toolCall.name, toolCall.input);
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: toolResult,
            });
          }

          loopMessages.push({ role: "user", content: toolResults });
          continue;
        }

        // Final response
        responseText = llmResult.responseText;
        reasoning = llmResult.reasoning || reasoning;
        break;
      }
      steps.push({
        id: "llm-call", name: "LanguageAgent", type: "ai",
        label: "LLM generation", status: responseText ? "complete" : "error",
        durationMs: Date.now() - t0,
        detail: toolsUsed.length > 0 ? `${toolsUsed.length} tool calls` : undefined,
        agentName: selectedAgent,
      });
    }

    // ── 8-9. Parse Structured Output + Build Tasks ──
    let structuredOutput: ParsedStructuredOutput | null;
    let conversationTitle: string | null;
    let tasks: TaskEntry[];
    {
      const t0 = Date.now();
      const parsed = parseStructuredOutput(responseText);
      structuredOutput = parsed.parsed;
      responseText = parsed.cleanText;

      conversationTitle = (generateTitle && structuredOutput?.title) ? structuredOutput.title : null;

      tasks = (structuredOutput?.tasks || []).map((t, i) => ({
        id: `task_${Date.now()}_${i}`,
        description: t.description,
        detail: t.detail,
        type: t.type,
        dueDate: t.dueDate || null,
        dataNeeded: t.dataNeeded || [],
        options: t.options || [],
        ...(t.fields ? { fields: t.fields } : {}),
      }));
      steps.push({
        id: "output-parse", name: "OutputParser", type: "deterministic",
        label: "Parse structured output", status: structuredOutput ? "complete" : "skipped",
        durationMs: Date.now() - t0,
        detail: structuredOutput ? `${tasks.length} tasks, ${structuredOutput.extractedFacts?.length || 0} facts` : undefined,
      });
    }

    // ── 10. State Transitions ──
    const stateTransitions: Array<{ fromState: string; toState: string; trigger: string }> = [];
    let ucStateInfo: OrchestratorOutput["ucState"] | undefined;
    const stateTransitionT0 = Date.now();

    // MCP mode: extract transitions from tool results
    const mcpTransitions = this.strategy.extractStateTransitions(loopMessages);
    if (mcpTransitions.length > 0) {
      stateTransitions.push(...mcpTransitions);
    }

    if (stateMachine) {
      // Validate LLM's proposed transition
      if (structuredOutput?.proposedTransition && stateTransitions.length === 0) {
        const result = stateMachine.transition(structuredOutput.proposedTransition);
        if (result.success) {
          stateTransitions.push({
            fromState: result.fromState,
            toState: result.toState,
            trigger: result.trigger,
          });
        }
      }

      // Apply forced transitions from state-instructions.json
      if (stateInstructions?.forcedTransitions) {
        const forced = stateInstructions.forcedTransitions;
        let forcedTrigger = forced[stateMachine.getState()];
        while (forcedTrigger) {
          const result = stateMachine.transition(forcedTrigger);
          if (result.success) {
            stateTransitions.push({
              fromState: result.fromState,
              toState: result.toState,
              trigger: result.trigger,
            });
            forcedTrigger = forced[stateMachine.getState()];
          } else {
            break;
          }
        }
      }

      // Apply auto-transitions from state-instructions.json patterns
      if (stateTransitions.length === 0 && stateInstructions?.autoTransitions) {
        const lastUserMsg = messages.filter((m) => m.role === "user").pop();
        const userText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";

        for (const auto of stateInstructions.autoTransitions) {
          if (auto.fromState === stateMachine.getState()) {
            const pattern = new RegExp(auto.pattern, "i");
            if (pattern.test(userText)) {
              const result = stateMachine.transition(auto.trigger);
              if (result.success) {
                stateTransitions.push({
                  fromState: result.fromState,
                  toState: result.toState,
                  trigger: result.trigger,
                });
              }
              break;
            }
          }
        }
      }

      // Second pass: chain forced transitions after auto-transitions
      if (stateInstructions?.forcedTransitions) {
        const forced = stateInstructions.forcedTransitions;
        let forcedTrigger = forced[stateMachine.getState()];
        while (forcedTrigger) {
          const result = stateMachine.transition(forcedTrigger);
          if (result.success) {
            stateTransitions.push({
              fromState: result.fromState,
              toState: result.toState,
              trigger: result.trigger,
            });
            forcedTrigger = forced[stateMachine.getState()];
          } else {
            break;
          }
        }
      }

      // Build state history
      const updatedHistory = [...clientStateHistory];
      if (!updatedHistory.includes(currentState)) {
        updatedHistory.push(currentState);
      }
      for (const t of stateTransitions) {
        if (!updatedHistory.includes(t.toState)) {
          updatedHistory.push(t.toState);
        }
      }

      ucStateInfo = {
        currentState: stateMachine.getState(),
        previousState: stateTransitions.length > 0 ? stateTransitions[0].fromState : undefined,
        trigger: stateTransitions.length > 0 ? stateTransitions[stateTransitions.length - 1].trigger : undefined,
        allowedTransitions: stateMachine.allowedTransitions().map(t => t.trigger!).filter(Boolean),
        stateHistory: updatedHistory,
      };
    } else if (mcpTransitions.length > 0) {
      // MCP mode without local state machine: build from tool results
      const latestState = stateTransitions[stateTransitions.length - 1].toState;
      const updatedHistory = [...clientStateHistory];
      if (!updatedHistory.includes(currentState)) updatedHistory.push(currentState);
      for (const t of stateTransitions) {
        if (!updatedHistory.includes(t.toState)) updatedHistory.push(t.toState);
      }
      ucStateInfo = {
        currentState: latestState,
        previousState: stateTransitions[0].fromState,
        trigger: stateTransitions[stateTransitions.length - 1].trigger,
        allowedTransitions: [],
        stateHistory: updatedHistory,
      };
    }

    steps.push({
      id: "state-transition", name: "StateValidator", type: "deterministic",
      label: "State transition validation", status: stateTransitions.length > 0 ? "complete" : "skipped",
      durationMs: Date.now() - stateTransitionT0,
      detail: stateTransitions.length > 0 ? `${stateTransitions.length} transition(s)` : undefined,
    });

    // ── 11. Deterministic Task Injection ──
    {
      const t0 = Date.now();
      if (stateMachine) {
        tasks = injectDeterministicTasks(
          tasks,
          currentState,
          stateMachine.getState(),
          stateTransitions.length > 0,
        );
        steps.push({
          id: "task-injection", name: "TaskInjector", type: "deterministic",
          label: "Deterministic task injection", status: "complete",
          durationMs: Date.now() - t0,
          detail: `${tasks.length} task(s)`,
        });
      } else {
        steps.push({
          id: "task-injection", name: "TaskInjector", type: "deterministic",
          label: "Deterministic task injection", status: "skipped",
          durationMs: Date.now() - t0,
        });
      }
    }

    // ── 12. Consent Requests ──
    let consentRequests: OrchestratorOutput["consentRequests"] | undefined;
    {
      const t0 = Date.now();
      if (consentModel && stateMachine) {
        const stateId = stateMachine.getState();
        if (stateId === "eligibility-checked") {
          const grants = (consentModel.grants || []);
          consentRequests = grants.map(g => ({
            id: g.id,
            description: g.description,
            data_shared: g.data_shared,
            source: g.source,
            purpose: g.purpose,
          }));
        }
      }
      steps.push({
        id: "consent-check", name: "ConsentResolver", type: "deterministic",
        label: "Consent check", status: consentRequests ? "complete" : "skipped",
        durationMs: Date.now() - t0,
        detail: consentRequests ? `${consentRequests.length} grant(s)` : undefined,
      });
    }

    // ── 13. Handoff Detection ──
    let handoffInfo: OrchestratorOutput["handoff"] | undefined;
    {
      const t0 = Date.now();
      const lastUserMessage = messages.filter(m => m.role === "user").pop();
      const lastUserText = typeof lastUserMessage?.content === "string" ? lastUserMessage.content : "";
      const handoffCheck = this.handoffManager.evaluateTriggers(lastUserText, {
        policyEdgeCase: policyResultInfo ? policyResultInfo.edgeCaseCount > 0 : false,
      });

      if (handoffCheck.triggered) {
        const citizenName = (personaData.name as string) || "Unknown";
        const handoffPackage = this.handoffManager.createPackage({
          reason: handoffCheck.reason!,
          description: handoffCheck.description!,
          agentAssessment: `Agent ${agent.toUpperCase()} detected handoff trigger during ${scenario} scenario.`,
          citizen: { name: citizenName },
          stepsCompleted: [`Chat conversation (${messages.length} messages)`],
          stepsBlocked: [handoffCheck.description || "Trigger detected"],
          dataCollected: Object.keys(personaData).filter(k => k !== "communicationStyle"),
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
      }
      steps.push({
        id: "handoff-check", name: "HandoffDetector", type: "deterministic",
        label: "Handoff detection", status: handoffCheck.triggered ? "complete" : "skipped",
        durationMs: Date.now() - t0,
        detail: handoffCheck.triggered ? `Reason: ${handoffCheck.reason}` : undefined,
      });
    }

    // ── 14. Record Extracted Fields ──
    if (fieldCollector && structuredOutput?.extractedFacts) {
      for (const fact of structuredOutput.extractedFacts) {
        fieldCollector.recordField(fact.key, fact.value, "conversation");
      }
    }

    // ── 15. Version Metadata ──
    const versionMetadata = {
      promptHash: hashPrompt(systemPrompt),
      rulesetVersion: policyRuleset?.version,
      stateModelVersion: stateModelDef?.version,
    };

    const pipelineTrace: PipelineTrace = {
      traceId: "",
      steps,
      totalDurationMs: Date.now() - pipelineStart,
      agentUsed: selectedAgent,
    };

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
      extractedFields: structuredOutput?.extractedFacts,
      versionMetadata,
      pipelineTrace,
    };
  }

  // ── Agent Selection ──

  static selectAgent(
    serviceId: string,
    stateModelDef?: StateModelDefinition,
    currentState?: string,
  ): "triage" | "journey" {
    if (!serviceId || serviceId === "triage") return "triage";
    if (!stateModelDef && (!currentState || currentState === "not-started")) return "triage";
    return "journey";
  }

  // ── Triage Prompt Builder ──
  // Receives: personality, persona, service catalog context, fact extraction, task/output format
  // Does NOT receive: state model, field collector, consent model, accuracy guardrails about payments

  private buildTriagePrompt(opts: {
    agent: string;
    agentPrompt: string;
    personaPrompt: string;
    scenarioPrompt: string;
    personaData: Record<string, unknown>;
    generateTitle?: boolean;
    strategyServiceContext: string;
    factsAlreadyKnown?: string;
    unresolvedContradictions?: string;
  }): string {
    const {
      agent, agentPrompt, personaPrompt, scenarioPrompt,
      personaData, generateTitle, strategyServiceContext,
      factsAlreadyKnown, unresolvedContradictions,
    } = opts;

    const parts: string[] = [];

    // Agent personality
    parts.push(agentPrompt);
    parts.push("---");
    parts.push(personaPrompt);
    parts.push("---");
    parts.push(scenarioPrompt);
    parts.push("---");

    // Persona data
    parts.push(`PERSONA DATA AVAILABLE:\nYou have access to the following data about the user. Use this according to your agent personality (DOT asks permission, MAX auto-fills).\n\n${JSON.stringify(personaData, null, 2)}`);

    // Service catalog/graph context
    if (strategyServiceContext) {
      parts.push("---");
      parts.push(strategyServiceContext);
    }

    // Fact extraction
    parts.push("---");
    let factPrompt = FACT_EXTRACTION_INSTRUCTIONS;
    if (factsAlreadyKnown) factPrompt += factsAlreadyKnown;
    if (unresolvedContradictions) factPrompt += unresolvedContradictions;
    parts.push(factPrompt);

    // Character
    parts.push("---");
    parts.push(`Remember: Stay in character as ${agent.toUpperCase()} agent, communicate according to the persona style, and help the citizen find the right government service.`);

    if (generateTitle) {
      parts.push(TITLE_INSTRUCTIONS);
    }

    parts.push(TASK_INSTRUCTIONS);
    parts.push(STRUCTURED_OUTPUT_INSTRUCTIONS);

    return parts.join("\n\n");
  }

  // ── Journey Prompt Builder ──
  // Receives: personality, persona, strategy service context, state model, field collector,
  //           consent model, accuracy guardrails, task/output format, fact extraction
  // Does NOT receive: service catalog/triage context (that's in strategy context for journey)

  private buildJourneyPrompt(opts: {
    agent: string;
    scenario: string;
    serviceId: string;
    agentPrompt: string;
    personaPrompt: string;
    scenarioPrompt: string;
    personaData: Record<string, unknown>;
    policyResult?: PolicyResult;
    stateMachine: StateMachine | null;
    consentModel?: ConsentModel;
    stateInstructions?: StateInstructions;
    fieldCollector?: FieldCollector;
    factsAlreadyKnown?: string;
    unresolvedContradictions?: string;
    generateTitle?: boolean;
    strategyServiceContext: string;
  }): string {
    const {
      agent, scenario, serviceId,
      agentPrompt, personaPrompt, scenarioPrompt,
      personaData, stateMachine, consentModel, stateInstructions,
      fieldCollector, factsAlreadyKnown, unresolvedContradictions,
      generateTitle, strategyServiceContext,
    } = opts;

    const parts: string[] = [];

    // Agent personality
    parts.push(agentPrompt);
    parts.push("---");
    parts.push(personaPrompt);
    parts.push("---");
    parts.push(scenarioPrompt);
    parts.push("---");

    // Persona data
    parts.push(`PERSONA DATA AVAILABLE:\nYou have access to the following data about the user. Use this according to your agent personality (DOT asks permission, MAX auto-fills).\n\n${JSON.stringify(personaData, null, 2)}`);

    // Strategy-built service context (policy results, tool instructions, etc.)
    if (strategyServiceContext) {
      parts.push("---");
      parts.push(strategyServiceContext);
    }

    // Fact extraction
    parts.push("---");
    let factPrompt = FACT_EXTRACTION_INSTRUCTIONS;
    if (factsAlreadyKnown) factPrompt += factsAlreadyKnown;
    if (unresolvedContradictions) factPrompt += unresolvedContradictions;
    parts.push(factPrompt);

    // State model context
    if (stateMachine) {
      parts.push("---");
      parts.push(this.buildStateContext(stateMachine, consentModel, stateInstructions, personaData, serviceId));
    }

    // Field collector context
    if (fieldCollector) {
      parts.push("---");
      parts.push(fieldCollector.toContext());
    }

    // Character and guardrails
    parts.push("---");
    parts.push(`Remember: Stay in character as ${agent.toUpperCase()} agent, communicate according to the persona style, and help with the ${scenario} scenario.`);

    parts.push(ACCURACY_GUARDRAILS);

    if (generateTitle) {
      parts.push(TITLE_INSTRUCTIONS);
    }

    parts.push(TASK_INSTRUCTIONS);
    parts.push(STRUCTURED_OUTPUT_INSTRUCTIONS);

    return parts.join("\n\n");
  }

  private buildStateContext(
    stateMachine: StateMachine,
    consentModel?: ConsentModel,
    stateInstructions?: StateInstructions,
    personaData?: Record<string, unknown>,
    serviceId?: string,
  ): string {
    const currentState = stateMachine.getState();
    const allowed = stateMachine.allowedTransitions();
    const isTerminal = stateMachine.isTerminal();

    const lines: string[] = [];
    lines.push("STATE MODEL JOURNEY:");
    lines.push(`Current state: ${currentState}`);
    lines.push(`Is terminal: ${isTerminal ? "YES — journey complete" : "NO — journey in progress"}`);

    if (allowed.length > 0) {
      lines.push(`Available transitions: ${allowed.map(t => `${t.trigger} → ${t.to}`).join(", ")}`);
    }

    // Per-state instructions from data file
    const instruction = stateInstructions?.instructions?.[currentState];
    if (instruction) {
      lines.push("");
      lines.push(`INSTRUCTIONS FOR THIS STATE:`);
      lines.push(instruction);
    }

    // Data on file context
    if (personaData) {
      lines.push("");
      lines.push(buildDataOnFileContext(personaData));
    }

    // Consent requirements
    if (consentModel) {
      const grants = consentModel.grants || [];
      if (grants.length > 0) {
        lines.push("");
        lines.push("CONSENT REQUIREMENTS:");
        for (const grant of grants) {
          lines.push(`- ${grant.id}: ${grant.description} (data: ${grant.data_shared.join(", ")})`);
        }
      }
    }

    // Transition instructions
    lines.push("");
    lines.push("STATE TRANSITIONS:");
    lines.push('When you determine a state transition should happen, set the "stateTransition" field in the JSON block to the trigger name.');
    lines.push('For example: "stateTransition": "verify-identity"');
    lines.push("IMPORTANT: Only set ONE state transition per response. Do NOT skip ahead or combine steps.");
    lines.push("IMPORTANT: For states that collect data (housing, bank details, income), do NOT set a transition until the user has actually provided the information in a message. Ask for the data and STOP — wait for their reply.");

    return lines.join("\n");
  }
}

// Prompt fragments are imported from ./prompt-fragments

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
