/** Core types for the citizen experience app */

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

export interface AgentTask {
  id: string;
  description: string;
  detail: string;
  type: "agent" | "user";
  dueDate: string | null;
  dataNeeded: string[];
  options?: Array<{ value: string; label: string }>;
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
  /** Persisted state machine state */
  ucState?: string;
  /** Persisted state machine history */
  ucStateHistory?: string[];
  /** Persisted interaction type (for dynamic milestones) */
  interactionType?: string;
  /** Persisted tasks from the last API response */
  tasks?: AgentTask[];
  /** Persisted task completion messages */
  taskCompletions?: Record<string, string>;
  /** Whether tasks were submitted */
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
  id: string;                    // "plan_retiring_1709472000000"
  lifeEventId: string;           // "retiring"
  lifeEventName: string;
  lifeEventIcon: string;
  startedAt: string;
  updatedAt: string;
  serviceProgress: Record<string, ServicePlanStatus>;
  serviceConversations: Record<string, string>;  // serviceId → conversationId
  plan: LifeEventPlan;           // snapshot of groups/edges
  services: LifeEventService[];  // snapshot of service metadata
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
  edges: Array<{ from: string; to: string; type: 'REQUIRES' | 'ENABLES' }>;
}

/** A life event from the service graph */
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

/** A service within a life event */
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


// Simulated "today" for demo — makes upcoming dates interesting
export const DEMO_TODAY = new Date("2026-02-15");
