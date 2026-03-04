"use client";

import DynamicList from "@/components/forms/DynamicList";
import { childrenSchema } from "./persona-schemas";
import SchemaArraySection from "./SchemaArraySection";
import Section from "./Section";

const inputClass =
  "w-full border border-studio-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-studio-accent";

interface Props {
  data: Record<string, unknown> | undefined;
  onChange: (updated: Record<string, unknown>) => void;
}

export default function FamilySection({ data, onChange }: Props) {
  const family = data ?? {};
  const children = (family.children ?? []) as unknown[];
  const notes = (family.notes as string) ?? "";
  const supportNetwork = (family.supportNetwork ?? []) as string[];

  function update(patch: Record<string, unknown>) {
    onChange({ ...family, ...patch });
  }

  return (
    <Section title="Family">
      <div className="space-y-4">
        {/* Notes */}
        <div>
          <label className="block text-sm font-bold mb-1">Notes</label>
          <textarea
            className={inputClass}
            value={notes}
            rows={2}
            onChange={(e) => update({ notes: e.target.value })}
          />
        </div>

        {/* Children */}
        <SchemaArraySection
          schema={childrenSchema}
          data={children}
          onChange={(val) => update({ children: val })}
        />

        {/* Support Network (string array) */}
        <Section
          title="Support Network"
          badge={
            supportNetwork.length > 0
              ? `${supportNetwork.length}`
              : undefined
          }
        >
          {supportNetwork.length === 0 && (
            <p className="text-sm text-gray-400 mb-2">None listed.</p>
          )}
          <DynamicList
            items={supportNetwork}
            addLabel="Add contact"
            onAdd={() =>
              update({ supportNetwork: [...supportNetwork, ""] })
            }
            onRemove={(i) =>
              update({
                supportNetwork: supportNetwork.filter(
                  (_, idx) => idx !== i
                ),
              })
            }
            onChange={(i, val) =>
              update({
                supportNetwork: supportNetwork.map((v, idx) =>
                  idx === i ? val : v
                ),
              })
            }
            renderItem={(item, _i, onItemChange) => (
              <input
                className={inputClass}
                value={item}
                onChange={(e) => onItemChange(e.target.value)}
              />
            )}
          />
        </Section>
      </div>
    </Section>
  );
}
