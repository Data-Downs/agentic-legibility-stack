"use client";

export interface SchemaField {
  name: string;
  type: string;
}

interface KeyValueEditorProps {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
  label?: string;
}

export default function KeyValueEditor({ fields, onChange, label }: KeyValueEditorProps) {
  function addField() {
    onChange([...fields, { name: "", type: "string" }]);
  }

  function removeField(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function updateField(index: number, key: keyof SchemaField, value: string) {
    const updated = fields.map((f, i) =>
      i === index ? { ...f, [key]: value } : f
    );
    onChange(updated);
  }

  return (
    <div>
      {label && <label className="block text-sm font-bold mb-2">{label}</label>}
      <div className="space-y-2">
        {fields.map((field, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              value={field.name}
              onChange={(e) => updateField(i, "name", e.target.value)}
              placeholder="Field name"
              className="flex-1 border border-govuk-mid-grey rounded px-2 py-1 text-sm"
            />
            <select
              value={field.type}
              onChange={(e) => updateField(i, "type", e.target.value)}
              className="border border-govuk-mid-grey rounded px-2 py-1 text-sm"
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="array">array</option>
              <option value="object">object</option>
            </select>
            <button
              type="button"
              onClick={() => removeField(i)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addField}
        className="text-sm text-govuk-blue hover:underline mt-2"
      >
        + Add field
      </button>
    </div>
  );
}
