/**
 * State Instruction Templates — per interaction type.
 *
 * Provides deterministic LLM guidance for graph-only services that don't have
 * hand-crafted state-instructions.json. Templates use {placeholders} resolved
 * at runtime from graph node data.
 *
 * Loading chain (in chat route):
 *   1. Try service-specific file: data/services/{slug}/state-instructions.json
 *   2. Try bundled data (service-store / Cloudflare)
 *   3. Template fallback: infer interactionType → resolve template with service context
 */

import type { StateModelDefinition, StateInstructions } from "./index";
import type { InteractionType } from "./card-registry";

// ── Template context (resolved from graph node at runtime) ──

export interface TemplateContext {
  serviceName: string;
  department: string;
  govukUrl: string;
  eligibilitySummary: string;
  serviceId: string;
}

// ── Template type ──

export interface StateInstructionTemplate {
  version: string;
  instructions: Record<string, string>;
  forcedTransitions?: Record<string, string>;
  autoTransitions?: Array<{
    fromState: string;
    trigger: string;
    pattern: string;
  }>;
}

// ── Shared instruction fragments ──

const SHARED = {
  notStarted: (type: string) =>
    `The citizen has just started the {serviceName} ${type} with {department}.

CRITICAL — IDENTITY IS ALREADY VERIFIED:
The citizen is already authenticated via GOV.UK One Login. Identity verification is COMPLETE.
Do NOT mention identity verification, One Login, or "verifying who you are" — it is DONE.

WHAT TO DO IN THIS RESPONSE:
1. Welcome them warmly
2. Briefly explain what {serviceName} is (1-2 sentences)
3. Present the eligibility summary: {eligibilitySummary}
4. If eligible, explain that you need their consent to share certain data with {department} before proceeding
5. Tell them that interactive consent cards will appear below for them to review and approve

Set "stateTransition" to "check-eligibility" in the JSON block.
Do NOT skip ahead — complete this step only.
Do NOT include any tasks in the JSON block — the eligibility check is automatic, not a task.`,

  identityVerified:
    `Identity has already been verified via GOV.UK One Login — do NOT mention identity verification again.
Check eligibility and present the results using the POLICY EVALUATION section above.
If eligible, explain that consent is needed next — interactive consent cards will appear below.
Set "stateTransition" to "check-eligibility" in the JSON block.
Do NOT include any tasks in the JSON block.
Do NOT discuss later steps yet.`,

  eligibilityChecked:
    `Eligibility has already been checked and results were presented.
The citizen is now reviewing consent cards that appeared below your previous message.

If the citizen's message contains consent decisions (granted/denied) OR indicates agreement to proceed (e.g. "yes", "go ahead", "I consent", "proceed"):
  - Acknowledge their consent, thank them
  - Present their personal details for confirmation using ACTUAL data from the DATA ON FILE section: full name, DOB, NI number, address
  - Ask "Does everything look correct?"
  - Set "stateTransition" to "grant-consent" in the JSON block

If the citizen asks a question or provides other information:
  - Answer their question helpfully
  - Gently remind them to review and approve the consent cards below before proceeding
  - Do NOT set a stateTransition

Do NOT re-explain eligibility — it's already done.
Do NOT mention identity verification — it's already done.
Do NOT include any tasks in the JSON block.`,

  rejected: (entity: string) =>
    `The ${entity} was not successful. Explain why clearly and sympathetically.
Mention:
- The citizen may be able to request a review of the decision
- They can contact {department} directly for more information
- GOV.UK page for reference: {govukUrl}
This is the FINAL message — do NOT ask follow-up questions.
Do NOT include any tasks in the JSON block.`,

  handedOff:
    `This case has been referred to a human advisor for further review.
Explain why, and provide:
- The citizen should contact {department} directly
- GOV.UK page for reference: {govukUrl}
This is the FINAL message — do NOT ask follow-up questions.
Do NOT include any tasks in the JSON block.`,
};

// ── Application template (benefit, grant, etc.) ──

const APPLICATION_TEMPLATE: StateInstructionTemplate = {
  version: "1.0.0",
  instructions: {
    "not-started": SHARED.notStarted("application"),
    "identity-verified": SHARED.identityVerified,
    "eligibility-checked": SHARED.eligibilityChecked,
    "consent-given": `Consent has been granted and personal details have been confirmed from records.
Thank the citizen for granting consent. Confirm you have their personal details on file (name, DOB, NI number, address — list them briefly).
Explain that you now need to collect the details required for their {serviceName} application.
An interactive form will appear below for them to fill in.
Do NOT include any tasks in the JSON block — the system provides the form automatically.`,
    "details-submitted": `Details have been submitted.
Acknowledge the information the citizen provided. Summarise the key details back to them.
Explain that {department} will now assess their application.
Set "stateTransition" to "begin-assessment" in the JSON block.
Do NOT fabricate timelines or reference numbers — say "{department} will confirm."`,
    "assessment": `The application is being assessed by {department}.
Tell the citizen:
- Their application has been submitted to {department} for assessment
- They will be contacted with the outcome
- Processing times vary — {department} will confirm the timeline
Set "stateTransition" to "make-decision" in the JSON block.`,
    "decision": `A decision has been made on the application.
If approved: Congratulate the citizen and explain next steps. Set "stateTransition" to "approve".
If rejected: Explain the reason sympathetically. Set "stateTransition" to "reject-application".
Do NOT fabricate specific amounts, dates, or reference numbers — say "{department} will confirm these details."`,
    "completed": `The application has been approved! Congratulate them warmly.
Explain:
- {department} will confirm specific details (amounts, dates, reference numbers) directly
- The citizen should check their email and post for official correspondence
- They can visit {govukUrl} for more information
This is the FINAL message — do NOT ask follow-up questions.
Do NOT include any tasks in the JSON block.`,
    "rejected": SHARED.rejected("application"),
    "handed-off": SHARED.handedOff,
  },
  forcedTransitions: {
    "not-started": "verify-identity",
    "identity-verified": "check-eligibility",
  },
  autoTransitions: [
    {
      fromState: "eligibility-checked",
      trigger: "grant-consent",
      pattern: "I have reviewed all consent|consent.*granted|granted.*consent|please proceed|I consent|go ahead|yes.*proceed|agree|done|let's go|ready|start|apply",
    },
    {
      fromState: "consent-given",
      trigger: "submit-details",
      pattern: "everything.*correct|looks correct|details.*correct|yes.*correct|confirm|that's right|all correct",
    },
  ],
};

// ── License template ──

const LICENSE_TEMPLATE: StateInstructionTemplate = {
  version: "1.0.0",
  instructions: {
    "not-started": SHARED.notStarted("licence application"),
    "identity-verified": SHARED.identityVerified,
    "eligibility-checked": SHARED.eligibilityChecked,
    "consent-given": `Consent has been granted. Confirm you have their personal details on file.
Explain that you need to confirm the details for their {serviceName} licence.
Present their details from records for confirmation.
Ask "Does everything look correct?"
Do NOT include any tasks in the JSON block.`,
    "details-confirmed": `Details have been confirmed.
Explain that payment is needed to complete the {serviceName} application.
A payment form will appear below.
Do NOT include any tasks in the JSON block — the system provides the payment card automatically.`,
    "payment-made": `Payment has been processed.
Tell the citizen their {serviceName} application is being processed by {department}.
Explain:
- {department} will issue the licence once processing is complete
- They will be contacted with delivery details
Set "stateTransition" to "issue-licence" in the JSON block.
Do NOT fabricate specific dates or reference numbers.`,
    "issued": `The licence has been issued! Congratulate them.
Explain:
- {department} will send the licence to their registered address
- They can visit {govukUrl} to check status
This is the FINAL message — do NOT ask follow-up questions.
Do NOT include any tasks in the JSON block.`,
    "refused": SHARED.rejected("licence application"),
    "handed-off": SHARED.handedOff,
  },
  forcedTransitions: {
    "not-started": "verify-identity",
    "identity-verified": "check-eligibility",
  },
  autoTransitions: [
    {
      fromState: "eligibility-checked",
      trigger: "grant-consent",
      pattern: "I have reviewed all consent|consent.*granted|granted.*consent|please proceed|I consent|go ahead|yes.*proceed|agree|done|let's go|ready",
    },
    {
      fromState: "consent-given",
      trigger: "confirm-details",
      pattern: "everything.*correct|looks correct|details.*correct|yes.*correct|confirm|that's right|all correct",
    },
  ],
};

// ── Register template ──

const REGISTER_TEMPLATE: StateInstructionTemplate = {
  version: "1.0.0",
  instructions: {
    "not-started": SHARED.notStarted("registration"),
    "identity-verified": SHARED.identityVerified,
    "eligibility-checked": SHARED.eligibilityChecked,
    "consent-given": `Consent has been granted. Confirm you have their personal details on file.
Explain that you now need to collect the details required for their {serviceName} registration.
An interactive form will appear below for them to fill in.
Do NOT include any tasks in the JSON block.`,
    "details-submitted": `Details have been submitted.
Acknowledge the information provided. Summarise the key details back to them.
Tell them {department} will process their registration.
Set "stateTransition" to "confirm-registration" in the JSON block.`,
    "registered": `The registration is complete! Confirm their {serviceName} registration.
Explain:
- {department} will send confirmation to their registered details
- They can visit {govukUrl} for more information
This is the FINAL message — do NOT ask follow-up questions.
Do NOT include any tasks in the JSON block.`,
    "rejected": SHARED.rejected("registration"),
    "handed-off": SHARED.handedOff,
  },
  forcedTransitions: {
    "not-started": "verify-identity",
    "identity-verified": "check-eligibility",
  },
  autoTransitions: [
    {
      fromState: "eligibility-checked",
      trigger: "grant-consent",
      pattern: "I have reviewed all consent|consent.*granted|granted.*consent|please proceed|I consent|go ahead|yes.*proceed|agree|done|let's go|ready",
    },
    {
      fromState: "consent-given",
      trigger: "submit-details",
      pattern: "everything.*correct|looks correct|details.*correct|yes.*correct|confirm|that's right|all correct",
    },
  ],
};

// ── Portal template ──

const PORTAL_TEMPLATE: StateInstructionTemplate = {
  version: "1.0.0",
  instructions: {
    "not-started": `The citizen wants to access {serviceName} via {department}.

CRITICAL — IDENTITY IS ALREADY VERIFIED:
The citizen is already authenticated via GOV.UK One Login. Identity verification is COMPLETE.
Do NOT mention identity verification.

WHAT TO DO:
1. Welcome them
2. Explain what they can do on {serviceName}
3. Explain that you need their consent to access their account on their behalf
4. Tell them consent cards will appear below

Set "stateTransition" to "grant-consent" in the JSON block.
Do NOT include any tasks in the JSON block.`,
    "identity-verified": `Identity verified. Now request consent to access the portal on their behalf.
Consent cards will appear below.
Set "stateTransition" to "grant-consent" in the JSON block.`,
    "consent-given": `Consent granted. Accessing the citizen's {serviceName} account.
Explain what's available and ask what they'd like to do.
An action picker will appear below.
Do NOT include any tasks in the JSON block.`,
    "account-accessed": `The citizen's account has been accessed.
Help them perform the action they selected. Provide relevant information from their account.
When the action is complete, set "stateTransition" to "perform-action" in the JSON block.`,
    "action-performed": `The action has been performed. Confirm what was done.
Ask if there's anything else they'd like to do, or set "stateTransition" to "complete".`,
    "completed": `All actions are complete.
Summarise what was done in this session.
This is the FINAL message — do NOT ask follow-up questions.
Do NOT include any tasks in the JSON block.`,
    "handed-off": SHARED.handedOff,
  },
  forcedTransitions: {
    "not-started": "verify-identity",
  },
  autoTransitions: [
    {
      fromState: "identity-verified",
      trigger: "grant-consent",
      pattern: "I consent|go ahead|yes|proceed|agree",
    },
  ],
};

// ── Payment Service template ──

const PAYMENT_SERVICE_TEMPLATE: StateInstructionTemplate = {
  version: "1.0.0",
  instructions: {
    "not-started": SHARED.notStarted("payment"),
    "identity-verified": SHARED.identityVerified,
    "eligibility-checked": SHARED.eligibilityChecked,
    "consent-given": `Consent has been granted.
Explain that {department} will now calculate the amount due for {serviceName}.
Set "stateTransition" to "calculate-amount" in the JSON block.
Do NOT include any tasks in the JSON block.`,
    "amount-calculated": `The amount has been calculated.
Present the amount to the citizen (use data from the system, do NOT fabricate amounts).
Explain payment options and that a payment form will appear below.
Do NOT include any tasks in the JSON block — the system provides the payment card automatically.`,
    "payment-made": `Payment has been processed successfully.
Thank the citizen. Explain:
- {department} will send a confirmation receipt
- They can visit {govukUrl} for reference
Set "stateTransition" to "complete" in the JSON block.`,
    "completed": `Payment is complete! Confirm the payment.
Explain:
- {department} will send official confirmation
- They can visit {govukUrl} for more information
This is the FINAL message — do NOT ask follow-up questions.
Do NOT include any tasks in the JSON block.`,
    "handed-off": SHARED.handedOff,
  },
  forcedTransitions: {
    "not-started": "verify-identity",
    "identity-verified": "check-eligibility",
  },
  autoTransitions: [
    {
      fromState: "eligibility-checked",
      trigger: "grant-consent",
      pattern: "I have reviewed all consent|consent.*granted|please proceed|I consent|go ahead|yes.*proceed|agree|done|ready",
    },
  ],
};

// ── Appointment Booker template ──

const APPOINTMENT_BOOKER_TEMPLATE: StateInstructionTemplate = {
  version: "1.0.0",
  instructions: {
    "not-started": SHARED.notStarted("appointment booking"),
    "identity-verified": SHARED.identityVerified,
    "eligibility-checked": SHARED.eligibilityChecked,
    "consent-given": `Consent has been granted.
Explain that they can now select an appointment slot for {serviceName}.
A slot picker card will appear below.
Do NOT include any tasks in the JSON block — the system provides the slot picker automatically.`,
    "slot-selected": `The citizen has selected an appointment slot.
Confirm the date, time, and location they chose.
Ask them to confirm the booking.
When confirmed, set "stateTransition" to "confirm-booking" in the JSON block.`,
    "booking-confirmed": `The appointment has been booked!
Tell the citizen:
- The date, time, and location of their appointment
- What to bring (ID, relevant documents)
- How to cancel or reschedule if needed
- {department} will send a confirmation
Set "stateTransition" to "attend" when the appointment is attended.
Do NOT include any tasks in the JSON block.`,
    "attended": `The appointment has been attended.
Confirm that their {serviceName} appointment is complete.
This is the FINAL message — do NOT ask follow-up questions.`,
    "cancelled": `The appointment has been cancelled.
Confirm the cancellation and explain how to rebook if needed.
This is the FINAL message — do NOT ask follow-up questions.`,
    "handed-off": SHARED.handedOff,
  },
  forcedTransitions: {
    "not-started": "verify-identity",
    "identity-verified": "check-eligibility",
  },
  autoTransitions: [
    {
      fromState: "eligibility-checked",
      trigger: "grant-consent",
      pattern: "I have reviewed all consent|consent.*granted|please proceed|I consent|go ahead|yes.*proceed|agree|done|ready",
    },
    {
      fromState: "slot-selected",
      trigger: "confirm-booking",
      pattern: "confirm|yes|book it|go ahead|that works|perfect",
    },
  ],
};

// ── Task List template ──

const TASK_LIST_TEMPLATE: StateInstructionTemplate = {
  version: "1.0.0",
  instructions: {
    "not-started": `The citizen wants to work through {serviceName} with {department}.

CRITICAL — IDENTITY IS ALREADY VERIFIED:
The citizen is already authenticated via GOV.UK One Login.
Do NOT mention identity verification.

WHAT TO DO:
1. Welcome them
2. Explain what {serviceName} involves — it's a step-by-step process
3. Explain that consent is needed before proceeding
4. Consent cards will appear below

Set "stateTransition" to "grant-consent" in the JSON block.
Do NOT include any tasks in the JSON block.`,
    "identity-verified": `Identity verified. Request consent to proceed.
Consent cards will appear below.
Set "stateTransition" to "grant-consent" in the JSON block.`,
    "consent-given": `Consent granted.
Present the first step of {serviceName} to the citizen.
Explain what they need to do for Step 1.
A checklist card will appear below to track progress.
When Step 1 is complete, set "stateTransition" to "complete-step-1" in the JSON block.`,
    "step-1-complete": `Step 1 is complete. Well done!
Present Step 2 and explain what the citizen needs to do next.
When Step 2 is complete, set "stateTransition" to "complete-step-2" in the JSON block.`,
    "step-2-complete": `Step 2 is complete. Good progress!
Present Step 3 and explain what the citizen needs to do next.
When Step 3 is complete, set "stateTransition" to "complete-step-3" in the JSON block.`,
    "step-3-complete": `Step 3 is complete.
Congratulate the citizen — all steps are done!
Set "stateTransition" to "finish" in the JSON block.`,
    "all-steps-complete": `All steps are complete! Congratulate them warmly.
Summarise what they've accomplished.
This is the FINAL message — do NOT ask follow-up questions.
Do NOT include any tasks in the JSON block.`,
    "handed-off": SHARED.handedOff,
  },
  forcedTransitions: {
    "not-started": "verify-identity",
  },
  autoTransitions: [
    {
      fromState: "identity-verified",
      trigger: "grant-consent",
      pattern: "I consent|go ahead|yes|proceed|agree",
    },
  ],
};

// ── Informational Hub template (no identity, no consent) ──

const INFORMATIONAL_HUB_TEMPLATE: StateInstructionTemplate = {
  version: "1.0.0",
  instructions: {
    "not-started": `The citizen is looking for information about {serviceName}.

This is an INFORMATIONAL service — there is no application, no identity check, no consent required.

WHAT TO DO:
1. Welcome them
2. Briefly explain what {serviceName} covers
3. Ask what specific information they're looking for
4. Reference {govukUrl} as the official source

Set "stateTransition" to "start-browsing" in the JSON block.
Do NOT include any tasks in the JSON block.`,
    "browsing": `The citizen is browsing information about {serviceName}.
Answer their questions using the information available.
When you've provided the key information they need, set "stateTransition" to "provide-information" in the JSON block.
If they need a specific transactional service, mention it and offer to refer them.`,
    "information-provided": `Key information has been provided.
Ask if the citizen needs anything else or would like to be referred to a related service.
If they want a related service: set "stateTransition" to "refer-to-service".
If they're satisfied: set "stateTransition" to "complete".`,
    "referred-to-service": `The citizen has been referred to a related transactional service.
Explain which service they should use and how to access it.
Provide the relevant GOV.UK link.
This is the FINAL message — do NOT ask follow-up questions.`,
    "completed": `The information session is complete.
Summarise the key points discussed.
Remind them they can visit {govukUrl} for the full official guidance.
This is the FINAL message — do NOT ask follow-up questions.`,
  },
  forcedTransitions: {},
  autoTransitions: [],
};

// ── Registry: interaction type → template ──

export const INSTRUCTION_TEMPLATE_REGISTRY: Record<InteractionType, StateInstructionTemplate> = {
  application: APPLICATION_TEMPLATE,
  license: LICENSE_TEMPLATE,
  register: REGISTER_TEMPLATE,
  portal: PORTAL_TEMPLATE,
  payment_service: PAYMENT_SERVICE_TEMPLATE,
  appointment_booker: APPOINTMENT_BOOKER_TEMPLATE,
  task_list: TASK_LIST_TEMPLATE,
  informational_hub: INFORMATIONAL_HUB_TEMPLATE,
};

// ── State model templates (mirrored from legibility-studio/lib/interaction-types.ts) ──

interface StateModelTemplate {
  states: Array<{ id: string; type?: "initial" | "terminal"; receipt?: boolean }>;
  transitions: Array<{ from: string; to: string; trigger: string; condition?: string }>;
}

const STATE_MODEL_TEMPLATES: Record<InteractionType, StateModelTemplate> = {
  application: {
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
  license: {
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
  register: {
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
  portal: {
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
  payment_service: {
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
  appointment_booker: {
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
  task_list: {
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
  informational_hub: {
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
};

// ── Resolver functions ──

/**
 * Resolve a template's {placeholders} with actual service context.
 */
export function resolveTemplateInstructions(
  template: StateInstructionTemplate,
  ctx: TemplateContext,
): StateInstructions {
  const replacePlaceholders = (text: string): string =>
    text
      .replace(/\{serviceName\}/g, ctx.serviceName)
      .replace(/\{department\}/g, ctx.department)
      .replace(/\{govukUrl\}/g, ctx.govukUrl)
      .replace(/\{eligibilitySummary\}/g, ctx.eligibilitySummary);

  const instructions: Record<string, string> = {};
  for (const [stateId, text] of Object.entries(template.instructions)) {
    instructions[stateId] = replacePlaceholders(text);
  }

  return {
    version: template.version,
    instructions,
    forcedTransitions: template.forcedTransitions
      ? { ...template.forcedTransitions }
      : undefined,
    autoTransitions: template.autoTransitions
      ? template.autoTransitions.map((at) => ({ ...at }))
      : undefined,
  };
}

/**
 * Generate a StateModelDefinition from an interaction type template.
 */
export function templateToStateModel(
  interactionType: InteractionType,
  serviceId: string,
): StateModelDefinition {
  const template = STATE_MODEL_TEMPLATES[interactionType];
  return {
    id: `${serviceId}.states`,
    version: "1.0.0",
    states: template.states.map((s) => ({ ...s })),
    transitions: template.transitions.map((t) => ({ ...t })),
  };
}
