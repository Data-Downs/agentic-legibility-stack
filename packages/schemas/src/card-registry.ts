/**
 * Card Registry — Maps (interactionType, stateId) → CardDefinition[]
 *
 * Deterministic card resolution: given a service's interaction type and
 * current state, returns the cards that should be rendered. No LLM involvement.
 *
 * Services can override with custom card definitions in their artefacts (future).
 */

import type { CardDefinition, CardFieldDef } from "./card-types";

// ── Interaction Types (mirrored from legibility-studio for package independence) ──

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

// ── State-to-Card Mapping ──

export interface StateCardMapping {
  stateId: string;
  cards: CardDefinition[];
}

export interface InteractionCardSet {
  interactionType: InteractionType;
  mappings: StateCardMapping[];
}

// ── Reusable Field Definitions ──

const TENURE_FIELD: CardFieldDef = {
  key: "tenure_type",
  label: "What is your housing situation?",
  type: "radio",
  required: true,
  category: "housing",
  options: [
    { value: "private_renter", label: "Private renter" },
    { value: "council_tenant", label: "Council tenant" },
    { value: "homeowner", label: "Homeowner" },
    { value: "living_with_family", label: "Living with family" },
  ],
};

const MONTHLY_RENT_FIELD: CardFieldDef = {
  key: "monthly_rent",
  label: "Monthly rent (£)",
  type: "currency",
  required: true,
  placeholder: "e.g. 650",
  category: "housing",
  validation: { min: 0, max: 10000 },
  showWhen: { field: "tenure_type", values: ["private_renter", "council_tenant"] },
};

const SORT_CODE_FIELD: CardFieldDef = {
  key: "sort_code",
  label: "Sort code",
  type: "sort-code",
  required: true,
  placeholder: "e.g. 12-34-56",
  category: "financial",
  validation: { pattern: "^\\d{2}-?\\d{2}-?\\d{2}$", message: "Enter a valid 6-digit sort code" },
};

const ACCOUNT_NUMBER_FIELD: CardFieldDef = {
  key: "account_number",
  label: "Account number",
  type: "account-number",
  required: true,
  placeholder: "e.g. 12345678",
  category: "financial",
  validation: { pattern: "^\\d{6,8}$", message: "Enter a 6-8 digit account number" },
};

const BANK_NAME_FIELD: CardFieldDef = {
  key: "bank_name",
  label: "Bank name",
  type: "text",
  required: true,
  placeholder: "e.g. Barclays",
  category: "financial",
};

// ── Card Definitions ──

const HOUSEHOLD_DETAILS_CARD: CardDefinition = {
  cardType: "household-details",
  title: "Your housing situation",
  description: "We need to know about your housing to calculate your entitlement.",
  fields: [TENURE_FIELD, MONTHLY_RENT_FIELD],
  submitLabel: "Confirm housing details",
  dataCategory: "housing",
};

const FINANCIAL_DETAILS_CARD: CardDefinition = {
  cardType: "financial-details",
  title: "Your income details",
  description: "Tell us about your income sources.",
  fields: [
    {
      key: "employment_status",
      label: "Employment status",
      type: "radio",
      required: true,
      category: "employment",
      options: [
        { value: "employed", label: "Employed" },
        { value: "self_employed", label: "Self-employed" },
        { value: "unemployed", label: "Unemployed" },
        { value: "unable_to_work", label: "Unable to work" },
      ],
    },
    {
      key: "monthly_income",
      label: "Monthly income (£)",
      type: "currency",
      required: false,
      placeholder: "e.g. 1200",
      category: "financial",
      validation: { min: 0 },
      showWhen: { field: "employment_status", values: ["employed", "self_employed"] },
    },
    {
      key: "savings_amount",
      label: "Total savings (£)",
      type: "currency",
      required: false,
      placeholder: "e.g. 500",
      category: "financial",
      validation: { min: 0 },
    },
  ],
  submitLabel: "Confirm income details",
  dataCategory: "financial",
};

const BANK_ACCOUNT_CARD: CardDefinition = {
  cardType: "bank-account-selector",
  title: "Payment account",
  description: "Choose which account you'd like payments sent to.",
  fields: [BANK_NAME_FIELD, SORT_CODE_FIELD, ACCOUNT_NUMBER_FIELD],
  submitLabel: "Confirm bank account",
  dataCategory: "financial",
};

const LICENSE_DETAILS_CARD: CardDefinition = {
  cardType: "license-details",
  title: "Licence details",
  description: "Confirm the details for your licence.",
  fields: [
    {
      key: "licence_type",
      label: "Licence type",
      type: "select",
      required: true,
      category: "licence",
      options: [
        { value: "standard", label: "Standard" },
        { value: "premium", label: "Premium" },
      ],
    },
    {
      key: "licence_duration",
      label: "Duration",
      type: "select",
      required: true,
      category: "licence",
      options: [
        { value: "1_day", label: "1 day" },
        { value: "1_year", label: "1 year" },
        { value: "3_year", label: "3 years" },
        { value: "lifetime", label: "Lifetime" },
      ],
    },
    {
      key: "start_date",
      label: "Start date",
      type: "date",
      required: true,
      category: "licence",
    },
  ],
  submitLabel: "Confirm licence details",
  dataCategory: "licence",
};

const PAYMENT_CARD: CardDefinition = {
  cardType: "payment-card",
  title: "Make payment",
  description: "Confirm your payment details.",
  fields: [
    {
      key: "payment_method",
      label: "Payment method",
      type: "radio",
      required: true,
      category: "payment",
      options: [
        { value: "debit_card", label: "Debit card" },
        { value: "credit_card", label: "Credit card" },
        { value: "direct_debit", label: "Direct debit" },
      ],
    },
  ],
  submitLabel: "Confirm payment",
  dataCategory: "payment",
};

const REGISTRATION_DETAILS_CARD: CardDefinition = {
  cardType: "registration-details",
  title: "Registration details",
  description: "Provide the details needed for your registration.",
  fields: [
    {
      key: "registration_reference",
      label: "Reference number (if you have one)",
      type: "text",
      required: false,
      placeholder: "e.g. REF-12345",
      category: "registration",
    },
  ],
  submitLabel: "Submit registration details",
  dataCategory: "registration",
};

const PORTAL_ACTION_CARD: CardDefinition = {
  cardType: "portal-action",
  title: "What would you like to do?",
  description: "Choose an action to perform on your account.",
  fields: [
    {
      key: "action_type",
      label: "Action",
      type: "radio",
      required: true,
      category: "portal",
      options: [
        { value: "report_change", label: "Report a change of circumstances" },
        { value: "upload_document", label: "Upload a document" },
        { value: "send_message", label: "Send a message to your work coach" },
        { value: "view_statement", label: "View your payment statement" },
      ],
    },
    {
      key: "action_details",
      label: "Details",
      type: "text",
      required: false,
      placeholder: "Any additional details...",
      category: "portal",
    },
  ],
  submitLabel: "Continue",
  dataCategory: "portal",
};

const CHANGE_OF_CIRCUMSTANCES_CARD: CardDefinition = {
  cardType: "change-of-circumstances",
  title: "Report a change",
  description: "Tell us what has changed.",
  fields: [
    {
      key: "change_type",
      label: "What has changed?",
      type: "radio",
      required: true,
      category: "portal",
      options: [
        { value: "address", label: "Address" },
        { value: "income", label: "Income" },
        { value: "household", label: "Household members" },
        { value: "health", label: "Health condition" },
        { value: "other", label: "Something else" },
      ],
    },
    {
      key: "change_details",
      label: "Tell us more",
      type: "text",
      required: true,
      placeholder: "Describe the change...",
      category: "portal",
    },
  ],
  submitLabel: "Report change",
  dataCategory: "portal",
};

const SLOT_PICKER_CARD: CardDefinition = {
  cardType: "slot-picker",
  title: "Choose an appointment",
  description: "Select a date and time for your appointment.",
  fields: [
    {
      key: "appointment_date",
      label: "Preferred date",
      type: "date",
      required: true,
      category: "appointment",
    },
    {
      key: "appointment_time",
      label: "Preferred time",
      type: "select",
      required: true,
      category: "appointment",
      options: [
        { value: "09:00", label: "9:00 AM" },
        { value: "10:00", label: "10:00 AM" },
        { value: "11:00", label: "11:00 AM" },
        { value: "13:00", label: "1:00 PM" },
        { value: "14:00", label: "2:00 PM" },
        { value: "15:00", label: "3:00 PM" },
      ],
    },
    {
      key: "appointment_location",
      label: "Location",
      type: "select",
      required: true,
      category: "appointment",
      options: [
        { value: "nearest", label: "Nearest available" },
        { value: "specific", label: "Specific location" },
      ],
    },
  ],
  submitLabel: "Book appointment",
  dataCategory: "appointment",
};

const PAYMENT_AMOUNT_CARD: CardDefinition = {
  cardType: "payment-amount",
  title: "Amount due",
  description: "Review the amount you need to pay.",
  fields: [
    {
      key: "amount_due",
      label: "Amount",
      type: "readonly",
      required: false,
      category: "payment",
    },
  ],
  submitLabel: "Proceed to payment",
  dataCategory: "payment",
};

const CHECKLIST_PROGRESS_CARD: CardDefinition = {
  cardType: "checklist-progress",
  title: "Your progress",
  description: "Check off each step as you complete it.",
  fields: [
    {
      key: "steps_completed",
      label: "Steps",
      type: "checklist",
      required: false,
      category: "task_list",
      options: [
        { value: "step_1", label: "Step 1" },
        { value: "step_2", label: "Step 2" },
        { value: "step_3", label: "Step 3" },
      ],
    },
  ],
  submitLabel: "Update progress",
  dataCategory: "task_list",
};

const DECISION_HELPER_CARD: CardDefinition = {
  cardType: "decision-helper",
  title: "Your options",
  description: "Review the available options and choose one.",
  fields: [
    {
      key: "selected_option",
      label: "Choose an option",
      type: "radio",
      required: true,
      category: "informational",
      options: [
        { value: "option_a", label: "Option A" },
        { value: "option_b", label: "Option B" },
        { value: "need_more_info", label: "I need more information" },
      ],
    },
  ],
  submitLabel: "Continue",
  dataCategory: "informational",
};

// ── Template Card Definitions (generic, per-interaction-type) ──

const APPLICATION_ELIGIBILITY_CARD: CardDefinition = {
  cardType: "application-eligibility",
  title: "Your circumstances",
  description: "We need some details to assess your application.",
  fields: [
    {
      key: "employment_status",
      label: "Employment status",
      type: "radio",
      required: true,
      category: "employment",
      options: [
        { value: "employed", label: "Employed" },
        { value: "self_employed", label: "Self-employed" },
        { value: "unemployed", label: "Unemployed" },
        { value: "retired", label: "Retired" },
        { value: "student", label: "Student" },
        { value: "unable_to_work", label: "Unable to work" },
      ],
    },
    {
      key: "monthly_income",
      label: "Monthly household income (£)",
      type: "currency",
      required: false,
      placeholder: "e.g. 1200",
      category: "financial",
      validation: { min: 0 },
      showWhen: { field: "employment_status", values: ["employed", "self_employed"] },
    },
  ],
  submitLabel: "Confirm details",
  dataCategory: "employment",
};

const REGISTRATION_EVENT_CARD: CardDefinition = {
  cardType: "registration-event",
  title: "Event details",
  description: "Provide the details of the event you are registering.",
  fields: [
    {
      key: "event_date",
      label: "Date of event",
      type: "date",
      required: true,
      category: "registration",
    },
    {
      key: "event_location",
      label: "Location",
      type: "text",
      required: true,
      placeholder: "e.g. St Mary's Hospital, London",
      category: "registration",
    },
    {
      key: "additional_notes",
      label: "Additional information",
      type: "text",
      required: false,
      placeholder: "Any other relevant details",
      category: "registration",
    },
  ],
  submitLabel: "Submit registration details",
  dataCategory: "registration",
};

/**
 * Template card registry — interaction-type-appropriate cards for graph services.
 * These are more generic than the static registry (which is tuned for hand-crafted services).
 */
const TEMPLATE_CARD_REGISTRY: InteractionCardSet[] = [
  {
    interactionType: "application",
    mappings: [
      { stateId: "details-submitted", cards: [APPLICATION_ELIGIBILITY_CARD] },
    ],
  },
  {
    interactionType: "register",
    mappings: [
      { stateId: "details-submitted", cards: [REGISTRATION_EVENT_CARD] },
    ],
  },
  {
    interactionType: "license",
    mappings: [
      { stateId: "details-confirmed", cards: [LICENSE_DETAILS_CARD] },
      { stateId: "payment-made", cards: [PAYMENT_CARD] },
    ],
  },
  {
    interactionType: "payment_service",
    mappings: [
      { stateId: "amount-calculated", cards: [PAYMENT_AMOUNT_CARD] },
      { stateId: "payment-made", cards: [PAYMENT_CARD] },
    ],
  },
  {
    interactionType: "appointment_booker",
    mappings: [
      { stateId: "slot-selected", cards: [SLOT_PICKER_CARD] },
    ],
  },
  {
    interactionType: "portal",
    mappings: [
      { stateId: "action-performed", cards: [PORTAL_ACTION_CARD] },
    ],
  },
  {
    interactionType: "task_list",
    mappings: [
      { stateId: "step-1-complete", cards: [CHECKLIST_PROGRESS_CARD] },
      { stateId: "step-2-complete", cards: [CHECKLIST_PROGRESS_CARD] },
      { stateId: "step-3-complete", cards: [CHECKLIST_PROGRESS_CARD] },
    ],
  },
  {
    interactionType: "informational_hub",
    mappings: [
      { stateId: "information-provided", cards: [DECISION_HELPER_CARD] },
    ],
  },
];

// ── Static Interaction Type → State → Cards Mappings (hand-crafted services) ──

const CARD_REGISTRY: InteractionCardSet[] = [
  {
    interactionType: "application",
    mappings: [
      // UC-specific states (hand-crafted state model — uses these unique state IDs)
      {
        stateId: "personal-details-collected",
        cards: [HOUSEHOLD_DETAILS_CARD],
      },
      {
        stateId: "income-details-collected",
        cards: [BANK_ACCOUNT_CARD],
      },
    ],
  },
  {
    interactionType: "license",
    mappings: [
      {
        stateId: "details-confirmed",
        cards: [LICENSE_DETAILS_CARD],
      },
      {
        stateId: "payment-made",
        cards: [PAYMENT_CARD],
      },
    ],
  },
  {
    interactionType: "register",
    mappings: [
      {
        stateId: "details-submitted",
        cards: [REGISTRATION_DETAILS_CARD],
      },
    ],
  },
  {
    interactionType: "portal",
    mappings: [
      {
        stateId: "action-performed",
        cards: [PORTAL_ACTION_CARD],
      },
      {
        stateId: "change-reported",
        cards: [CHANGE_OF_CIRCUMSTANCES_CARD],
      },
    ],
  },
  {
    interactionType: "appointment_booker",
    mappings: [
      {
        stateId: "slot-selected",
        cards: [SLOT_PICKER_CARD],
      },
    ],
  },
  {
    interactionType: "payment_service",
    mappings: [
      {
        stateId: "amount-calculated",
        cards: [PAYMENT_AMOUNT_CARD],
      },
      {
        stateId: "payment-made",
        cards: [PAYMENT_CARD],
      },
    ],
  },
  {
    interactionType: "task_list",
    mappings: [
      {
        stateId: "step-1-complete",
        cards: [CHECKLIST_PROGRESS_CARD],
      },
      {
        stateId: "step-2-complete",
        cards: [CHECKLIST_PROGRESS_CARD],
      },
      {
        stateId: "step-3-complete",
        cards: [CHECKLIST_PROGRESS_CARD],
      },
    ],
  },
  {
    interactionType: "informational_hub",
    mappings: [
      {
        stateId: "information-provided",
        cards: [DECISION_HELPER_CARD],
      },
    ],
  },
];

// ── Resolver ──

/** Look up cards from a registry array */
function findInRegistry(registry: InteractionCardSet[], interactionType: string, stateId: string): CardDefinition[] | null {
  const cardSet = registry.find((cs) => cs.interactionType === interactionType);
  if (!cardSet) return null;
  const mapping = cardSet.mappings.find((m) => m.stateId === stateId);
  return mapping ? mapping.cards : null;
}

/**
 * Resolve which cards to show for a given interaction type and state.
 * Uses only the static registry (for backward compatibility).
 */
export function resolveCards(
  interactionType: string,
  stateId: string,
  _serviceId?: string,
): CardDefinition[] {
  return findInRegistry(CARD_REGISTRY, interactionType, stateId) ?? [];
}

/**
 * Resolve cards with 3-level resolution chain:
 *
 * 1. Per-service DB overrides (from Studio)
 * 2. Template cards (interaction-type-appropriate for graph services)
 * 3. Static registry fallback (hand-crafted service cards)
 *
 * The 3 hand-crafted services (UC, driving, pension) hit level 3 because
 * they don't have DB overrides and their static registry entries are
 * more specific than template cards.
 */
export function resolveCardsWithOverrides(
  interactionType: string,
  stateId: string,
  serviceId?: string,
  serviceOverrides?: StateCardMapping[] | null,
): CardDefinition[] {
  // 1. Per-service DB overrides
  if (serviceOverrides && serviceOverrides.length > 0) {
    const override = serviceOverrides.find((m) => m.stateId === stateId);
    if (override) return override.cards;
  }

  // 2. Static registry (hand-crafted service-specific cards — UC, driving, pension)
  const staticCards = findInRegistry(CARD_REGISTRY, interactionType, stateId);
  if (staticCards) return staticCards;

  // 3. Template cards fallback (generic interaction-type-appropriate for graph services)
  return findInRegistry(TEMPLATE_CARD_REGISTRY, interactionType, stateId) ?? [];
}

/**
 * Infer interaction type from a service's serviceType field.
 * Duplicated here to avoid cross-package dependency on legibility-studio.
 */
export function inferInteractionType(serviceType: string | null | undefined): InteractionType {
  if (!serviceType) return "application";

  const mapping: Record<string, InteractionType> = {
    benefit: "application",
    registration: "register",
    obligation: "payment_service",
    licence: "license",
    license: "license",
    document: "license",
    information: "informational_hub",
    appointment: "appointment_booker",
    test: "appointment_booker",
    payment: "payment_service",
    tax: "payment_service",
    grant: "application",
    entitlement: "application",
    portal: "portal",
  };

  return mapping[serviceType.toLowerCase()] || "application";
}
