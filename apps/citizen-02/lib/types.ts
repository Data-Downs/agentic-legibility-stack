/** Core types for the citizen-02 app */

export interface PersonaData {
  personaId: string;
  personaName: string;
  description: string;
  primaryContact: {
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
    nationalInsuranceNumber?: string;
    email?: string;
    phone?: string;
  };
  partner?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationalInsuranceNumber?: string;
  };
  address: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    residingSince?: string;
    housingStatus?: string;
  };
  employment?: Record<string, unknown>;
  financials?: Record<string, unknown>;
  vehicles?: Vehicle[];
  pregnancy?: {
    dueDate: string;
    hospital?: string;
    midwife?: string;
    firstBaby?: boolean;
    expectedArrival?: string;
  };
  children?: Array<{
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  }>;
  benefits?: {
    currentlyReceiving?: Array<{
      type: string;
      amount: number;
      frequency: string;
      startDate?: string;
    }>;
    potentiallyEligibleFor?: string[];
    previousClaims?: Array<Record<string, unknown>>;
  };
  healthInfo?: Record<string, unknown>;
  family?: {
    supportNetwork?: string[];
    notes?: string;
  };
  communicationStyle?: {
    tone: string;
    techSavvy: string;
    primaryConcerns: string[];
    typicalPhrases: string[];
  };
}

export interface Vehicle {
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  owner: string;
  motExpiry?: string;
  taxExpiry?: string;
  insuranceExpiry?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

export interface TaskField {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "currency" | "date" | "number" | "confirm" | "select";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  prefill?: string;
  required?: boolean;
}

export interface AgentTask {
  id: string;
  description: string;
  detail: string;
  type: "agent" | "user";
  dueDate: string | null;
  dataNeeded: string[];
  options?: Array<{ value: string; label: string }>;
  fields?: TaskField[];
}

export interface UCStateInfo {
  currentState: string;
  previousState?: string;
  trigger?: string;
  allowedTransitions: string[];
  stateHistory: string[];
}

export interface ConsentGrant {
  id: string;
  description: string;
  data_shared: string[];
  source: string;
  purpose: string;
  duration?: string;
  required?: boolean;
}

export interface ChatApiRequest {
  persona: string;
  agent: string;
  scenario: string;
  messages: ChatMessage[];
  generateTitle?: boolean;
  ucState?: string;
  ucStateHistory?: string[];
  serviceMode?: ServiceMode;
}

export interface ChatApiResponse {
  response: string;
  reasoning: string;
  toolsUsed: string[];
  conversationTitle: string | null;
  tasks: AgentTask[];
  traceId?: string;
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
  ucState?: UCStateInfo;
  consentRequests?: ConsentGrant[];
  cardRequests?: import("@als/schemas").CardRequest[];
  interactionType?: string;
  pipelineTrace?: import("@als/schemas").PipelineTrace;
}

export interface Conversation {
  id: string;
  title: string;
  service: string;
  agent: string;
  scenario: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  ucState?: string;
  ucStateHistory?: string[];
  interactionType?: string;
  tasks?: AgentTask[];
  taskCompletions?: Record<string, string>;
  tasksSubmitted?: boolean;
}

export interface StoredTask {
  id: string;
  conversationId: string;
  service: string;
  description: string;
  detail: string;
  type: "agent" | "user";
  status: "suggested" | "accepted" | "completed" | "dismissed";
  dueDate: string | null;
  dataNeeded: string[];
  options?: Array<{ value: string; label: string }>;
  fields?: TaskField[];
  createdAt: string;
  updatedAt: string;
}

export type AgentType = "dot" | "max";
export type ServiceMode = "json" | "mcp";
export type ServiceType = "driving" | "benefits" | "family" | (string & {});
export type ViewType =
  | "persona-picker"
  | "dashboard"
  | "detail"
  | "chat"
  | "tasks"
  | "plan";

export type ServicePlanStatus = "locked" | "available" | "in_progress" | "completed" | "skipped";

export interface ActivePlan {
  id: string;
  lifeEventId: string;
  lifeEventName: string;
  lifeEventIcon: string;
  startedAt: string;
  updatedAt: string;
  serviceProgress: Record<string, ServicePlanStatus>;
  serviceConversations: Record<string, string>;
  plan: LifeEventPlan;
  services: LifeEventService[];
}

export const PERSONA_NAMES: Record<string, string> = {
  "emma-parker": "Emma & Liam Parker",
  "rajesh-patel": "Rajesh Patel",
  "margaret-thompson": "Margaret Thompson",
  "david-evans": "David Evans",
  "priya-sharma": "Priya Sharma",
  "mary-summers": "Hugo & Mary Summers",
};

export const PERSONA_COLORS: Record<string, string> = {
  "emma-parker": "#1d70b8",
  "rajesh-patel": "#00703c",
  "margaret-thompson": "#912b88",
  "david-evans": "#d4351c",
  "priya-sharma": "#f47738",
  "mary-summers": "#4c6272",
};

export const PERSONA_INITIALS: Record<string, string> = {
  "emma-parker": "EP",
  "rajesh-patel": "RP",
  "margaret-thompson": "MT",
  "david-evans": "DE",
  "priya-sharma": "PS",
  "mary-summers": "MS",
};

export interface PlanGroup {
  depth: number;
  label: string;
  prerequisiteIds: string[];
  serviceIds: string[];
}

export interface LifeEventPlan {
  entryServiceIds: string[];
  groups: PlanGroup[];
  edges: Array<{ from: string; to: string; type: "REQUIRES" | "ENABLES" }>;
}

export interface LifeEventInfo {
  id: string;
  icon: string;
  name: string;
  desc: string;
  entryNodeCount: number;
  totalServiceCount: number;
  services: LifeEventService[];
  plan?: LifeEventPlan;
}

export interface LifeEventService {
  id: string;
  name: string;
  dept: string;
  serviceType: string;
  proactive: boolean;
  gated: boolean;
  desc: string;
  govuk_url: string;
  eligibility_summary: string;
}

// ── New types for citizen-02 ──

/** Unified timeline item merging data-driven upcoming dates with agent/user tasks */
export interface TimelineItem {
  id: string;
  title: string;
  subtitle?: string;
  daysUntil: number;
  dueLabel: string;
  urgency: "urgent" | "warning" | "ok" | "info";
  service: string;
  source: "data" | "agent" | "user";
  isLive?: boolean;
  taskStatus?: StoredTask["status"];
  taskType?: "agent" | "user";
  detail?: string;
  dueDate?: string;
}

/** A topic question for service detail views */
export interface TopicQuestion {
  id: string;
  topic: string;
  question: string;
  service: string;
}

/** MCP live data enrichment result */
export interface EnrichedData {
  enriched: boolean;
  postcode?: {
    admin_district: string;
    parliamentary_constituency: string;
    region: string;
  };
  mp?: {
    name: string;
    party: string;
    constituency: string;
  };
  floods?: {
    count: number;
    warnings: Array<{
      severity: string;
      description: string;
      area: string;
    }>;
  };
  bankHolidays?: Array<{
    title: string;
    date: string;
    daysUntil: number;
  }>;
}

/** Bottom sheet state management */
export type BottomSheetType =
  | "agent-selection"
  | "task-detail"
  | "topic-questions"
  | "filing-prompt"
  | null;

export interface BottomSheetState {
  type: BottomSheetType;
  data?: unknown;
}

/** Toast notification */
export interface ToastMessage {
  id: string;
  text: string;
}

// Simulated "today" for demo — makes upcoming dates interesting
export const DEMO_TODAY = new Date("2026-02-15");
