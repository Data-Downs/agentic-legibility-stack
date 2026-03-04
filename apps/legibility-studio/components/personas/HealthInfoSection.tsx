"use client";

import FormField from "@/components/forms/FormField";
import DynamicList from "@/components/forms/DynamicList";
import {
  healthConditionsSchema,
  healthMedicationsSchema,
  healthAppointmentsSchema,
} from "./persona-schemas";
import SchemaArraySection from "./SchemaArraySection";
import Section from "./Section";

const inputClass =
  "w-full border border-studio-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-studio-accent";

interface Props {
  data: Record<string, unknown> | undefined;
  onChange: (updated: Record<string, unknown>) => void;
}

export default function HealthInfoSection({ data, onChange }: Props) {
  const health = data ?? {};

  function update(patch: Record<string, unknown>) {
    onChange({ ...health, ...patch });
  }

  // Check for couple pattern (emma-parker: {emma: {...}, liam: {...}})
  const dataKeys = Object.keys(health);
  const scalarKeys = new Set([
    "gpSurgery",
    "nhsNumber",
    "conditions",
    "medications",
    "mobilityAids",
    "hospitalAppointments",
    "privateHealthInsurance",
  ]);
  const isMultiPerson =
    dataKeys.length > 0 &&
    dataKeys.every(
      (k) =>
        !scalarKeys.has(k) &&
        typeof health[k] === "object" &&
        health[k] !== null &&
        !Array.isArray(health[k])
    );

  if (isMultiPerson) {
    return (
      <Section title="Health Info" badge={`${dataKeys.length} people`}>
        {dataKeys.map((personKey) => {
          const personData = health[personKey] as Record<string, unknown>;
          return (
            <div
              key={personKey}
              className="border border-studio-border rounded-lg p-4 mb-3 last:mb-0"
            >
              <h4 className="text-sm font-bold text-gray-700 mb-3 capitalize">
                {personKey}
              </h4>
              <HealthInfoFields
                data={personData}
                onChange={(updated) => update({ [personKey]: updated })}
              />
            </div>
          );
        })}
      </Section>
    );
  }

  return (
    <Section title="Health Info">
      <HealthInfoFields data={health} onChange={onChange} />
    </Section>
  );
}

// ─── Inner fields component ─────────────────────────────────────────

function HealthInfoFields({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}) {
  function update(patch: Record<string, unknown>) {
    onChange({ ...data, ...patch });
  }

  const conditions = (data.conditions ?? []) as unknown[];
  const medications = (data.medications ?? []) as unknown[];
  const mobilityAids = (data.mobilityAids ?? []) as string[];
  const appointments = (data.hospitalAppointments ?? []) as unknown[];

  return (
    <div className="space-y-4">
      {/* Scalar fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <FormField label="GP Surgery">
          <input
            className={inputClass}
            value={(data.gpSurgery as string) ?? ""}
            onChange={(e) => update({ gpSurgery: e.target.value })}
          />
        </FormField>
        {(data.nhsNumber !== undefined || true) && (
          <FormField label="NHS Number">
            <input
              className={inputClass}
              value={(data.nhsNumber as string) ?? ""}
              onChange={(e) => update({ nhsNumber: e.target.value })}
            />
          </FormField>
        )}
        {data.privateHealthInsurance !== undefined && (
          <FormField label="Private Health Insurance">
            <input
              className={inputClass}
              value={(data.privateHealthInsurance as string) ?? ""}
              onChange={(e) =>
                update({ privateHealthInsurance: e.target.value })
              }
            />
          </FormField>
        )}
      </div>

      {/* Conditions */}
      <SchemaArraySection
        schema={healthConditionsSchema}
        data={conditions}
        onChange={(val) => update({ conditions: val })}
      />

      {/* Medications */}
      <SchemaArraySection
        schema={healthMedicationsSchema}
        data={medications}
        onChange={(val) => update({ medications: val })}
      />

      {/* Hospital Appointments */}
      {(appointments.length > 0 || data.hospitalAppointments !== undefined) && (
        <SchemaArraySection
          schema={healthAppointmentsSchema}
          data={appointments}
          onChange={(val) => update({ hospitalAppointments: val })}
        />
      )}

      {/* Mobility Aids (string array) */}
      {(mobilityAids.length > 0 || data.mobilityAids !== undefined) && (
        <Section title="Mobility Aids" badge={mobilityAids.length > 0 ? `${mobilityAids.length}` : undefined}>
          <DynamicList
            items={mobilityAids}
            addLabel="Add mobility aid"
            onAdd={() => update({ mobilityAids: [...mobilityAids, ""] })}
            onRemove={(i) =>
              update({
                mobilityAids: mobilityAids.filter((_, idx) => idx !== i),
              })
            }
            onChange={(i, val) =>
              update({
                mobilityAids: mobilityAids.map((v, idx) =>
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
      )}
    </div>
  );
}
