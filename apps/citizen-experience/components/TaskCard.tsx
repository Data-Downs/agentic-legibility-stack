"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";

interface TaskCardProps {
  task: {
    id: string;
    description: string;
    detail: string;
    type: "agent" | "user";
    dueDate?: string | null;
    dataNeeded?: string[];
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
  tenure_type: { label: "Housing tenure", type: "text", placeholder: "e.g. Private renter" },
  monthly_rent: { label: "Monthly rent (£)", type: "text", placeholder: "e.g. 650" },
  rent_amount: { label: "Monthly rent (£)", type: "text", placeholder: "e.g. 650" },
  employer_name: { label: "Employer name", type: "text", placeholder: "e.g. TechCo Solutions Ltd" },
  employment_status: { label: "Employment status", type: "text", placeholder: "e.g. Unemployed" },
  income_amount: { label: "Monthly income (£)", type: "text", placeholder: "e.g. 1200" },
};

/** Attempt to pre-fill a field from persona data */
function getPreFill(fieldKey: string, personaData: Record<string, unknown> | null): string {
  if (!personaData) return "";
  const pc = personaData.primaryContact as Record<string, unknown> | undefined;
  const addr = personaData.address as Record<string, unknown> | undefined;
  const emp = personaData.employment as Record<string, unknown> | undefined;

  switch (fieldKey) {
    case "email": case "contact_email": return String(pc?.email ?? "");
    case "phone": case "phone_number": case "contact_phone": return String(pc?.phone ?? "");
    case "full_name": return pc ? `${pc.firstName ?? ""} ${pc.lastName ?? ""}`.trim() : "";
    case "date_of_birth": return String(pc?.dateOfBirth ?? "");
    case "national_insurance_number": return String(pc?.nationalInsuranceNumber ?? "");
    case "address": return addr ? `${addr.line1 ?? ""}, ${addr.city ?? ""}, ${addr.postcode ?? ""}` : "";
    case "employer_name": return String(emp?.employer ?? emp?.employerName ?? "");
    case "employment_status": return String(emp?.status ?? emp?.employmentStatus ?? "");
    default: return "";
  }
}

export function TaskCard({ task, completion, onComplete, onReset, disabled }: TaskCardProps) {
  const isAgent = task.type === "agent";
  const isCompleted = !!completion;
  const hasDataFields = !isAgent && task.dataNeeded && task.dataNeeded.length > 0;

  const personaData = useAppStore((s) => s.personaData) as Record<string, unknown> | null;

  // Initialize field values from persona data
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    if (!hasDataFields) return {};
    const initial: Record<string, string> = {};
    for (const key of task.dataNeeded!) {
      initial[key] = getPreFill(key, personaData);
    }
    return initial;
  });

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
    ? "Done"
    : isAgent ? "Agent" : "You";

  const handleAccept = () => {
    if (hasDataFields) {
      // Build a structured message from the field values
      const parts: string[] = [];
      for (const key of task.dataNeeded!) {
        const val = fieldValues[key]?.trim();
        if (val) {
          const meta = FIELD_META[key];
          const label = meta?.label ?? key.replace(/_/g, " ");
          parts.push(`${label}: ${val}`);
        }
      }
      if (parts.length === 0) {
        // Nothing filled in — don't submit
        return;
      }
      const msg = `${task.description}:\n${parts.join("\n")}`;
      onComplete?.(task.id, msg);
    } else {
      const msg = isAgent
        ? `Please proceed with: ${task.description}`
        : `Confirmed: ${task.description}`;
      onComplete?.(task.id, msg);
    }
  };

  // Check if form has at least one filled field
  const hasFilledField = hasDataFields
    ? Object.values(fieldValues).some(v => v.trim().length > 0)
    : true;

  return (
    <div
      className={`my-3 rounded-2xl ${borderClass} border bg-white transition-opacity ${isCompleted ? "opacity-80" : ""}`}
      style={{ boxShadow: shadowStyle }}
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
        <p className="text-sm text-govuk-dark-grey mt-1">{task.detail}</p>

        {/* Data input fields — shown when task has dataNeeded and is a user task */}
        {!isCompleted && hasDataFields && (
          <div className="mt-3 space-y-3">
            {task.dataNeeded!.map((key) => {
              const meta = FIELD_META[key] ?? {
                label: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
                type: "text",
                placeholder: "",
              };
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

        {/* Data needed tags — only shown for agent tasks (user tasks now have input fields) */}
        {!isCompleted && !hasDataFields && isAgent && task.dataNeeded && task.dataNeeded.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {task.dataNeeded.map((d) => (
              <span key={d} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Completed state */}
        {isCompleted && (
          <div className="mt-3 border-t border-gray-200 pt-3">
            <p className="text-sm font-medium text-green-700 whitespace-pre-line">
              {completion}
            </p>
            {!disabled && (
              <button
                onClick={() => onReset?.(task.id)}
                className="text-sm text-govuk-blue underline hover:no-underline mt-2"
              >
                Change
              </button>
            )}
          </div>
        )}

        {/* Action button */}
        {!isCompleted && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAccept}
              disabled={disabled || (hasDataFields && !hasFilledField)}
              className="text-sm font-bold text-white px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
              style={{ backgroundColor: (hasDataFields && !hasFilledField) ? "#b1b4b6" : (isAgent ? "#1d70b8" : "#00703c") }}
            >
              {hasDataFields ? "Submit" : (isAgent ? "Do this" : "Got it")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
