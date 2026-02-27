/**
 * 8 interaction types that describe *how* a citizen interacts with a service.
 * Complementary to serviceType (benefit, registration, obligation etc.) which
 * describes *what domain* the service is in.
 *
 * Each type has a state model template the LLM customises per service.
 */

export const INTERACTION_TYPES = [
  "license",
  "register",
  "portal",
  "application",
  "informational_hub",
  "appointment_booker",
  "task_list",
  "payment_service",
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

export interface InteractionTypeInfo {
  id: InteractionType;
  label: string;
  description: string;
  example: string;
  stateModelTemplate: {
    states: Array<{ id: string; type?: "initial" | "terminal"; receipt?: boolean }>;
    transitions: Array<{ from: string; to: string; trigger: string; condition?: string }>;
  };
}

export const INTERACTION_TYPE_MAP: Record<InteractionType, InteractionTypeInfo> = {
  license: {
    id: "license",
    label: "License",
    description: "Prove permission to do something. User applies, service verifies eligibility, then issues or refuses.",
    example: "Fishing licence, driving licence, TV licence",
    stateModelTemplate: {
      states: [
        { id: "not-started", type: "initial" },
        { id: "identity-verified" },
        { id: "eligibility-checked" },
        { id: "consent-given" },
        { id: "details-confirmed" },
        { id: "payment-made", receipt: true },
        { id: "issued", type: "terminal", receipt: true },
        { id: "refused", type: "terminal", receipt: true },
        { id: "handed-off", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
        { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
        { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent", condition: "eligible" },
        { from: "eligibility-checked", to: "refused", trigger: "reject", condition: "not-eligible" },
        { from: "eligibility-checked", to: "handed-off", trigger: "handoff", condition: "edge-case" },
        { from: "consent-given", to: "details-confirmed", trigger: "confirm-details" },
        { from: "details-confirmed", to: "payment-made", trigger: "make-payment" },
        { from: "payment-made", to: "issued", trigger: "issue-licence" },
      ],
    },
  },

  register: {
    id: "register",
    label: "Register",
    description: "Government needs a list. User submits details and gets registered.",
    example: "Voter registration, waste carrier registration, birth registration",
    stateModelTemplate: {
      states: [
        { id: "not-started", type: "initial" },
        { id: "identity-verified" },
        { id: "eligibility-checked" },
        { id: "consent-given" },
        { id: "details-submitted" },
        { id: "registered", type: "terminal", receipt: true },
        { id: "rejected", type: "terminal", receipt: true },
        { id: "handed-off", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
        { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
        { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent", condition: "eligible" },
        { from: "eligibility-checked", to: "rejected", trigger: "reject", condition: "not-eligible" },
        { from: "eligibility-checked", to: "handed-off", trigger: "handoff", condition: "edge-case" },
        { from: "consent-given", to: "details-submitted", trigger: "submit-details" },
        { from: "details-submitted", to: "registered", trigger: "confirm-registration" },
      ],
    },
  },

  portal: {
    id: "portal",
    label: "Portal",
    description: "Multiple services grouped together with persistent accounts. User logs in, navigates, and performs actions.",
    example: "Universal Credit journal, Student Loans portal, HMRC personal tax account",
    stateModelTemplate: {
      states: [
        { id: "not-started", type: "initial" },
        { id: "identity-verified" },
        { id: "consent-given" },
        { id: "account-accessed" },
        { id: "action-performed", receipt: true },
        { id: "completed", type: "terminal", receipt: true },
        { id: "handed-off", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
        { from: "identity-verified", to: "consent-given", trigger: "grant-consent" },
        { from: "consent-given", to: "account-accessed", trigger: "access-account" },
        { from: "account-accessed", to: "action-performed", trigger: "perform-action" },
        { from: "action-performed", to: "completed", trigger: "complete" },
        { from: "account-accessed", to: "handed-off", trigger: "handoff", condition: "edge-case" },
      ],
    },
  },

  application: {
    id: "application",
    label: "Application",
    description: "Collect information, check eligibility, assess, then make a decision with an outcome.",
    example: "Child Benefit, PIP, Blue Badge, passport",
    stateModelTemplate: {
      states: [
        { id: "not-started", type: "initial" },
        { id: "identity-verified" },
        { id: "eligibility-checked" },
        { id: "consent-given" },
        { id: "details-submitted" },
        { id: "assessment" },
        { id: "decision", receipt: true },
        { id: "completed", type: "terminal", receipt: true },
        { id: "rejected", type: "terminal", receipt: true },
        { id: "handed-off", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
        { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
        { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent", condition: "eligible" },
        { from: "eligibility-checked", to: "rejected", trigger: "reject", condition: "not-eligible" },
        { from: "eligibility-checked", to: "handed-off", trigger: "handoff", condition: "edge-case" },
        { from: "consent-given", to: "details-submitted", trigger: "submit-details" },
        { from: "details-submitted", to: "assessment", trigger: "begin-assessment" },
        { from: "assessment", to: "decision", trigger: "make-decision" },
        { from: "decision", to: "completed", trigger: "approve" },
        { from: "decision", to: "rejected", trigger: "reject-application" },
      ],
    },
  },

  informational_hub: {
    id: "informational_hub",
    label: "Informational Hub",
    description: "Help the user understand options and decide what's right. No transactional outcome — may refer to other services.",
    example: "Get into teaching, travel advice, Check what you can do if you're being bullied",
    stateModelTemplate: {
      states: [
        { id: "not-started", type: "initial" },
        { id: "browsing" },
        { id: "information-provided" },
        { id: "referred-to-service", type: "terminal", receipt: true },
        { id: "completed", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "browsing", trigger: "start-browsing" },
        { from: "browsing", to: "information-provided", trigger: "provide-information" },
        { from: "information-provided", to: "referred-to-service", trigger: "refer-to-service" },
        { from: "information-provided", to: "completed", trigger: "complete" },
      ],
    },
  },

  appointment_booker: {
    id: "appointment_booker",
    label: "Appointment Booker",
    description: "Book a slot after other prerequisites are done. Select time, confirm, attend.",
    example: "Prison visit booking, driving test, GP appointment",
    stateModelTemplate: {
      states: [
        { id: "not-started", type: "initial" },
        { id: "identity-verified" },
        { id: "eligibility-checked" },
        { id: "consent-given" },
        { id: "slot-selected" },
        { id: "booking-confirmed", receipt: true },
        { id: "attended", type: "terminal", receipt: true },
        { id: "cancelled", type: "terminal", receipt: true },
        { id: "handed-off", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
        { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
        { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent", condition: "eligible" },
        { from: "eligibility-checked", to: "handed-off", trigger: "handoff", condition: "not-eligible" },
        { from: "consent-given", to: "slot-selected", trigger: "select-slot" },
        { from: "slot-selected", to: "booking-confirmed", trigger: "confirm-booking" },
        { from: "booking-confirmed", to: "attended", trigger: "attend" },
        { from: "booking-confirmed", to: "cancelled", trigger: "cancel" },
      ],
    },
  },

  task_list: {
    id: "task_list",
    label: "Task List",
    description: "Sequential holistic actions the user works through, often over time. Steps must be completed in order.",
    example: "Learn to drive (step-by-step), Access to Work, Set up a limited company",
    stateModelTemplate: {
      states: [
        { id: "not-started", type: "initial" },
        { id: "identity-verified" },
        { id: "consent-given" },
        { id: "step-1-complete" },
        { id: "step-2-complete" },
        { id: "step-3-complete" },
        { id: "all-steps-complete", type: "terminal", receipt: true },
        { id: "handed-off", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
        { from: "identity-verified", to: "consent-given", trigger: "grant-consent" },
        { from: "consent-given", to: "step-1-complete", trigger: "complete-step-1" },
        { from: "step-1-complete", to: "step-2-complete", trigger: "complete-step-2" },
        { from: "step-2-complete", to: "step-3-complete", trigger: "complete-step-3" },
        { from: "step-3-complete", to: "all-steps-complete", trigger: "finish" },
        { from: "consent-given", to: "handed-off", trigger: "handoff", condition: "edge-case" },
      ],
    },
  },

  payment_service: {
    id: "payment_service",
    label: "Payment Service",
    description: "Verify identity or liability, calculate amount, then pay. Often follows an offline interaction.",
    example: "Self assessment tax, vehicle tax, congestion charge",
    stateModelTemplate: {
      states: [
        { id: "not-started", type: "initial" },
        { id: "identity-verified" },
        { id: "eligibility-checked" },
        { id: "consent-given" },
        { id: "amount-calculated", receipt: true },
        { id: "payment-made", receipt: true },
        { id: "completed", type: "terminal", receipt: true },
        { id: "handed-off", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
        { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
        { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent", condition: "eligible" },
        { from: "eligibility-checked", to: "handed-off", trigger: "handoff", condition: "not-eligible" },
        { from: "consent-given", to: "amount-calculated", trigger: "calculate-amount" },
        { from: "amount-calculated", to: "payment-made", trigger: "make-payment" },
        { from: "payment-made", to: "completed", trigger: "complete" },
      ],
    },
  },
};

/**
 * Infer interaction type from serviceType (domain-based) as a fallback
 * when CSV enrichment is not available.
 */
export function inferInteractionType(serviceType: string | null | undefined): InteractionType {
  if (!serviceType) return "application";

  const mapping: Record<string, InteractionType> = {
    benefit: "application",
    registration: "register",
    obligation: "payment_service",
    licence: "license",
    license: "license",
    information: "informational_hub",
    appointment: "appointment_booker",
    payment: "payment_service",
    tax: "payment_service",
    portal: "portal",
  };

  return mapping[serviceType.toLowerCase()] || "application";
}
