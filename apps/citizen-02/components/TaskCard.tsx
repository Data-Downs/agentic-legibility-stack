"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import type { TaskField } from "@/lib/types";
import { DEMO_TODAY } from "@/lib/types";

function generateCalendarFile(task: { id: string; description: string; detail: string; dueDate?: string | null }) {
  if (!task.dueDate) return;
  const dtstart = task.dueDate.replace(/-/g, "") + "T090000";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GOV.UK//Citizen Agent//EN",
    "BEGIN:VEVENT",
    `DTSTART:${dtstart}`,
    `SUMMARY:${task.description.replace(/[,;\\]/g, " ")}`,
    `DESCRIPTION:${task.detail.replace(/[,;\\]/g, " ")}`,
    `UID:${task.id}@citizen-02`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reminder.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface TaskCardProps {
  task: {
    id: string;
    description: string;
    detail: string;
    type: "agent" | "user";
    dueDate?: string | null;
    dataNeeded?: string[];
    options?: Array<{ value: string; label: string }>;
    fields?: TaskField[];
  };
  completion?: string;
  onComplete?: (taskId: string, message: string) => void;
  onReset?: (taskId: string) => void;
  disabled?: boolean;
}

/** Human-readable labels and input types for known data fields */
const FIELD_META: Record<string, { label: string; type: string; placeholder: string }> = {
  email: { label: "Email address", type: "email", placeholder: "e.g. priya.sharma@email.com" },
  phone: { label: "Phone number", type: "tel", placeholder: "e.g. 07700 900000" },
  phone_number: { label: "Phone number", type: "tel", placeholder: "e.g. 07700 900000" },
  contact_phone: { label: "Phone number", type: "tel", placeholder: "e.g. 07700 900000" },
  contact_email: { label: "Email address", type: "email", placeholder: "e.g. name@email.com" },
  full_name: { label: "Full name", type: "text", placeholder: "e.g. Priya Sharma" },
  date_of_birth: { label: "Date of birth", type: "text", placeholder: "e.g. 15/03/1992" },
  national_insurance_number: { label: "National Insurance number", type: "text", placeholder: "e.g. QQ 12 34 56 C" },
  address: { label: "Address", type: "text", placeholder: "e.g. 12 Maple Road, Manchester" },
  sort_code: { label: "Sort code", type: "text", placeholder: "e.g. 12-34-56" },
  account_number: { label: "Account number", type: "text", placeholder: "e.g. 12345678" },
  tenure_type: { label: "Housing tenure", type: "select", placeholder: "" },
  monthly_rent: { label: "Monthly rent (£)", type: "text", placeholder: "e.g. 650" },
  rent_amount: { label: "Monthly rent (£)", type: "text", placeholder: "e.g. 650" },
  employer_name: { label: "Employer name", type: "text", placeholder: "e.g. TechCo Solutions Ltd" },
  employment_status: { label: "Employment status", type: "text", placeholder: "e.g. Unemployed" },
  employment_end_date: { label: "Employment end date", type: "text", placeholder: "e.g. 20/01/2026" },
  income_amount: { label: "Monthly income (£)", type: "text", placeholder: "e.g. 1200" },
  landlord_name: { label: "Landlord's full name", type: "text", placeholder: "e.g. Steve Smith" },
  landlord_address: { label: "Landlord's address", type: "text", placeholder: "e.g. 45 Oak Street, Manchester, M1 4BH" },
};

const TENURE_OPTIONS = [
  { value: "", label: "Select an option" },
  { value: "Private Renter", label: "Private renter" },
  { value: "Social Renter", label: "Social renter" },
  { value: "Owner with mortgage", label: "Owner with mortgage" },
  { value: "Owner mortgage-free", label: "Owner (mortgage-free)" },
  { value: "Living rent-free", label: "Living rent-free" },
];

/** Returns the dynamic label for rent/mortgage fields based on tenure, or null to hide */
function getRentLabel(tenure: string): string | null {
  switch (tenure) {
    case "Owner mortgage-free":
    case "Living rent-free":
      return null;
    case "Owner with mortgage":
      return "Monthly mortgage (£)";
    default:
      return "Monthly rent (£)";
  }
}

// ── Smart interaction inference ──

interface PersonOption {
  value: string;
  label: string;
}

interface SmartInteraction {
  type: "person-selection" | "yes-no" | "enumerated" | "freeform";
  options: PersonOption[];
  allowOther: boolean;
}

/** Extract person options from persona data by matching names in text */
function matchPeopleInText(
  text: string,
  personaData: Record<string, unknown> | null,
): PersonOption[] {
  if (!personaData) return [];
  const lower = text.toLowerCase();
  const matched: PersonOption[] = [];

  const pc = personaData.primaryContact as Record<string, unknown> | undefined;
  if (pc?.firstName) {
    const first = String(pc.firstName).toLowerCase();
    const last = String(pc.lastName ?? "").toLowerCase();
    const fullName = `${pc.firstName} ${pc.lastName ?? ""}`.trim();
    if (
      lower.includes(first) ||
      lower.includes("yourself") ||
      lower.includes("for you") ||
      lower.includes("for myself")
    ) {
      matched.push({ value: "self", label: `Myself (${fullName})` });
    }
  }

  const partner =
    (personaData.partner as Record<string, unknown> | undefined) ??
    (personaData.spouse as Record<string, unknown> | undefined);
  if (partner?.firstName) {
    const first = String(partner.firstName).toLowerCase();
    if (lower.includes(first)) {
      const fullName = `${partner.firstName} ${partner.lastName ?? ""}`.trim();
      matched.push({ value: `partner-${first}`, label: fullName });
    }
  }

  // Top-level children array
  const topChildren = personaData.children as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(topChildren)) {
    for (const child of topChildren) {
      if (!child?.firstName) continue;
      const first = String(child.firstName).toLowerCase();
      if (lower.includes(first)) {
        const fullName = `${child.firstName} ${child.lastName ?? ""}`.trim();
        matched.push({ value: `child-${first}`, label: fullName });
      }
    }
  }

  // Nested family.children
  const family = personaData.family as Record<string, unknown> | undefined;
  if (family) {
    const famChildren = family.children as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(famChildren)) {
      for (const child of famChildren) {
        if (!child?.firstName) continue;
        const first = String(child.firstName).toLowerCase();
        if (lower.includes(first)) {
          const fullName = `${child.firstName} ${child.lastName ?? ""}`.trim();
          matched.push({ value: `child-${first}`, label: fullName });
        }
      }
    }

    // Nested family.dependents
    const dependents = family.dependents as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(dependents)) {
      for (const dep of dependents) {
        if (!dep?.firstName) continue;
        const first = String(dep.firstName).toLowerCase();
        if (lower.includes(first)) {
          const fullName = `${dep.firstName} ${dep.lastName ?? ""}`.trim();
          const relationship = dep.relationship ? ` (${dep.relationship})` : "";
          matched.push({ value: `dep-${first}`, label: `${fullName}${relationship}` });
        }
      }
    }
  }

  return matched;
}

/** Infer the best interaction type from task text and persona data */
function inferInteraction(
  description: string,
  detail: string,
  personaData: Record<string, unknown> | null,
): SmartInteraction {
  const text = `${description} ${detail}`;

  // 1. Person selection — check if 2+ people are mentioned
  const people = matchPeopleInText(text, personaData);
  if (people.length >= 2) {
    return {
      type: "person-selection",
      options: [...people, { value: "other", label: "Someone else" }],
      allowOther: true,
    };
  }

  // 2. Yes/No confirmation — detect question patterns but exclude data-gathering questions
  const lower = text.toLowerCase();
  const yesNoPatterns = [
    /\bdo you want\b/,
    /\bwould you like\b/,
    /\bis this correct\b/,
    /\bshall (i|we)\b/,
    /\bdo you confirm\b/,
    /\bwould you prefer\b/,
    /\bcan (i|we) proceed\b/,
    /\bdo you agree\b/,
  ];
  const dataPatterns = [
    /what is your/,
    /provide your/,
    /enter your/,
    /tell us your/,
  ];
  const isYesNo = yesNoPatterns.some((p) => p.test(lower));
  const isDataRequest = dataPatterns.some((p) => p.test(lower));
  if (isYesNo && !isDataRequest) {
    return {
      type: "yes-no",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ],
      allowOther: false,
    };
  }

  // 3. Enumerated choices — parse "X, Y, or Z" pattern from text
  const enumMatch = text.match(/(?:choose|select|pick|between)\s+(.+?)(?:\.|$)/i)
    ?? text.match(/(?:^|[.!?]\s*)([A-Z][^.]*?,\s*[^.]*?\bor\s+[^.]+)/);
  if (enumMatch) {
    const raw = enumMatch[1];
    // Split on ", " and " or "
    const parts = raw.split(/,\s*(?:or\s+)?|\s+or\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2 && parts.length <= 5) {
      return {
        type: "enumerated",
        options: [
          ...parts.map((p) => ({ value: p.toLowerCase().replace(/\s+/g, "_"), label: p })),
          { value: "other", label: "Other" },
        ],
        allowOther: true,
      };
    }
  }

  return { type: "freeform", options: [], allowOther: false };
}

/** Infer relevant data fields from task description and detail text */
function inferFields(description: string, detail: string): string[] {
  const text = `${description} ${detail}`.toLowerCase();
  const matched = new Set<string>();

  const rules: Array<{ pattern: RegExp; fields: string[] }> = [
    { pattern: /account\s*number/, fields: ["account_number"] },
    { pattern: /sort\s*code/, fields: ["sort_code"] },
    { pattern: /bank\b/, fields: ["account_number", "sort_code"] },
    { pattern: /employment.*(end|last)|last\s*day|end\s*date/, fields: ["employment_end_date"] },
    { pattern: /employer/, fields: ["employer_name"] },
    { pattern: /landlord.*(name|full)|name.*landlord/, fields: ["landlord_name"] },
    { pattern: /landlord.*(address|street|complete)/, fields: ["landlord_address"] },
    { pattern: /landlord/, fields: ["landlord_name", "landlord_address"] },
    { pattern: /rent|mortgage/, fields: ["monthly_rent"] },
    { pattern: /tenure|housing\s*type/, fields: ["tenure_type"] },
    { pattern: /phone|contact\s*number/, fields: ["phone"] },
    { pattern: /email/, fields: ["email"] },
    { pattern: /national\s*insurance|ni\s*number/, fields: ["national_insurance_number"] },
    { pattern: /date\s*of\s*birth|dob/, fields: ["date_of_birth"] },
    { pattern: /(?<!landlord.{0,30})full\s*name/, fields: ["full_name"] },
    { pattern: /(?<!landlord.{0,30})\baddress\b/, fields: ["address"] },
  ];

  for (const { pattern, fields } of rules) {
    if (pattern.test(text)) {
      fields.forEach(f => matched.add(f));
    }
  }

  return Array.from(matched);
}

/** Attempt to pre-fill a field from persona data */
function getPreFill(fieldKey: string, personaData: Record<string, unknown> | null): string {
  if (!personaData) return "";
  const pc = personaData.primaryContact as Record<string, unknown> | undefined;
  const addr = personaData.address as Record<string, unknown> | undefined;
  const emp = personaData.employment as Record<string, unknown> | undefined;
  const fin = personaData.financials as Record<string, unknown> | undefined;

  // Employment may be nested under the persona name (e.g. employment.priya)
  // Find the first object value that has a "status" key
  const empData = emp
    ? (emp.status ? emp : Object.values(emp).find(
        (v) => v && typeof v === "object" && "status" in (v as Record<string, unknown>)
      ) as Record<string, unknown> | undefined) ?? emp
    : undefined;

  // Financials: first bank account from bankAccounts array
  const bankAccounts = fin?.bankAccounts as Array<Record<string, unknown>> | undefined;
  const primaryBank = bankAccounts?.[0];

  switch (fieldKey) {
    case "email": case "contact_email": return String(pc?.email ?? "");
    case "phone": case "phone_number": case "contact_phone": return String(pc?.phone ?? "");
    case "full_name": return pc ? `${pc.firstName ?? ""} ${pc.lastName ?? ""}`.trim() : "";
    case "date_of_birth": return String(pc?.dateOfBirth ?? "");
    case "national_insurance_number": return String(pc?.nationalInsuranceNumber ?? "");
    case "address": return addr ? [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).join(", ") : "";
    case "tenure_type": return String(addr?.housingStatus ?? "");
    case "employer_name": return String(empData?.employer ?? empData?.previousEmployer ?? empData?.businessName ?? "");
    case "employment_status": return String(empData?.status ?? "");
    case "employment_end_date": return String(empData?.employmentEndDate ?? empData?.retirementDate ?? "");
    case "sort_code": return String(primaryBank?.sortCode ?? "");
    case "account_number": return String(primaryBank?.accountNumber ?? "");
    case "monthly_rent": case "rent_amount": return String(fin?.monthlyRent ?? fin?.monthlyMortgage ?? "");
    case "income_amount": return String(empData?.annualIncome ?? "");
    default: return "";
  }
}

export function TaskCard({ task, completion, onComplete, onReset, disabled }: TaskCardProps) {
  const isAgent = task.type === "agent";
  const isCompleted = !!completion;
  const hasLLMFields = !isAgent && Array.isArray(task.fields) && task.fields.length > 0;
  const hasOptions = !isAgent && !hasLLMFields && task.options && task.options.length > 0;
  const hasExplicitFields = !hasOptions && !hasLLMFields && !isAgent && task.dataNeeded && task.dataNeeded.length > 0;
  const [showAgentDetail, setShowAgentDetail] = useState(false);

  // For user tasks without explicit fields or options, infer fields from description
  const inferredFields = (!isAgent && !hasOptions && !hasLLMFields && !hasExplicitFields)
    ? inferFields(task.description, task.detail)
    : [];

  // Unified field list: explicit dataNeeded takes precedence, then inferred.
  // Only render fields we have proper form metadata for — drop unknown/generic
  // fields (e.g. "vehicles") that would just show an empty unlabelled input.
  const rawFields = hasExplicitFields ? task.dataNeeded! : inferredFields;
  const activeFields = rawFields.filter((key) => FIELD_META[key]);
  const hasActiveFields = activeFields.length > 0;

  const personaData = useAppStore((s) => s.personaData) as Record<string, unknown> | null;

  // Initialize field values from persona data
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    if (!hasActiveFields) return {};
    const initial: Record<string, string> = {};
    for (const key of activeFields) {
      initial[key] = getPreFill(key, personaData);
    }
    return initial;
  });

  // LLM fields state — initialized from prefill values
  const [llmFieldValues, setLlmFieldValues] = useState<Record<string, string>>(() => {
    if (!hasLLMFields) return {};
    const initial: Record<string, string> = {};
    for (const field of task.fields!) {
      initial[field.key] = field.prefill ?? "";
    }
    return initial;
  });

  const updateLlmField = useCallback((key: string, value: string) => {
    setLlmFieldValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [freeformText, setFreeformText] = useState("");

  // Smart interaction inference — only for user tasks without LLM fields, explicit options, or active fields
  const smartInteraction = (!isAgent && !hasLLMFields && !hasOptions && !hasActiveFields)
    ? inferInteraction(task.description, task.detail, personaData)
    : null;
  const hasSmartOptions = smartInteraction !== null && smartInteraction.type !== "freeform";

  const [selectedSmart, setSelectedSmart] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");

  const updateField = useCallback((key: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const borderClass = isCompleted
    ? "border-green-200"
    : isAgent ? "border-blue-200" : "border-green-200";
  const shadowStyle = isCompleted
    ? "0 2px 8px rgba(0,112,60,0.08)"
    : isAgent ? "0 2px 8px rgba(29,112,184,0.08)" : "0 2px 8px rgba(0,112,60,0.08)";
  const iconBg = isCompleted
    ? "bg-green-100"
    : isAgent ? "bg-blue-100" : "bg-green-100";
  const iconColor = isCompleted
    ? "#00703c"
    : isAgent ? "#1d70b8" : "#00703c";
  const titleColor = isCompleted
    ? "text-green-700"
    : isAgent ? "text-blue-700" : "text-green-700";
  const badgeLabel = isCompleted
    ? "Submitted"
    : isAgent ? "Agent" : "You";

  const toggleOption = useCallback((value: string) => {
    setSelectedOptions(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }, []);

  const handleAccept = () => {
    if (hasLLMFields) {
      const parts: string[] = [];
      for (const field of task.fields!) {
        const val = llmFieldValues[field.key]?.trim();
        if (field.type === "confirm") {
          parts.push(`${field.label}: ${val === "true" ? "Yes" : "No"}`);
        } else if (val) {
          const display = field.type === "currency" ? `£${val}` : val;
          parts.push(`${field.label}: ${display}`);
        }
      }
      if (parts.length === 0) return;
      const msg = `${task.description}:\n${parts.join("\n")}`;
      onComplete?.(task.id, msg);
    } else if (hasOptions) {
      const chosen = task.options!.filter(o => selectedOptions.has(o.value));
      if (chosen.length === 0) return;
      const msg = `Selected: ${chosen.map(o => o.label).join(", ")}`;
      onComplete?.(task.id, msg);
    } else if (hasActiveFields) {
      // Build a structured message from the field values
      const parts: string[] = [];
      for (const key of activeFields) {
        // Skip hidden rent/mortgage fields
        if ((key === "monthly_rent" || key === "rent_amount") && fieldValues.tenure_type) {
          if (getRentLabel(fieldValues.tenure_type) === null) continue;
        }
        const val = fieldValues[key]?.trim();
        if (val) {
          let label: string;
          if ((key === "monthly_rent" || key === "rent_amount") && fieldValues.tenure_type) {
            label = getRentLabel(fieldValues.tenure_type) ?? "Monthly rent (£)";
          } else {
            const meta = FIELD_META[key];
            label = meta?.label ?? key.replace(/_/g, " ");
          }
          parts.push(`${label}: ${val}`);
        }
      }
      if (parts.length === 0) return;
      const msg = `${task.description}:\n${parts.join("\n")}`;
      onComplete?.(task.id, msg);
    } else if (hasSmartOptions && selectedSmart) {
      if (selectedSmart === "other" && otherText.trim()) {
        onComplete?.(task.id, `${task.description}: ${otherText.trim()}`);
      } else if (selectedSmart !== "other") {
        const chosen = smartInteraction!.options.find((o) => o.value === selectedSmart);
        onComplete?.(task.id, `Selected: ${chosen?.label ?? selectedSmart}`);
      }
    } else if (isAgent) {
      onComplete?.(task.id, `Please proceed with: ${task.description}`);
    } else if (freeformText.trim()) {
      onComplete?.(task.id, `${task.description}:\n${freeformText.trim()}`);
    } else {
      onComplete?.(task.id, `Confirmed: ${task.description}`);
    }
  };

  // Check if form has at least one filled field or an option is selected
  const hasFilledField = hasLLMFields
    ? Object.values(llmFieldValues).some(v => v.trim().length > 0)
    : hasOptions
      ? selectedOptions.size > 0
      : hasSmartOptions
        ? selectedSmart !== null && (selectedSmart !== "other" || otherText.trim().length > 0)
        : hasActiveFields
          ? Object.values(fieldValues).some(v => v.trim().length > 0)
          : true;

  // Date reminder: has a due date but no meaningful form fields to collect
  const isDateReminder = !isAgent && !hasLLMFields && !!task.dueDate && !hasActiveFields && !hasOptions;

  // Whether this is a pure freeform task (no fields could be inferred, no smart options)
  const isFreeform = !isAgent && !hasLLMFields && !hasOptions && !hasSmartOptions && !hasActiveFields && !isDateReminder;

  return (
    <div
      className={`my-3 rounded-2xl bg-white shadow-sm transition-opacity ${isCompleted ? "opacity-80" : ""}`}
    >
      <div className="px-5 py-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`w-7 h-7 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
            {isCompleted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isAgent ? <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> : <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />}
              </svg>
            )}
          </span>
          <span className={`text-sm font-bold ${titleColor}`}>
            {badgeLabel}
          </span>
          {!isCompleted && task.dueDate && (
            <span className="text-xs font-medium text-orange-600 ml-auto">
              Due {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Content */}
        <p className={`text-base font-medium ${isCompleted ? "text-govuk-dark-grey" : "text-govuk-black"}`}>
          {task.description}
        </p>
        {!isCompleted && (
          <p className="text-sm text-govuk-dark-grey mt-1">{task.detail}</p>
        )}

        {/* LLM-defined fields — primary rendering path */}
        {!isCompleted && hasLLMFields && (
          <div className="mt-3 space-y-3">
            {task.fields!.map((field) => {
              if (field.type === "confirm") {
                return (
                  <label key={field.key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={llmFieldValues[field.key] === "true"}
                      onChange={(e) => updateLlmField(field.key, e.target.checked ? "true" : "")}
                      disabled={disabled}
                      className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                    />
                    <span className="text-sm font-medium text-govuk-black">{field.label}</span>
                  </label>
                );
              }

              if (field.type === "select" && field.options) {
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-govuk-black mb-1">
                      {field.label}
                    </label>
                    <select
                      value={llmFieldValues[field.key] ?? ""}
                      onChange={(e) => updateLlmField(field.key, e.target.value)}
                      disabled={disabled}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white"
                    >
                      <option value="">Select an option</option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (field.type === "currency") {
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-govuk-black mb-1">
                      {field.label}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-govuk-dark-grey">£</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={llmFieldValues[field.key] ?? ""}
                        onChange={(e) => updateLlmField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        disabled={disabled}
                        className="w-full text-sm border border-gray-300 rounded-lg pl-7 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white"
                      />
                    </div>
                  </div>
                );
              }

              const inputType = field.type === "date" ? "date"
                : field.type === "number" ? "number"
                : field.type === "email" ? "email"
                : field.type === "tel" ? "tel"
                : "text";

              return (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-govuk-black mb-1">
                    {field.label}
                  </label>
                  <input
                    type={inputType}
                    value={llmFieldValues[field.key] ?? ""}
                    onChange={(e) => updateLlmField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={disabled}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Checkbox options — shown when task has options (multi-select) */}
        {!isCompleted && hasOptions && (
          <fieldset className="mt-3 space-y-2">
            {task.options!.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedOptions.has(opt.value)
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={selectedOptions.has(opt.value)}
                  onChange={() => toggleOption(opt.value)}
                  disabled={disabled}
                  className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                />
                <span className="text-sm font-medium text-govuk-black">{opt.label}</span>
              </label>
            ))}
          </fieldset>
        )}

        {/* Smart inferred options — radio-style selection */}
        {!isCompleted && hasSmartOptions && (
          <fieldset className="mt-3 space-y-2">
            {smartInteraction!.options.map((opt) => (
              <label
                key={opt.value}
                onClick={() => !disabled && setSelectedSmart(opt.value)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedSmart === opt.value
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedSmart === opt.value ? "border-green-500" : "border-gray-300"
                }`}>
                  {selectedSmart === opt.value && (
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  )}
                </span>
                <span className="text-sm font-medium text-govuk-black">{opt.label}</span>
              </label>
            ))}
            {/* "Other" text input revealed when selected */}
            {smartInteraction!.allowOther && selectedSmart === "other" && (
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Please specify..."
                disabled={disabled}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 mt-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 bg-white"
              />
            )}
          </fieldset>
        )}

        {/* Data input fields — explicit dataNeeded or inferred from description */}
        {!isCompleted && hasActiveFields && (
          <div className="mt-3 space-y-3">
            {activeFields.map((key) => {
              const meta = FIELD_META[key] ?? {
                label: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
                type: "text",
                placeholder: "",
              };

              // Hide rent/mortgage fields when tenure means no payment
              if ((key === "monthly_rent" || key === "rent_amount") && fieldValues.tenure_type) {
                const rentLabel = getRentLabel(fieldValues.tenure_type);
                if (rentLabel === null) return null;
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-govuk-black mb-1">
                      {rentLabel}
                    </label>
                    <input
                      type="text"
                      value={fieldValues[key] ?? ""}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={meta.placeholder}
                      disabled={disabled}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white"
                    />
                  </div>
                );
              }

              // Render tenure as a dropdown
              if (key === "tenure_type") {
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-govuk-black mb-1">
                      {meta.label}
                    </label>
                    <select
                      value={fieldValues[key] ?? ""}
                      onChange={(e) => updateField(key, e.target.value)}
                      disabled={disabled}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white"
                    >
                      {TENURE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                );
              }

              return (
                <div key={key}>
                  <label className="block text-sm font-medium text-govuk-black mb-1">
                    {meta.label}
                  </label>
                  <input
                    type={meta.type}
                    value={fieldValues[key] ?? ""}
                    onChange={(e) => updateField(key, e.target.value)}
                    placeholder={meta.placeholder}
                    disabled={disabled}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Freeform text area — last resort for tasks where no fields could be inferred */}
        {!isCompleted && isFreeform && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-govuk-black mb-1">
              Your response
            </label>
            <textarea
              value={freeformText}
              onChange={(e) => setFreeformText(e.target.value)}
              placeholder="Type your response here..."
              disabled={disabled}
              rows={3}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 bg-white resize-y"
            />
          </div>
        )}

        {/* Data needed tags — only shown for agent tasks (user tasks now have input fields) */}
        {!isCompleted && !hasActiveFields && isAgent && task.dataNeeded && task.dataNeeded.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {task.dataNeeded.map((d) => (
              <span key={d} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Completed state — data table or plain text */}
        {isCompleted && (() => {
          // Parse "Label: Value" lines from completion text, skipping the header line
          const lines = (completion ?? "").split("\n").filter(Boolean);
          const rows = lines
            .filter((l) => l.includes(": "))
            .map((l) => {
              const idx = l.indexOf(": ");
              return { label: l.slice(0, idx), value: l.slice(idx + 2) };
            });

          // Only render as a table when there are 2+ structured data rows
          const useTable = rows.length >= 2;

          return (
            <div className="mt-3">
              {useTable ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left text-xs font-medium text-govuk-dark-grey py-1.5 pr-4">Field</th>
                      <th className="text-left text-xs font-medium text-govuk-dark-grey py-1.5">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-b-0">
                        <td className="text-govuk-dark-grey py-1.5 pr-4 align-top">{row.label}</td>
                        <td className="text-govuk-black font-medium py-1.5">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-govuk-black whitespace-pre-line">{completion}</p>
              )}
              {!disabled && (
                <button
                  onClick={() => onReset?.(task.id)}
                  className="text-sm text-govuk-blue underline hover:no-underline mt-2"
                >
                  Change
                </button>
              )}
            </div>
          );
        })()}

        {/* Date reminder action buttons */}
        {!isCompleted && isDateReminder && (
          <>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => generateCalendarFile(task as { id: string; description: string; detail: string; dueDate: string })}
                className="text-sm font-bold px-4 py-2.5 rounded-full border-2 border-govuk-blue text-govuk-blue hover:bg-blue-50 transition-colors flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Add to calendar
              </button>
              <button
                onClick={() => setShowAgentDetail(prev => !prev)}
                disabled={disabled}
                className={`text-sm font-bold px-4 py-2.5 rounded-full transition-colors flex items-center gap-1.5 ${
                  showAgentDetail
                    ? "bg-blue-600 text-white"
                    : "border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Ask agent
              </button>
              <button
                onClick={() => onComplete?.(task.id, `Dismissed: ${task.description}`)}
                disabled={disabled}
                className="text-sm font-bold px-4 py-2.5 rounded-full border-2 border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>

            {/* Ask agent expandable detail */}
            {showAgentDetail && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-800 mb-1">What the agent would do</p>
                <p className="text-sm text-blue-700">{task.detail}</p>
                <button
                  onClick={() => onComplete?.(task.id, `Please proceed with: ${task.description}`)}
                  disabled={disabled}
                  className="mt-3 text-sm font-bold text-white px-4 py-2.5 rounded-full transition-colors disabled:opacity-50"
                  style={{ backgroundColor: "#1d70b8" }}
                >
                  Proceed
                </button>
              </div>
            )}
          </>
        )}

        {/* Action button — non-date-reminder tasks */}
        {!isCompleted && !isDateReminder && (
          <div className="flex gap-2 mt-4">
            {task.dueDate && (
              <button
                onClick={() => generateCalendarFile(task as { id: string; description: string; detail: string; dueDate: string })}
                className="text-sm font-bold px-4 py-2.5 rounded-full border-2 border-govuk-blue text-govuk-blue hover:bg-blue-50 transition-colors flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Add to calendar
              </button>
            )}
            <button
              onClick={handleAccept}
              disabled={disabled || ((hasLLMFields || hasActiveFields || hasOptions || hasSmartOptions) && !hasFilledField)}
              className="text-sm font-bold text-white px-4 py-2.5 rounded-full disabled:opacity-50 transition-colors"
              style={{ backgroundColor: ((hasLLMFields || hasActiveFields || hasOptions || hasSmartOptions) && !hasFilledField) ? "#b1b4b6" : (isAgent ? "#1d70b8" : "#00703c") }}
            >
              {hasLLMFields ? "Submit" : hasOptions ? "Continue" : hasSmartOptions ? "Continue" : hasActiveFields ? "Submit" : isAgent ? "Do this" : isFreeform ? "Submit" : "Got it"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
