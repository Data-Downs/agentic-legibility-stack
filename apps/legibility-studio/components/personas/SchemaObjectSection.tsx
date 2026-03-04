"use client";

import FormField from "@/components/forms/FormField";
import type { ObjectSectionSchema, FieldDef } from "./persona-schemas";
import SchemaFieldRenderer from "./SchemaFieldRenderer";
import Section from "./Section";
import JsonSection from "./JsonSection";

interface Props {
  schema: ObjectSectionSchema;
  data: Record<string, unknown> | undefined;
  onChange: (updated: Record<string, unknown>) => void;
  defaultOpen?: boolean;
}

export default function SchemaObjectSection({
  schema,
  data,
  onChange,
  defaultOpen,
}: Props) {
  const obj = data ?? {};

  function set(key: string, val: unknown) {
    onChange({ ...obj, [key]: val });
  }

  function setSubSection(subKey: string, fieldKey: string, val: unknown) {
    const sub = (obj[subKey] ?? {}) as Record<string, unknown>;
    onChange({ ...obj, [subKey]: { ...sub, [fieldKey]: val } });
  }

  function addSubSection(subKey: string, fields: FieldDef[]) {
    const blank = Object.fromEntries(
      fields.map((f) => [f.key, f.type === "number" ? 0 : f.type === "boolean" ? false : ""])
    );
    onChange({ ...obj, [subKey]: blank });
  }

  function removeSubSection(subKey: string) {
    const next = { ...obj };
    delete next[subKey];
    onChange(next);
  }

  // Collect all known keys from schema
  const knownKeys = new Set(schema.fields.map((f) => f.key));
  if (schema.subSections) {
    for (const sub of schema.subSections) {
      knownKeys.add(sub.key);
    }
  }

  // Check for couple/multi-person pattern:
  // If no data keys match the schema AND all values are plain objects,
  // render as named sub-sections per person
  const dataKeys = Object.keys(obj);
  const isMultiPerson =
    dataKeys.length > 0 &&
    dataKeys.every(
      (k) =>
        !knownKeys.has(k) &&
        typeof obj[k] === "object" &&
        obj[k] !== null &&
        !Array.isArray(obj[k])
    );

  if (isMultiPerson) {
    return (
      <Section
        title={schema.title}
        defaultOpen={defaultOpen}
        badge={`${dataKeys.length} people`}
      >
        {dataKeys.map((personKey) => {
          const personData = obj[personKey] as Record<string, unknown>;
          return (
            <div
              key={personKey}
              className="border border-studio-border rounded-lg p-4 mb-3 last:mb-0"
            >
              <h4 className="text-sm font-bold text-gray-700 mb-3 capitalize">
                {personKey}
              </h4>
              <FieldGrid
                fields={schema.fields}
                data={personData}
                onChange={(fieldKey, val) => {
                  set(personKey, { ...personData, [fieldKey]: val });
                }}
              />
              {/* Extra keys within this person object */}
              <ExtraKeysJson
                data={personData}
                knownKeys={new Set(schema.fields.map((f) => f.key))}
                onChange={(updated) => set(personKey, updated)}
              />
            </div>
          );
        })}
      </Section>
    );
  }

  // Determine which fields to show: non-optional always, optional only when value exists
  const visibleFields = schema.fields.filter(
    (f) => !f.optional || obj[f.key] !== undefined
  );

  // Collect extra keys not in schema
  const extraKeys = dataKeys.filter((k) => !knownKeys.has(k));

  return (
    <Section title={schema.title} defaultOpen={defaultOpen}>
      {visibleFields.length > 0 && (
        <FieldGrid
          fields={visibleFields}
          data={obj}
          onChange={(key, val) => set(key, val)}
        />
      )}

      {/* Sub-sections */}
      {schema.subSections?.map((sub) => {
        const subData = obj[sub.key] as Record<string, unknown> | undefined;
        if (!subData) {
          return (
            <div key={sub.key} className="mt-3">
              <button
                type="button"
                onClick={() => addSubSection(sub.key, sub.fields)}
                className="text-sm text-govuk-blue hover:underline"
              >
                + Add {sub.title}
              </button>
            </div>
          );
        }
        return (
          <div
            key={sub.key}
            className="border border-studio-border rounded-lg p-3 mt-3 bg-gray-50"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                {sub.title}
              </h4>
              <button
                type="button"
                onClick={() => removeSubSection(sub.key)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
            <FieldGrid
              fields={sub.fields.filter(
                (f) => !f.optional || subData[f.key] !== undefined
              )}
              data={subData}
              onChange={(key, val) => setSubSection(sub.key, key, val)}
            />
            {/* String arrays within sub-sections (e.g., equipment) */}
            {Object.entries(subData)
              .filter(
                ([k, v]) =>
                  !sub.fields.some((f) => f.key === k) && Array.isArray(v)
              )
              .map(([k, v]) => (
                <div key={k} className="mt-2">
                  <label className="block text-sm font-bold mb-1 capitalize">
                    {k.replace(/([A-Z])/g, " $1").trim()}
                  </label>
                  <StringArrayEditor
                    items={v as string[]}
                    onChange={(updated) =>
                      setSubSection(sub.key, k, updated)
                    }
                  />
                </div>
              ))}
          </div>
        );
      })}

      {/* Extra keys as JSON fallback */}
      {extraKeys.length > 0 && (
        <ExtraKeysJson data={obj} knownKeys={knownKeys} onChange={onChange} />
      )}
    </Section>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function FieldGrid({
  fields,
  data,
  onChange,
}: {
  fields: FieldDef[];
  data: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
      {fields.map((field) => (
        <FormField key={field.key} label={field.label} hint={field.hint}>
          <SchemaFieldRenderer
            field={field}
            value={data[field.key]}
            onChange={(val) => onChange(field.key, val)}
          />
        </FormField>
      ))}
    </div>
  );
}

function StringArrayEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (updated: string[]) => void;
}) {
  const inputClass =
    "w-full border border-studio-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-studio-accent";

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={inputClass}
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="text-xs text-red-600 hover:text-red-800 shrink-0"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="text-sm text-govuk-blue hover:underline"
      >
        + Add item
      </button>
    </div>
  );
}

function ExtraKeysJson({
  data,
  knownKeys,
  onChange,
}: {
  data: Record<string, unknown>;
  knownKeys: Set<string>;
  onChange: (updated: Record<string, unknown>) => void;
}) {
  const extras = Object.fromEntries(
    Object.entries(data).filter(([k]) => !knownKeys.has(k))
  );
  if (Object.keys(extras).length === 0) return null;

  return (
    <div className="mt-3">
      <JsonSection
        label="Additional fields"
        value={extras}
        onChange={(val) => {
          // Merge back: keep known keys from original, replace extras
          const known = Object.fromEntries(
            Object.entries(data).filter(([k]) => knownKeys.has(k))
          );
          onChange({ ...known, ...(val as Record<string, unknown>) });
        }}
      />
    </div>
  );
}
