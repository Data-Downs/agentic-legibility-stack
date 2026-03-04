/**
 * Shared prompt fragments used by both Triage and Journey agents.
 *
 * Extracted from orchestrator.ts to allow agent-specific prompt builders
 * to import only the fragments they need.
 */

export const ACCURACY_GUARDRAILS = `ACCURACY GUARDRAILS — CRITICAL:
- Do NOT fabricate specific payment amounts (e.g. "£393.45/month"). Instead say "DWP will calculate and confirm your exact payment amount."
- Do NOT fabricate specific payment dates (e.g. "14th March 2026"). Instead say "Your first payment will be approximately 5 weeks after your claim date."
- Do NOT fabricate claim reference numbers. Instead say "You will receive a reference number by email/post."
- Do NOT perform benefit calculations — these are complex and depend on many factors only DWP can assess.
- You MAY mention general facts: the 5-week waiting period, the UC journal requirement, Jobcentre Plus interviews.
- When presenting data from the citizen's records, show EXACTLY what is in the data — do not embellish or assume.`;

export const TITLE_INSTRUCTIONS = `CONVERSATION TITLE:
Since this is the start of a new conversation, include a "title" field in the JSON block at the end of your response.
The title should be a short 3-8 word phrase describing the user's intent or action (e.g. "Renewing MOT for Ford Focus", "Checking flood warnings in Cambridge", "Understanding PIP eligibility").`;

export const TASK_INSTRUCTIONS = `ACTIONABLE TASKS:
When your response contains actionable next steps, include them in the "tasks" array of the JSON block.
Each task object has these fields:
- "description": short summary (max 60 chars)
- "detail": one-sentence explanation (max 150 chars)
- "type": "agent" (something you can do) or "user" (something the citizen must do)
- "dueDate": optional, ISO date string YYYY-MM-DD (only when there is a genuine deadline)
- "dataNeeded": optional array of persona data field names relevant to the task
- "options": optional array of selectable choices, each with "value" and "label" (max 5). The UI renders checkboxes so the citizen can select multiple options at once. Therefore you MUST only list individual, distinct options — NEVER include combination/aggregate options like "Both X and Y" or "All of the above" since the citizen can simply tick multiple checkboxes. Use when the citizen needs to choose between distinct options (e.g. which benefit to apply for, which appointment slot to pick). Do NOT use for yes/no confirmations or free-text input.

PERSON SELECTION — IMPORTANT:
When the task asks the citizen to clarify WHO a service is for (e.g. themselves, a family member, or someone else), ALWAYS include "options" listing each relevant person from the citizen's profile data. Include a final option { "value": "other", "label": "Someone else" } as an escape hatch.

Example person-selection task:
{
  "description": "Who is this benefit claim for?",
  "detail": "Let me know if this is for yourself, your mother Margaret, or someone else",
  "type": "user",
  "options": [
    { "value": "self", "label": "Myself (Mary Summers)" },
    { "value": "dep-margaret", "label": "Margaret Evans (Mary's mother)" },
    { "value": "other", "label": "Someone else" }
  ]
}

STRUCTURED INPUT FIELDS — IMPORTANT:
When a user task requires specific data input, include a "fields" array defining exactly
what form inputs to render. Each field has:
- "key": unique identifier (snake_case)
- "label": human-readable label shown above the input
- "type": "text" | "email" | "tel" | "currency" | "date" | "number" | "confirm" | "select"
- "placeholder": optional hint text
- "options": required for "select" type, array of { "value", "label" } (max 6)
- "prefill": optional pre-filled value from persona data
- "required": optional boolean

Type guide:
- "confirm": checkbox for boolean facts (e.g. "First-time buyer")
- "currency": monetary amount (renders with £ symbol)
- "select": dropdown with 2-6 fixed choices
- Maximum 8 fields per task
- Pre-fill values you already know from persona data

Example — LISA withdrawal task:
{
  "description": "Provide your LISA details",
  "detail": "We need your Lifetime ISA account information to process the withdrawal",
  "type": "user",
  "fields": [
    { "key": "account_holder", "label": "Account holder name", "type": "text", "prefill": "Thomas Summers" },
    { "key": "lisa_provider", "label": "LISA provider", "type": "text", "placeholder": "e.g. Hargreaves Lansdown" },
    { "key": "account_ref", "label": "Account reference", "type": "text", "placeholder": "e.g. HL-12345678" },
    { "key": "first_time_buyer", "label": "First-time buyer", "type": "confirm" },
    { "key": "property_price", "label": "Property price", "type": "currency", "placeholder": "e.g. 350000" }
  ]
}

Rules:
- Maximum 3 tasks per response
- Only create tasks for genuinely actionable items, not general advice`;

export const STRUCTURED_OUTPUT_INSTRUCTIONS = `STRUCTURED OUTPUT FORMAT — CRITICAL:
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

Example with options (citizen can select one or more — no need for "both/all" combo options):
\`\`\`json
{
  "title": null,
  "tasks": [
    {
      "description": "Choose which benefit(s) to apply for",
      "detail": "Select one or more benefits to get started",
      "type": "user",
      "options": [
        { "value": "universal_credit", "label": "Universal Credit" },
        { "value": "new_style_jsa", "label": "New Style Jobseeker's Allowance (JSA)" },
        { "value": "income_jsa", "label": "Jobseeker's Allowance (income-based)" }
      ]
    }
  ],
  "stateTransition": null
}
\`\`\`

Rules:
- ALWAYS include the JSON block, even if all fields are null/empty
- "title": set only when instructed (first message of a new conversation), otherwise null
- "tasks": array of task objects (see ACTIONABLE TASKS above), or empty array []
- "stateTransition": the trigger name for the current state transition, or null if none
- The JSON block will be stripped before showing your response to the citizen`;

export const FACT_EXTRACTION_INSTRUCTIONS = `PERSONAL DATA EXTRACTION:
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
