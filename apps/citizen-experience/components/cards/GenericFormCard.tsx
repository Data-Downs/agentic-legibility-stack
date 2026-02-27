"use client";

import { useState, useCallback } from "react";
import type { CardDefinition } from "@als/schemas";
import { FieldRenderer } from "./field-renderers";

interface GenericFormCardProps {
  definition: CardDefinition;
  onSubmit: (fields: Record<string, string | number | boolean>) => void;
  disabled?: boolean;
  prefillData?: Record<string, string | number | boolean>;
  /** Field keys that are Tier 1 (verified) and should be rendered as read-only */
  readonlyFields?: string[];
}

export function GenericFormCard({
  definition,
  onSubmit,
  disabled,
  prefillData,
  readonlyFields,
}: GenericFormCardProps) {
  const readonlySet = new Set(readonlyFields || []);
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() => {
    const initial: Record<string, string | number | boolean> = {};
    for (const field of definition.fields) {
      initial[field.key] = prefillData?.[field.key] ?? "";
    }
    return initial;
  });

  const handleChange = useCallback((key: string, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isFieldVisible = (field: typeof definition.fields[number]): boolean => {
    if (!field.showWhen) return true;
    const depValue = String(values[field.showWhen.field] ?? "");
    return field.showWhen.values.includes(depValue);
  };

  const canSubmit = definition.fields
    .filter((f) => f.required && isFieldVisible(f))
    .every((f) => {
      const val = values[f.key];
      return val !== "" && val !== undefined && val !== null;
    });

  const handleSubmit = () => {
    if (!canSubmit) return;
    // Only include visible fields
    const submittable: Record<string, string | number | boolean> = {};
    for (const field of definition.fields) {
      if (isFieldVisible(field) && values[field.key] !== "" && values[field.key] !== undefined) {
        submittable[field.key] = values[field.key];
      }
    }
    onSubmit(submittable);
  };

  return (
    <div className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
      {definition.description && (
        <p className="text-xs text-govuk-dark-grey">{definition.description}</p>
      )}

      {definition.fields.map((field) => {
        if (!isFieldVisible(field)) return null;

        // Checkbox has label inline
        if (field.type === "checkbox") {
          return (
            <div key={field.key}>
              <FieldRenderer
                field={field}
                value={values[field.key]}
                onChange={handleChange}
                disabled={disabled}
              />
            </div>
          );
        }

        const isReadonly = readonlySet.has(field.key);

        return (
          <div key={field.key}>
            <label className="block text-sm font-semibold text-govuk-black mb-1.5">
              {field.label}
              {field.required && !isReadonly && <span className="text-red-500 ml-0.5">*</span>}
              {isReadonly && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                  Verified
                </span>
              )}
            </label>
            <FieldRenderer
              field={field}
              value={values[field.key]}
              onChange={handleChange}
              disabled={disabled || isReadonly}
            />
          </div>
        );
      })}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || disabled}
        className="w-full text-sm font-bold text-white py-3 rounded-xl transition-opacity disabled:opacity-40"
        style={{ backgroundColor: "#00703c" }}
      >
        {definition.submitLabel ?? "Confirm details"}
      </button>
    </div>
  );
}
