"use client";

import type { CardFieldDef } from "@als/schemas";

interface FieldProps {
  field: CardFieldDef;
  value: string | number | boolean;
  onChange: (key: string, value: string | number | boolean) => void;
  disabled?: boolean;
}

const inputBase =
  "w-full text-sm border border-gray-200 rounded-xl px-4 py-3 text-govuk-black focus:outline-none focus:ring-2 focus:ring-govuk-yellow disabled:opacity-50";

export function TextInput({ field, value, onChange, disabled }: FieldProps) {
  return (
    <input
      type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
      value={String(value ?? "")}
      onChange={(e) => onChange(field.key, e.target.value)}
      placeholder={field.placeholder}
      disabled={disabled}
      className={inputBase}
    />
  );
}

export function NumberInput({ field, value, onChange, disabled }: FieldProps) {
  return (
    <input
      type="number"
      value={String(value ?? "")}
      onChange={(e) => onChange(field.key, e.target.value === "" ? "" : Number(e.target.value))}
      placeholder={field.placeholder}
      min={field.validation?.min}
      max={field.validation?.max}
      disabled={disabled}
      className={inputBase}
    />
  );
}

export function CurrencyInput({ field, value, onChange, disabled }: FieldProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-govuk-dark-grey">
        £
      </span>
      <input
        type="number"
        value={String(value ?? "")}
        onChange={(e) => onChange(field.key, e.target.value === "" ? "" : Number(e.target.value))}
        placeholder={field.placeholder}
        min={field.validation?.min ?? 0}
        max={field.validation?.max}
        disabled={disabled}
        className={`${inputBase} pl-7`}
      />
    </div>
  );
}

export function DateInput({ field, value, onChange, disabled }: FieldProps) {
  return (
    <input
      type="date"
      value={String(value ?? "")}
      onChange={(e) => onChange(field.key, e.target.value)}
      disabled={disabled}
      className={inputBase}
    />
  );
}

export function SelectInput({ field, value, onChange, disabled }: FieldProps) {
  return (
    <select
      value={String(value ?? "")}
      onChange={(e) => onChange(field.key, e.target.value)}
      disabled={disabled}
      className={inputBase}
    >
      <option value="">Select...</option>
      {field.options?.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function RadioGroup({ field, value, onChange, disabled }: FieldProps) {
  return (
    <div className="space-y-2">
      {field.options?.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(field.key, opt.value)}
            disabled={disabled}
            className={`w-full text-left text-sm rounded-xl border px-4 py-3 transition-colors disabled:opacity-50 ${
              isSelected
                ? "border-green-600 bg-green-50 ring-2 ring-green-200 font-medium"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function CheckboxInput({ field, value, onChange, disabled }: FieldProps) {
  const checked = value === true || value === "true";
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(field.key, e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-govuk-yellow"
      />
      <span className="text-govuk-black">{field.label}</span>
    </label>
  );
}

export function SortCodeInput({ field, value, onChange, disabled }: FieldProps) {
  const handleChange = (raw: string) => {
    // Auto-format: 12-34-56
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)].filter(Boolean);
    onChange(field.key, parts.join("-"));
  };

  return (
    <input
      type="text"
      value={String(value ?? "")}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={field.placeholder ?? "e.g. 12-34-56"}
      disabled={disabled}
      maxLength={8}
      className={inputBase}
    />
  );
}

export function AccountNumberInput({ field, value, onChange, disabled }: FieldProps) {
  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    onChange(field.key, digits);
  };

  return (
    <input
      type="text"
      value={String(value ?? "")}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={field.placeholder ?? "e.g. 12345678"}
      disabled={disabled}
      maxLength={8}
      className={inputBase}
    />
  );
}

export function ReadonlyField({ field, value }: Omit<FieldProps, "onChange" | "disabled">) {
  return (
    <div className="text-sm text-govuk-black bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
      {String(value ?? "—")}
    </div>
  );
}

export function ChecklistField({ field, value, onChange, disabled }: FieldProps) {
  // Value is a comma-separated string of checked values
  const checkedValues = new Set(String(value ?? "").split(",").filter(Boolean));

  const toggle = (optValue: string) => {
    const next = new Set(checkedValues);
    if (next.has(optValue)) {
      next.delete(optValue);
    } else {
      next.add(optValue);
    }
    onChange(field.key, Array.from(next).join(","));
  };

  return (
    <div className="space-y-2">
      {field.options?.map((opt) => {
        const isChecked = checkedValues.has(opt.value);
        return (
          <label
            key={opt.value}
            className={`flex items-center gap-3 text-sm rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
              isChecked
                ? "border-green-600 bg-green-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggle(opt.value)}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-govuk-yellow"
            />
            <span className={isChecked ? "line-through text-govuk-dark-grey" : "text-govuk-black"}>
              {opt.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Renders the correct input component for a CardFieldDef type */
export function FieldRenderer({ field, value, onChange, disabled }: FieldProps) {
  switch (field.type) {
    case "text":
    case "email":
    case "phone":
      return <TextInput field={field} value={value} onChange={onChange} disabled={disabled} />;
    case "number":
      return <NumberInput field={field} value={value} onChange={onChange} disabled={disabled} />;
    case "currency":
      return <CurrencyInput field={field} value={value} onChange={onChange} disabled={disabled} />;
    case "date":
      return <DateInput field={field} value={value} onChange={onChange} disabled={disabled} />;
    case "select":
      return <SelectInput field={field} value={value} onChange={onChange} disabled={disabled} />;
    case "radio":
      return <RadioGroup field={field} value={value} onChange={onChange} disabled={disabled} />;
    case "checkbox":
      return <CheckboxInput field={field} value={value} onChange={onChange} disabled={disabled} />;
    case "sort-code":
      return <SortCodeInput field={field} value={value} onChange={onChange} disabled={disabled} />;
    case "account-number":
      return <AccountNumberInput field={field} value={value} onChange={onChange} disabled={disabled} />;
    case "readonly":
      return <ReadonlyField field={field} value={value} />;
    case "checklist":
      return <ChecklistField field={field} value={value} onChange={onChange} disabled={disabled} />;
    case "address":
      // Address fields rendered as a group of text inputs
      return <TextInput field={field} value={value} onChange={onChange} disabled={disabled} />;
    default:
      return <TextInput field={field} value={value} onChange={onChange} disabled={disabled} />;
  }
}
