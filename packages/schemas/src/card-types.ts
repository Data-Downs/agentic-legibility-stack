/**
 * Card Types — JSON-serializable definitions for dynamic task cards.
 *
 * Cards are data: resolved per-service from (interactionType, stateId),
 * rendered by GenericFormCard, and submitted directly to Tier 2 personal data.
 */

export type CardFieldType =
  | "text"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "address"
  | "currency"
  | "sort-code"
  | "account-number"
  | "readonly"
  | "checklist";

export interface CardFieldDef {
  /** Maps to submitted_data field_key */
  key: string;
  label: string;
  type: CardFieldType;
  required?: boolean;
  placeholder?: string;
  /** For select/radio/checklist fields */
  options?: Array<{ value: string; label: string }>;
  /** Tier 1/2 field path for pre-fill (e.g., "address.postcode") */
  prefillFrom?: string;
  /** submitted_data category (e.g., "financial", "housing") */
  category?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  /** Show this field only when another field has a specific value */
  showWhen?: {
    field: string;
    values: string[];
  };
}

export interface CardDefinition {
  /** Unique card type identifier, e.g. "household-details" */
  cardType: string;
  /** Display title, e.g. "Your housing situation" */
  title: string;
  description?: string;
  fields: CardFieldDef[];
  submitLabel?: string;
  /** Link to consent grant this card serves */
  consentGrantId?: string;
  /** Category for submitted_data (e.g., "housing", "financial") */
  dataCategory: string;
}

/** Sent from chat API to client — tells the UI which cards to render */
export interface CardRequest {
  cardType: string;
  serviceId: string;
  /** Which state model state triggered this card */
  stateId: string;
  /** Full card spec for rendering */
  definition: CardDefinition;
}

/** Sent from client to card-submit API */
export interface CardSubmission {
  cardType: string;
  serviceId: string;
  stateId: string;
  /** field key → value */
  fields: Record<string, string | number | boolean>;
}
