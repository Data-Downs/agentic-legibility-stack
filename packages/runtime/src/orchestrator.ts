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
} from "@als/schemas";
import {
  PolicyEvaluator,
  StateMachine,
  FieldCollector,
} from "@als/legibility";
import type { ServiceArtefacts } from "@als/legibility";
import { HandoffManager } from "./handoff-manager";
import type { ServiceStrategy, ToolDefinition } from "./service-strategy";

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
}

// ── Structured output parser ──

interface ParsedStructuredOutput {
  title?: string;
  proposedTransition?: string;
  tasks?: Array<{
    description: string;
    detail: string;
    type: "agent" | "user";
    dueDate?: string;
    dataNeeded?: string[];
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

    // ── 1. Policy Evaluation (deterministic) ──
    let policyResult: PolicyResult | undefined;
    let policyResultInfo: OrchestratorOutput["policyResult"] | undefined;

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
    }

    // ── 2. State Machine Setup ──
    let stateMachine: StateMachine | null = null;
    if (stateModelDef) {
      stateMachine = new StateMachine(stateModelDef);
      stateMachine.setState(currentState);
    }

    // ── 3. FieldCollector ──
    const manifest = input.artefacts?.manifest;
    let fieldCollector: FieldCollector | undefined;
    if (manifest?.input_schema) {
      fieldCollector = new FieldCollector(manifest.input_schema);
      fieldCollector.seedFromPersona(personaData);
    }

    // ── 4. Build Strategy Context ──
    const strategyCtx = {
      serviceId,
      personaData: policyCtx || personaData,
      currentState: stateMachine?.getState() || currentState,
      stateHistory: clientStateHistory,
      policyResult,
      artefacts: input.artefacts,
      stateInstructions,
    };

    // ── 5. Build System Prompt ──
    const systemPrompt = this.buildSystemPrompt({
      agent, scenario, serviceId,
      agentPrompt, personaPrompt, scenarioPrompt,
      personaData, policyResult,
      stateMachine, consentModel, stateInstructions,
      fieldCollector,
      factsAlreadyKnown, unresolvedContradictions,
      generateTitle,
      strategyServiceContext: await Promise.resolve(this.strategy.buildServiceContext(strategyCtx)),
    });

    // ── 6. Build Tools ──
    const tools = this.strategy.buildTools(strategyCtx);
    const hasTools = tools.length > 0;

    // ── 7. Agentic Loop ──
    let loopMessages = [...messages];
    let reasoning = "";
    let responseText = "";
    const toolsUsed: string[] = [];

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

    // ── 8. Parse Structured Output ──
    const { parsed: structuredOutput, cleanText } = parseStructuredOutput(responseText);
    responseText = cleanText;

    const conversationTitle = (generateTitle && structuredOutput?.title) ? structuredOutput.title : null;

    // ── 9. Build Tasks ──
    let tasks: TaskEntry[] = (structuredOutput?.tasks || []).map((t, i) => ({
      id: `task_${Date.now()}_${i}`,
      description: t.description,
      detail: t.detail,
      type: t.type,
      dueDate: t.dueDate || null,
      dataNeeded: t.dataNeeded || [],
    }));

    // ── 10. State Transitions ──
    const stateTransitions: Array<{ fromState: string; toState: string; trigger: string }> = [];
    let ucStateInfo: OrchestratorOutput["ucState"] | undefined;

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

    // ── 11. Deterministic Task Injection ──
    if (stateMachine) {
      tasks = injectDeterministicTasks(
        tasks,
        currentState,
        stateMachine.getState(),
        stateTransitions.length > 0,
      );
    }

    // ── 12. Consent Requests ──
    let consentRequests: OrchestratorOutput["consentRequests"] | undefined;
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

    // ── 13. Handoff Detection ──
    const lastUserMessage = messages.filter(m => m.role === "user").pop();
    const lastUserText = typeof lastUserMessage?.content === "string" ? lastUserMessage.content : "";
    const handoffCheck = this.handoffManager.evaluateTriggers(lastUserText, {
      policyEdgeCase: policyResultInfo ? policyResultInfo.edgeCaseCount > 0 : false,
    });

    let handoffInfo: OrchestratorOutput["handoff"] | undefined;
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
    };
  }

  // ── System Prompt Builder ──

  private buildSystemPrompt(opts: {
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

    // Core prompts
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

    // Personal data extraction instructions
    parts.push("---");
    let factPrompt = `PERSONAL DATA EXTRACTION:
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

// ── Static prompt fragments ──

const ACCURACY_GUARDRAILS = `ACCURACY GUARDRAILS — CRITICAL:
- Do NOT fabricate specific payment amounts (e.g. "£393.45/month"). Instead say "DWP will calculate and confirm your exact payment amount."
- Do NOT fabricate specific payment dates (e.g. "14th March 2026"). Instead say "Your first payment will be approximately 5 weeks after your claim date."
- Do NOT fabricate claim reference numbers. Instead say "You will receive a reference number by email/post."
- Do NOT perform benefit calculations — these are complex and depend on many factors only DWP can assess.
- You MAY mention general facts: the 5-week waiting period, the UC journal requirement, Jobcentre Plus interviews.
- When presenting data from the citizen's records, show EXACTLY what is in the data — do not embellish or assume.`;

const TITLE_INSTRUCTIONS = `CONVERSATION TITLE:
Since this is the start of a new conversation, include a "title" field in the JSON block at the end of your response.
The title should be a short 3-8 word phrase describing the user's intent or action (e.g. "Renewing MOT for Ford Focus", "Checking flood warnings in Cambridge", "Understanding PIP eligibility").`;

const TASK_INSTRUCTIONS = `ACTIONABLE TASKS:
When your response contains actionable next steps, include them in the "tasks" array of the JSON block.
Each task object has these fields:
- "description": short summary (max 60 chars)
- "detail": one-sentence explanation (max 150 chars)
- "type": "agent" (something you can do) or "user" (something the citizen must do)
- "dueDate": optional, ISO date string YYYY-MM-DD (only when there is a genuine deadline)
- "dataNeeded": optional array of persona data field names relevant to the task

Rules:
- Maximum 3 tasks per response
- Only create tasks for genuinely actionable items, not general advice`;

const STRUCTURED_OUTPUT_INSTRUCTIONS = `STRUCTURED OUTPUT FORMAT — CRITICAL:
At the END of every response, you MUST append a fenced JSON block containing structured metadata.
The block must be the LAST thing in your response, after all conversational text.
Format:
\`\`\`json
{
  "title": "Short title or null",
  "tasks": [],
  "stateTransition": "trigger-name or null"
}
\`\`\`

Rules:
- ALWAYS include the JSON block, even if all fields are null/empty
- "title": set only when instructed (first message of a new conversation), otherwise null
- "tasks": array of task objects (see ACTIONABLE TASKS above), or empty array []
- "stateTransition": the trigger name for the current state transition, or null if none
- The JSON block will be stripped before showing your response to the citizen`;
