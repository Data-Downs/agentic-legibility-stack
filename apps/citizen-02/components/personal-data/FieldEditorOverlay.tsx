"use client";

import React, { useState, useCallback, useEffect } from "react";

/** Deep-clone a value so edits don't mutate the original */
function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function isSimple(val: unknown): val is string | number | boolean {
  return typeof val === "string" || typeof val === "number" || typeof val === "boolean";
}

// ── Editable field components ──

function EditableScalar({
  value,
  onChange,
}: {
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  if (typeof value === "boolean") {
    return (
      <button
        onClick={() => onChange(!value)}
        className={`px-3 py-1 rounded text-sm font-medium ${
          value
            ? "bg-govuk-green/10 text-govuk-green border border-govuk-green/30"
            : "bg-gray-100 text-gray-500 border border-gray-200"
        }`}
      >
        {value ? "Yes" : "No"}
      </button>
    );
  }
  if (typeof value === "number") {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-govuk-blue focus:border-transparent"
      />
    );
  }
  // String — use textarea if long, input if short
  const isLong = value.length > 60 || value.includes("\n");
  if (isLong) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(6, Math.max(2, value.split("\n").length + 1))}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-govuk-blue focus:border-transparent resize-y"
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-govuk-blue focus:border-transparent"
    />
  );
}

function EditableArray({
  items,
  onChange,
  depth,
}: {
  items: unknown[];
  onChange: (items: unknown[]) => void;
  depth: number;
}) {
  const updateItem = (index: number, val: unknown) => {
    const next = [...items];
    next[index] = val;
    onChange(next);
  };
  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };
  const addItem = () => {
    // Infer type from existing items
    if (items.length > 0) {
      const sample = items[0];
      if (typeof sample === "string") onChange([...items, ""]);
      else if (typeof sample === "number") onChange([...items, 0]);
      else if (typeof sample === "object" && sample !== null) {
        // Clone structure with empty values
        const template: Record<string, unknown> = {};
        for (const k of Object.keys(sample as Record<string, unknown>)) {
          template[k] = "";
        }
        onChange([...items, template]);
      } else onChange([...items, ""]);
    } else {
      onChange([...items, ""]);
    }
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="relative bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-govuk-dark-grey uppercase tracking-wide">
              Item {i + 1}
            </span>
            <button
              onClick={() => removeItem(i)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
          {isSimple(item) ? (
            <EditableScalar value={item} onChange={(v) => updateItem(i, v)} />
          ) : typeof item === "object" && item !== null && !Array.isArray(item) ? (
            <EditableObject
              obj={item as Record<string, unknown>}
              onChange={(v) => updateItem(i, v)}
              depth={depth + 1}
            />
          ) : Array.isArray(item) ? (
            <EditableArray items={item} onChange={(v) => updateItem(i, v)} depth={depth + 1} />
          ) : (
            <span className="text-sm text-gray-400 italic">null</span>
          )}
        </div>
      ))}
      <button
        onClick={addItem}
        className="text-xs text-govuk-blue hover:underline flex items-center gap-1"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add item
      </button>
    </div>
  );
}

function EditableObject({
  obj,
  onChange,
  depth,
}: {
  obj: Record<string, unknown>;
  onChange: (obj: Record<string, unknown>) => void;
  depth: number;
}) {
  const updateField = (key: string, val: unknown) => {
    onChange({ ...obj, [key]: val });
  };

  return (
    <div className={`space-y-3 ${depth > 0 ? "" : ""}`}>
      {Object.entries(obj).map(([key, val]) => (
        <div key={key}>
          <label className="block text-sm font-medium text-govuk-dark-grey mb-1">
            {formatKey(key)}
          </label>
          {isSimple(val) ? (
            <EditableScalar value={val} onChange={(v) => updateField(key, v)} />
          ) : Array.isArray(val) ? (
            <EditableArray items={val} onChange={(v) => updateField(key, v)} depth={depth + 1} />
          ) : typeof val === "object" && val !== null ? (
            <div className="ml-3 pl-3 border-l-2 border-govuk-blue/20">
              <EditableObject
                obj={val as Record<string, unknown>}
                onChange={(v) => updateField(key, v)}
                depth={depth + 1}
              />
            </div>
          ) : (
            <span className="text-sm text-gray-400 italic">Empty</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main overlay ──

export function FieldEditorOverlay({
  field,
  personaId,
  onClose,
  onSaved,
}: {
  field: { fieldKey: string; fieldValue: unknown; category: string };
  personaId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<unknown>(() => deepClone(field.fieldValue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/personal-data/${personaId}/submitted`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldKey: field.fieldKey,
          fieldValue: draft,
          category: field.category,
          source: "user_edit",
        }),
      });
      if (res.ok) {
        onSaved();
        onClose();
      } else {
        setError("Failed to save. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [draft, field, personaId, onSaved, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Editor panel */}
      <div className="relative w-full max-w-2xl max-h-[90vh] mx-4 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-govuk-text">
              {formatKey(field.fieldKey)}
            </h2>
            <span className="text-xs text-govuk-dark-grey uppercase tracking-wide">
              {field.category}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {isSimple(draft) ? (
            <EditableScalar
              value={draft}
              onChange={(v) => setDraft(v)}
            />
          ) : Array.isArray(draft) ? (
            <EditableArray
              items={draft}
              onChange={(v) => setDraft(v)}
              depth={0}
            />
          ) : typeof draft === "object" && draft !== null ? (
            <EditableObject
              obj={draft as Record<string, unknown>}
              onChange={(v) => setDraft(v)}
              depth={0}
            />
          ) : (
            <p className="text-sm text-gray-400 italic">No editable content</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-govuk-dark-grey hover:text-govuk-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-govuk-green text-white text-sm font-medium rounded-md hover:bg-govuk-green/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
