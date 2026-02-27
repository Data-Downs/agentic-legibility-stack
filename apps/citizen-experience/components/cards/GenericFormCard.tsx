"use client";

import { useState, useCallback } from "react";
import type { CardDefinition } from "@als/schemas";
import { FieldRenderer } from "./field-renderers";

interface GenericFormCardProps {
  definition: CardDefinition;
  onSubmit: (fields: Record<string, string | number | boolean>) => void;
  disabled?: boolean;
  prefillData?: Record<string, string | number | boolean>;
}

export function GenericFormCard({
  definition,
  onSubmit,
  disabled,
  prefillData,
}: GenericFormCardProps) {
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

        return (
          <div key={field.key}>
            <label className="block text-sm font-semibold text-govuk-black mb-1.5">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <FieldRenderer
              field={field}
              value={values[field.key]}
              onChange={handleChange}
              disabled={disabled}
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
