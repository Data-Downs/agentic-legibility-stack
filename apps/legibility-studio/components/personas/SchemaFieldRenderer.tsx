"use client";

import type { FieldDef } from "./persona-schemas";

const inputClass =
  "w-full border border-studio-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-studio-accent";

interface Props {
  field: FieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
}

export default function SchemaFieldRenderer({ field, value, onChange }: Props) {
  switch (field.type) {
    case "text":
      return (
        <input
          className={inputClass}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <textarea
          className={inputClass}
          value={(value as string) ?? ""}
          placeholder={field.placeholder}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <input
          type="number"
          className={inputClass}
          value={value !== undefined && value !== null ? String(value) : ""}
          placeholder={field.placeholder}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? 0 : parseFloat(v) || 0);
          }}
        />
      );

    case "date":
      return (
        <input
          type="date"
          className={inputClass}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "select":
      return (
        <select
          className={inputClass}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Select...
          </option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "boolean":
      return (
        <select
          className={inputClass}
          value={value === true ? "yes" : value === false ? "no" : ""}
          onChange={(e) => onChange(e.target.value === "yes")}
        >
          <option value="" disabled>
            Select...
          </option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );

    default:
      return (
        <input
          className={inputClass}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
