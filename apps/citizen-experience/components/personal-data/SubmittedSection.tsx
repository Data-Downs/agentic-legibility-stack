"use client";

import React, { useState } from "react";

interface SubmittedField {
  id: string;
  fieldKey: string;
  fieldValue: unknown;
  category: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Identity",
  contact: "Contact",
  address: "Address",
  employment: "Employment",
  financial: "Financial",
  vehicles: "Vehicles",
  health: "Health",
  family: "Family",
  benefits: "Benefits",
  business: "Business",
  communication: "Communication",
};

const CATEGORY_ICONS: Record<string, string> = {
  identity: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  contact: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72",
  address: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  employment: "M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
  financial: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  vehicles: "M5 17h14M5 17a2 2 0 0 1-2-2V7h18v8a2 2 0 0 1-2 2M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  health: "M22 12h-4l-3 9L9 3l-3 9H2",
  family: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM16 3.13a4 4 0 0 1 0 7.75",
  benefits: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
  business: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  communication: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
};

const CATEGORY_ORDER = [
  "identity", "contact", "address", "employment", "financial",
  "vehicles", "health", "family", "benefits", "business", "communication",
];

/** Pretty-print a field key for display */
function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/** Check if a value is a simple scalar (string, number, boolean) */
function isSimpleValue(val: unknown): val is string | number | boolean {
  return typeof val === "string" || typeof val === "number" || typeof val === "boolean";
}

/** Generate a short inline preview for a complex value so the dashboard doesn't look empty */
function inlineSummary(fieldKey: string, val: unknown): string {
  if (val === null || val === undefined) return "";
  if (isSimpleValue(val)) return String(val);

  // Arrays: summarise count + first item hint
  if (Array.isArray(val)) {
    if (val.length === 0) return "None";
    const first = val[0];
    if (isSimpleValue(first)) return val.join(", ");
    // e.g. vehicles: "Ford Fiesta (BG19 XYZ)"
    if (typeof first === "object" && first !== null) {
      const o = first as Record<string, unknown>;
      const carHint = o.make || o.model
        ? `${o.make || ""} ${o.model || ""}`.trim() + (o.registrationNumber ? ` (${o.registrationNumber})` : "")
        : "";
      if (carHint) return val.length > 1 ? `${carHint} +${val.length - 1} more` : carHint;
      // generic: pick first string value
      const firstStr = Object.values(o).find((v) => typeof v === "string") as string | undefined;
      if (firstStr) return val.length > 1 ? `${firstStr} +${val.length - 1} more` : firstStr;
    }
    return `${val.length} item${val.length !== 1 ? "s" : ""}`;
  }

  if (typeof val === "object") {
    const o = val as Record<string, unknown>;

    // Address: "line1, city, postcode"
    if (fieldKey === "address") {
      const parts = [o.line1, o.city, o.postcode].filter(Boolean);
      if (parts.length > 0) return parts.join(", ") as string;
    }

    // Contact/person: "firstName lastName"
    if (o.firstName || o.lastName) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ");
      const extra = (o.email as string) || (o.phone as string) || "";
      return extra ? `${name} — ${extra}` : name;
    }

    // Employment: check for nested people (emma/liam or named keys)
    if (fieldKey === "employment" || fieldKey === "spouseEmployment") {
      const entries = Object.entries(o);
      // Nested sub-objects per person
      if (entries.length > 0 && typeof entries[0][1] === "object" && entries[0][1] !== null) {
        return entries.map(([name, emp]) => {
          const e = emp as Record<string, unknown>;
          return `${name}: ${e.jobTitle || e.role || e.status || ""}`;
        }).join(", ");
      }
      // Flat employment
      const parts = [o.jobTitle || o.role, o.employer, o.status].filter(Boolean);
      if (parts.length > 0) return parts.join(" — ") as string;
    }

    // Health: similar nested pattern
    if (fieldKey === "healthInfo") {
      const entries = Object.entries(o);
      if (entries.length > 0 && typeof entries[0][1] === "object") {
        return entries.map(([name, h]) => {
          const hObj = h as Record<string, unknown>;
          return `${name}: ${hObj.gpSurgery || ""}`;
        }).join(", ");
      }
    }

    // Financials: combined income or first number
    if (o.combinedAnnualIncome || o.annualIncome) {
      const income = (o.combinedAnnualIncome || o.annualIncome) as number;
      return `Income: \u00a3${income.toLocaleString()}`;
    }

    // Communication style
    if (o.tone) return String(o.tone);

    // Benefits
    if (fieldKey === "benefits") {
      const receiving = o.currentlyReceiving as unknown[] | undefined;
      if (receiving && receiving.length > 0) return `Receiving ${receiving.length} benefit(s)`;
      return "None currently";
    }

    // Children
    if (fieldKey === "children" && Array.isArray(o)) {
      return `${(o as unknown[]).length} child(ren)`;
    }

    // Pregnancy
    if (o.dueDate) return `Due: ${o.dueDate}${o.hospital ? ` at ${o.hospital}` : ""}`;

    // Generic fallback: pick first few string values
    const stringVals = Object.values(o).filter((v) => typeof v === "string").slice(0, 2) as string[];
    if (stringVals.length > 0) return stringVals.join(", ");

    return `${Object.keys(o).length} fields`;
  }

  return "";
}

/** Render a complex value (object/array) as readable summary lines */
function renderObjectSummary(obj: unknown, depth = 0): React.ReactNode[] {
  if (obj === null || obj === undefined) return [];
  if (isSimpleValue(obj)) {
    return [<span key="v">{String(obj)}</span>];
  }
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) => {
      if (isSimpleValue(item)) {
        return [
          <div key={i} className="py-0.5 text-sm" style={{ paddingLeft: depth * 12 }}>
            {String(item)}
          </div>,
        ];
      }
      return [
        <div key={`h${i}`} className="py-0.5 text-xs font-medium text-govuk-dark-grey mt-1" style={{ paddingLeft: depth * 12 }}>
          Item {i + 1}
        </div>,
        ...renderObjectSummary(item, depth + 1),
      ];
    });
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>);
    return entries.map(([k, v]) => {
      if (isSimpleValue(v)) {
        return (
          <div key={k} className="flex justify-between py-0.5 text-sm" style={{ paddingLeft: depth * 12 }}>
            <span className="text-govuk-dark-grey">{formatKey(k)}</span>
            <span className="text-right ml-2 max-w-[60%] truncate">{String(v)}</span>
          </div>
        );
      }
      return (
        <div key={k} style={{ paddingLeft: depth * 12 }}>
          <div className="text-xs font-medium text-govuk-dark-grey mt-1 py-0.5">
            {formatKey(k)}
          </div>
          {renderObjectSummary(v, depth + 1)}
        </div>
      );
    });
  }
  return [];
}

export function SubmittedSection({
  fields,
  personaId,
  onRefresh,
}: {
  fields: SubmittedField[];
  personaId: string;
  onRefresh: () => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [cascadeMessage, setCascadeMessage] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Group by category, exclude system fields
  const grouped: Record<string, SubmittedField[]> = {};
  for (const f of fields) {
    if (f.category === "system") continue;
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startEdit = (field: SubmittedField) => {
    setEditingKey(field.fieldKey);
    setEditValue(typeof field.fieldValue === "string" ? field.fieldValue : JSON.stringify(field.fieldValue));
    setCascadeMessage(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
    setCascadeMessage(null);
  };

  const saveEdit = async (field: SubmittedField) => {
    setSaving(true);
    try {
      // Try to parse as JSON for complex values
      let parsedValue: unknown = editValue;
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        // Keep as string
      }
      const res = await fetch(`/api/personal-data/${personaId}/submitted`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldKey: field.fieldKey,
          fieldValue: parsedValue,
          category: field.category,
          source: "user_edit",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.cascadedTo?.length > 0) {
          setCascadeMessage(`Updated and notified ${data.cascadedTo.length} service(s)`);
        }
        setEditingKey(null);
        onRefresh();
      }
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const categories = CATEGORY_ORDER.filter((cat) => grouped[cat]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d70b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <h3 className="font-bold text-sm">Your submitted data</h3>
      </div>

      {cascadeMessage && (
        <div className="bg-blue-50 border border-govuk-blue rounded-lg p-3 mb-3 text-sm text-govuk-blue">
          {cascadeMessage}
        </div>
      )}

      <div className="space-y-4">
        {categories.map((cat) => {
          const catFields = grouped[cat];
          if (!catFields || catFields.length === 0) return null;

          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-govuk-dark-grey">
                  <path d={CATEGORY_ICONS[cat] || CATEGORY_ICONS.contact} />
                </svg>
                <span className="text-xs font-bold text-govuk-dark-grey uppercase tracking-wide">
                  {CATEGORY_LABELS[cat] || cat}
                </span>
              </div>
              <div className="space-y-1">
                {catFields.map((f) => {
                  const isComplex = !isSimpleValue(f.fieldValue);
                  const isExpanded = expandedKeys.has(f.fieldKey);

                  return (
                    <div key={f.fieldKey} className="border-b border-gray-100">
                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-sm text-govuk-dark-grey">
                          {formatKey(f.fieldKey)}
                        </span>
                        {editingKey === f.fieldKey ? (
                          <div className="flex items-center gap-2">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="text-sm border border-govuk-blue rounded px-2 py-1 w-48 min-h-[32px]"
                              rows={isComplex ? 4 : 1}
                              autoFocus
                            />
                            <button
                              onClick={() => saveEdit(f)}
                              disabled={saving}
                              className="text-xs bg-govuk-green text-white px-2 py-1 rounded"
                            >
                              {saving ? "..." : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-xs text-govuk-dark-grey"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            {isComplex ? (
                              <>
                                <span className="text-sm text-gray-600 truncate max-w-[180px]" title={inlineSummary(f.fieldKey, f.fieldValue)}>
                                  {inlineSummary(f.fieldKey, f.fieldValue)}
                                </span>
                                <button
                                  onClick={() => toggleExpanded(f.fieldKey)}
                                  className="text-xs text-govuk-blue underline shrink-0"
                                >
                                  {isExpanded ? "Hide" : "Show"}
                                </button>
                              </>
                            ) : (
                              <span className="text-sm max-w-[200px] truncate">
                                {String(f.fieldValue)}
                              </span>
                            )}
                            <button
                              onClick={() => startEdit(f)}
                              className="text-xs text-govuk-blue underline shrink-0"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                      {isComplex && isExpanded && editingKey !== f.fieldKey && (
                        <div className="pb-2 pl-2 border-l-2 border-gray-200 ml-1 mb-1">
                          {renderObjectSummary(f.fieldValue)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {fields.filter((f) => f.category !== "system").length === 0 && (
          <p className="text-sm text-govuk-dark-grey italic">No submitted data yet.</p>
        )}
      </div>
    </div>
  );
}
