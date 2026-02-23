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
  createdAt: string;
  updatedAt: string;
}

export type AgentType = "dot" | "max";
export type ServiceType = "driving" | "benefits" | "family" | (string & {});
export type ScenarioType = "driving" | "benefits" | "parenting";
export type ViewType =
  | "persona-picker"
  | "dashboard"
  | "detail"
  | "chat"
  | "tasks";

export const PERSONA_NAMES: Record<string, string> = {
  "emma-liam": "Emma & Liam",
  rajesh: "Rajesh Patel",
  margaret: "Margaret Thompson",
  priya: "Priya Sharma",
};

export const PERSONA_COLORS: Record<string, string> = {
  "emma-liam": "#1d70b8",
  rajesh: "#00703c",
  margaret: "#912b88",
  priya: "#d4351c",
};

export const PERSONA_INITIALS: Record<string, string> = {
  "emma-liam": "E",
  rajesh: "R",
  margaret: "M",
  priya: "P",
};

export const SERVICE_TITLES: Record<string, string> = {
  driving: "Driving",
  benefits: "Benefits & money",
  family: "Family",
};

export const SERVICE_TO_SCENARIO: Record<string, ScenarioType> = {
  driving: "driving",
  benefits: "benefits",
  family: "parenting",
};

/** Default service for each persona — used when no service is explicitly selected */
export const PERSONA_DEFAULT_SERVICE: Record<string, ServiceType> = {
  "emma-liam": "driving",
  rajesh: "driving",
  margaret: "family",
  priya: "benefits",
};

/** Get a display title for a service — checks known titles first, falls back to manifest name */
export function getServiceTitle(serviceKey: string, manifestName?: string): string {
  return SERVICE_TITLES[serviceKey] || manifestName || serviceKey;
}

// Simulated "today" for demo — makes upcoming dates interesting
export const DEMO_TODAY = new Date("2026-02-15");
