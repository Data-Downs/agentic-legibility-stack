"use client";

import DynamicList from "@/components/forms/DynamicList";
import { benefitsCurrentSchema, benefitsPreviousSchema, blankItem } from "./persona-schemas";
import SchemaArraySection from "./SchemaArraySection";
import Section from "./Section";

interface Props {
  data: Record<string, unknown> | undefined;
  onChange: (updated: Record<string, unknown>) => void;
}

export default function BenefitsSection({ data, onChange }: Props) {
  const benefits = data ?? {};
  const currentlyReceiving = (benefits.currentlyReceiving ?? []) as unknown[];
  const previousClaims = (benefits.previousClaims ?? []) as unknown[];
  const eligibleFor = (benefits.potentiallyEligibleFor ?? []) as string[];

  function update(patch: Record<string, unknown>) {
    onChange({ ...benefits, ...patch });
  }

  const inputClass =
    "w-full border border-studio-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-studio-accent";

  return (
    <Section title="Benefits">
      <div className="space-y-4">
        {/* Currently Receiving */}
        <SchemaArraySection
          schema={benefitsCurrentSchema}
          data={currentlyReceiving}
          onChange={(val) => update({ currentlyReceiving: val })}
        />

        {/* Previous Claims */}
        <SchemaArraySection
          schema={benefitsPreviousSchema}
          data={previousClaims}
          onChange={(val) => update({ previousClaims: val })}
        />

        {/* Potentially Eligible For (string array) */}
        <Section title="Potentially Eligible For" badge={eligibleFor.length > 0 ? `${eligibleFor.length}` : undefined}>
          {eligibleFor.length === 0 && (
            <p className="text-sm text-gray-400 mb-2">None listed.</p>
          )}
          <DynamicList
            items={eligibleFor}
            addLabel="Add eligibility"
            onAdd={() => update({ potentiallyEligibleFor: [...eligibleFor, ""] })}
            onRemove={(i) =>
              update({
                potentiallyEligibleFor: eligibleFor.filter((_, idx) => idx !== i),
              })
            }
            onChange={(i, val) =>
              update({
                potentiallyEligibleFor: eligibleFor.map((v, idx) =>
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
