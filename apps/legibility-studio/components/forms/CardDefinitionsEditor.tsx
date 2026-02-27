"use client";

import DynamicList from "./DynamicList";

/** A field definition within a card */
interface CardFieldItem {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string;
  category: string;
  prefillFrom: string;
}

/** A card definition within a state mapping */
interface CardItem {
  cardType: string;
  title: string;
  description: string;
  submitLabel: string;
  dataCategory: string;
  fields: CardFieldItem[];
}

/** A state → cards mapping */
export interface StateCardMappingItem {
  stateId: string;
  cards: CardItem[];
}

const FIELD_TYPES = [
  "text", "number", "email", "phone", "date", "select", "radio",
  "checkbox", "address", "currency", "sort-code", "account-number", "readonly", "checklist",
];

function emptyField(): CardFieldItem {
  return { key: "", label: "", type: "text", required: false, placeholder: "", category: "", prefillFrom: "" };
}

function emptyCard(): CardItem {
  return { cardType: "", title: "", description: "", submitLabel: "Confirm", dataCategory: "", fields: [emptyField()] };
}

export function emptyMapping(): StateCardMappingItem {
  return { stateId: "", cards: [emptyCard()] };
}

interface CardDefinitionsEditorProps {
  mappings: StateCardMappingItem[];
  onChange: (mappings: StateCardMappingItem[]) => void;
  /** Available state IDs from the state model (for dropdown) */
  stateIds?: string[];
}

export default function CardDefinitionsEditor({ mappings, onChange, stateIds }: CardDefinitionsEditorProps) {
  const inputClass = "w-full border border-studio-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-studio-accent";

  return (
    <DynamicList
      items={mappings}
      onAdd={() => onChange([...mappings, emptyMapping()])}
      onRemove={(i) => onChange(mappings.filter((_, idx) => idx !== i))}
      onChange={(i, item) => onChange(mappings.map((m, idx) => idx === i ? item : m))}
      addLabel="Add state mapping"
      renderItem={(mapping, _mi, onMappingChange) => (
        <div className="space-y-3 pr-12">
          {/* State ID */}
          <div>
            <label className="block text-xs font-bold mb-1">State ID</label>
            {stateIds && stateIds.length > 0 ? (
              <select
                value={mapping.stateId}
                onChange={(e) => onMappingChange({ ...mapping, stateId: e.target.value })}
                className={inputClass}
              >
                <option value="">Select state...</option>
                {stateIds.map((sid) => (
                  <option key={sid} value={sid}>{sid}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={mapping.stateId}
                onChange={(e) => onMappingChange({ ...mapping, stateId: e.target.value })}
                placeholder="e.g. details-submitted"
                className={inputClass}
              />
            )}
          </div>

          {/* Cards for this state */}
          <label className="block text-xs font-bold mt-2">Cards</label>
          <DynamicList
            items={mapping.cards}
            onAdd={() => onMappingChange({ ...mapping, cards: [...mapping.cards, emptyCard()] })}
            onRemove={(ci) => onMappingChange({ ...mapping, cards: mapping.cards.filter((_, idx) => idx !== ci) })}
            onChange={(ci, card) => onMappingChange({ ...mapping, cards: mapping.cards.map((c, idx) => idx === ci ? card : c) })}
            addLabel="Add card"
            renderItem={(card, _ci, onCardChange) => (
              <div className="space-y-2 pr-12">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={card.cardType} onChange={(e) => onCardChange({ ...card, cardType: e.target.value })} placeholder="Card type (e.g. household-details)" className={inputClass} />
                  <input type="text" value={card.dataCategory} onChange={(e) => onCardChange({ ...card, dataCategory: e.target.value })} placeholder="Data category" className={inputClass} />
                </div>
                <input type="text" value={card.title} onChange={(e) => onCardChange({ ...card, title: e.target.value })} placeholder="Card title" className={inputClass} />
                <input type="text" value={card.description} onChange={(e) => onCardChange({ ...card, description: e.target.value })} placeholder="Description (optional)" className={inputClass} />
                <input type="text" value={card.submitLabel} onChange={(e) => onCardChange({ ...card, submitLabel: e.target.value })} placeholder="Submit button label" className={inputClass} />

                {/* Fields */}
                <label className="block text-xs font-bold mt-2">Fields</label>
                <DynamicList
                  items={card.fields}
                  onAdd={() => onCardChange({ ...card, fields: [...card.fields, emptyField()] })}
                  onRemove={(fi) => onCardChange({ ...card, fields: card.fields.filter((_, idx) => idx !== fi) })}
                  onChange={(fi, field) => onCardChange({ ...card, fields: card.fields.map((f, idx) => idx === fi ? field : f) })}
                  addLabel="Add field"
                  renderItem={(field, _fi, onFieldChange) => (
                    <div className="space-y-1 pr-12">
                      <div className="grid grid-cols-3 gap-2">
                        <input type="text" value={field.key} onChange={(e) => onFieldChange({ ...field, key: e.target.value })} placeholder="Field key" className={inputClass} />
                        <input type="text" value={field.label} onChange={(e) => onFieldChange({ ...field, label: e.target.value })} placeholder="Label" className={inputClass} />
                        <select value={field.type} onChange={(e) => onFieldChange({ ...field, type: e.target.value })} className={inputClass}>
                          {FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="text" value={field.placeholder} onChange={(e) => onFieldChange({ ...field, placeholder: e.target.value })} placeholder="Placeholder" className={inputClass} />
                        <input type="text" value={field.category} onChange={(e) => onFieldChange({ ...field, category: e.target.value })} placeholder="Category" className={inputClass} />
                        <input type="text" value={field.prefillFrom} onChange={(e) => onFieldChange({ ...field, prefillFrom: e.target.value })} placeholder="Prefill from (optional)" className={inputClass} />
                      </div>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={field.required} onChange={(e) => onFieldChange({ ...field, required: e.target.checked })} />
                        Required
                      </label>
                    </div>
                  )}
                />
              </div>
            )}
          />
        </div>
      )}
    />
  );
}
