"use client";

import FormField from "@/components/forms/FormField";
import DynamicList from "@/components/forms/DynamicList";
import type { ArraySectionSchema } from "./persona-schemas";
import { blankItem } from "./persona-schemas";
import SchemaFieldRenderer from "./SchemaFieldRenderer";
import Section from "./Section";

interface Props {
  schema: ArraySectionSchema;
  data: unknown[] | undefined;
  onChange: (updated: unknown[]) => void;
  defaultOpen?: boolean;
}

export default function SchemaArraySection({
  schema,
  data,
  onChange,
  defaultOpen,
}: Props) {
  const items = data ?? [];
  const count = items.length;

  // Detect string array (e.g., conditions: ["None"])
  const isStringArray =
    count > 0 && items.every((item) => typeof item === "string");

  return (
    <Section
      title={schema.title}
      defaultOpen={defaultOpen}
      badge={count > 0 ? `${count}` : undefined}
    >
      {count === 0 && (
        <p className="text-sm text-gray-400 mb-3">
          No {schema.itemLabel}s yet.
        </p>
      )}

      {isStringArray ? (
        <StringArrayList
          items={items as string[]}
          itemLabel={schema.itemLabel}
          onChange={onChange}
        />
      ) : (
        <DynamicList
          items={items as Record<string, unknown>[]}
          addLabel={`Add ${schema.itemLabel}`}
          onAdd={() =>
            onChange([...items, blankItem(schema.fields)])
          }
          onRemove={(i) => onChange(items.filter((_, idx) => idx !== i))}
          onChange={(i, updated) =>
            onChange(items.map((item, idx) => (idx === i ? updated : item)))
          }
          renderItem={(item, _i, onItemChange) => (
            <ItemFields
              fields={schema.fields}
              item={item}
              onChange={onItemChange}
            />
          )}
        />
      )}

      {count === 0 && !isStringArray && (
        <button
          type="button"
          onClick={() =>
            onChange([blankItem(schema.fields)])
          }
          className="text-sm text-govuk-blue hover:underline"
        >
          + Add {schema.itemLabel}
        </button>
      )}
    </Section>
  );
}

// ─── Item fields renderer ───────────────────────────────────────────

function ItemFields({
  fields,
  item,
  onChange,
}: {
  fields: ArraySectionSchema["fields"];
  item: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}) {
  // Show all schema fields (non-optional always, optional when value exists)
  const visibleFields = fields.filter(
    (f) => !f.optional || item[f.key] !== undefined
  );

  // Extra keys not in schema
  const knownKeys = new Set(fields.map((f) => f.key));
  const extraEntries = Object.entries(item).filter(([k]) => !knownKeys.has(k));

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        {visibleFields.map((field) => (
          <FormField key={field.key} label={field.label} hint={field.hint}>
            <SchemaFieldRenderer
              field={field}
              value={item[field.key]}
              onChange={(val) => onChange({ ...item, [field.key]: val })}
            />
          </FormField>
        ))}
      </div>
      {extraEntries.length > 0 && (
        <div className="mt-2 pt-2 border-t border-studio-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            {extraEntries.map(([key, val]) => (
              <FormField
                key={key}
                label={key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (c) => c.toUpperCase())
                  .trim()}
              >
                {typeof val === "object" ? (
                  <textarea
                    className="w-full border border-studio-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-studio-accent"
                    value={JSON.stringify(val, null, 2)}
                    rows={3}
                    readOnly
                  />
                ) : (
                  <input
                    className="w-full border border-studio-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-studio-accent"
                    value={String(val ?? "")}
                    onChange={(e) =>
                      onChange({ ...item, [key]: e.target.value })
                    }
                  />
                )}
              </FormField>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Simple string array list ───────────────────────────────────────

function StringArrayList({
  items,
  itemLabel,
  onChange,
}: {
  items: string[];
  itemLabel: string;
  onChange: (updated: unknown[]) => void;
}) {
  const inputClass =
    "w-full border border-studio-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-studio-accent";

  return (
    <div className="space-y-2">
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
        + Add {itemLabel}
      </button>
    </div>
  );
}
