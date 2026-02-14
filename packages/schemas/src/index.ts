/**
 * @als/schemas — Shared types and JSON schema definitions
 *
 * The contract between all packages in the Agentic Legibility Stack.
 */

// ── Capability Manifest ──

export interface CapabilityManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  department: string;
  jurisdiction?: string;

  input_schema: JsonSchema;
  output_schema: JsonSchema;

  constraints?: {
    sla?: string;
    fee?: { amount: number; currency: string };
    availability?: string;
  };

  eligibility_ruleset_id?: string;
  consent_requirements?: string[];
  evidence_requirements?: string[];

  redress?: {
    complaint_url?: string;
    appeal_process?: string;
    ombudsman?: string;
  };

  audit_requirements?: {
    retention_period?: string;
    data_controller?: string;
    lawful_basis?: string;
  };

  handoff?: {
    escalation_phone?: string;
    opening_hours?: string;
    department_queue?: string;
  };
}

// ── Policy Ruleset ──

export interface PolicyRuleset {
  id: string;
  version: string;
  rules: PolicyRule[];
  explanation_template?: string;
  edge_cases?: PolicyEdgeCase[];
}

export interface PolicyRule {
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

export interface PolicyEdgeCase {
  id: string;
  description: string;
  detection: string;
  action: string;
}

export interface PolicyResult {
  eligible: boolean;
  passed: PolicyRule[];
  failed: PolicyRule[];
  edgeCases: PolicyEdgeCase[];
  explanation: string;
}

// ── State Model ──

export interface StateModelDefinition {
  id: string;
  version: string;
  states: StateDefinition[];
  transitions: TransitionDefinition[];
}

export interface StateDefinition {
  id: string;
  type?: "initial" | "terminal";
  receipt?: boolean;
}

export interface TransitionDefinition {
  from: string;
  to: string;
  trigger?: string;
  condition?: string;
}

export interface TransitionResult {
  success: boolean;
  fromState: string;
  toState: string;
  trigger: string;
  error?: string;
}

// ── Consent Model ──

export interface ConsentModel {
  id: string;
  version: string;
  grants: ConsentGrant[];
  revocation?: {
    mechanism: string;
    effect: string;
  };
  delegation?: {
    agent_identity: string;
    scopes: string[];
    limitations: string;
  };
}

export interface ConsentGrant {
  id: string;
  description: string;
  data_shared: string[];
  source: string;
  purpose: string;
  duration: "session" | "until-revoked";
  required: boolean;
}

// ── Trace Events ──

export interface TraceEvent {
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: string;
  type: TraceEventType;
  payload: Record<string, unknown>;
  metadata: {
    userId?: string;
    sessionId: string;
    capabilityId?: string;
  };
}

export type TraceEventType =
  | "llm.request"
  | "llm.response"
  | "plan.created"
  | "plan.step.started"
  | "plan.step.completed"
  | "capability.invoked"
  | "capability.result"
  | "policy.evaluated"
  | "consent.requested"
  | "consent.granted"
  | "consent.denied"
  | "consent.revoked"
  | "credential.requested"
  | "credential.presented"
  | "receipt.issued"
  | "state.transition"
  | "handoff.initiated"
  | "handoff.package.created"
  | "error.raised"
  | "redress.offered";

// ── Receipts ──

export interface Receipt {
  id: string;
  traceId: string;
  capabilityId: string;
  timestamp: string;
  citizen: {
    id: string;
    name?: string;
  };
  action: string;
  outcome: "success" | "failure" | "partial" | "handoff";
  details: Record<string, unknown>;
  dataShared?: string[];
  stateTransition?: {
    from: string;
    to: string;
  };
}

// ── Invocation ──

export interface InvocationContext {
  sessionId: string;
  traceId: string;
  userId?: string;
  identityContext?: Record<string, unknown>;
  consentRecords?: Record<string, unknown>[];
}

export interface InvocationResult {
  success: boolean;
  capabilityId: string;
  output?: unknown;
  error?: string;
  receipt?: Receipt;
  traceEvents: TraceEvent[];
  stateTransition?: {
    from: string;
    to: string;
  };
}

// ── Handoff Package ──

export interface HandoffPackage {
  id: string;
  createdAt: string;
  urgency: "routine" | "priority" | "urgent" | "safeguarding";

  citizen: {
    name: string;
    contactDetails: {
      preferredChannel: string;
      phone?: string;
      email?: string;
    };
  };

  reason: {
    category: HandoffReason;
    description: string;
    agentAssessment: string;
  };

  conversationSummary: {
    serviceAttempted: string;
    stepsCompleted: string[];
    stepsBlocked: string[];
    dataCollected: string[];
    timeSpent: string;
  };

  traceId: string;
  receiptIds: string[];
  suggestedActions: string[];

  routing: {
    department: string;
    serviceArea: string;
    suggestedQueue: string;
    referenceNumber?: string;
  };
}

export type HandoffReason =
  | "complexity-exceeded"
  | "repeated-failure"
  | "citizen-requested"
  | "safeguarding-concern"
  | "dispute-or-complaint"
  | "technical-failure"
  | "policy-edge-case";

// ── Utility types ──

export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}
