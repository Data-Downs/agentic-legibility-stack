"use client";

import FormField from "@/components/forms/FormField";
import DynamicList from "@/components/forms/DynamicList";
import JsonSection from "./JsonSection";
import Section from "./Section";
import SchemaObjectSection from "./SchemaObjectSection";
import SchemaArraySection from "./SchemaArraySection";
import BenefitsSection from "./BenefitsSection";
import HealthInfoSection from "./HealthInfoSection";
import FamilySection from "./FamilySection";
import {
  ALL_STRUCTURED_KEYS,
  credentialsSchema,
  vehiclesSchema,
  employmentSchema,
  spouseEmploymentSchema,
  financialsSchema,
  housingSchema,
  partnerSchema,
  spouseSchema,
  deceasedSchema,
  pregnancySchema,
  businessAssetsSchema,
  childrenSchema,
} from "./persona-schemas";

const inputClass =
  "w-full border border-studio-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-studio-accent";

interface Props {
  data: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}

function ContactFields({
  contact,
  onChange,
}: {
  contact: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  function set(key: string, val: string) {
    onChange({ ...contact, [key]: val });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
      <FormField label="First Name">
        <input className={inputClass} value={(contact.firstName as string) ?? ""} onChange={(e) => set("firstName", e.target.value)} />
      </FormField>
      <FormField label="Last Name">
        <input className={inputClass} value={(contact.lastName as string) ?? ""} onChange={(e) => set("lastName", e.target.value)} />
      </FormField>
      <FormField label="Date of Birth">
        <input type="date" className={inputClass} value={(contact.dateOfBirth as string) ?? ""} onChange={(e) => set("dateOfBirth", e.target.value)} />
      </FormField>
      <FormField label="NI Number">
        <input className={inputClass} value={(contact.nationalInsuranceNumber as string) ?? ""} onChange={(e) => set("nationalInsuranceNumber", e.target.value)} />
      </FormField>
      <FormField label="Email">
        <input type="email" className={inputClass} value={(contact.email as string) ?? ""} onChange={(e) => set("email", e.target.value)} />
      </FormField>
      <FormField label="Phone">
        <input className={inputClass} value={(contact.phone as string) ?? ""} onChange={(e) => set("phone", e.target.value)} />
      </FormField>
      {contact.mobile !== undefined && (
        <FormField label="Mobile">
          <input className={inputClass} value={(contact.mobile as string) ?? ""} onChange={(e) => set("mobile", e.target.value)} />
        </FormField>
      )}
      {contact.middleName !== undefined && (
        <FormField label="Middle Name">
          <input className={inputClass} value={(contact.middleName as string) ?? ""} onChange={(e) => set("middleName", e.target.value)} />
        </FormField>
      )}
    </div>
  );
}

function AddressFields({
  address,
  onChange,
}: {
  address: Record<string, unknown>;
  onChange: (a: Record<string, unknown>) => void;
}) {
  function set(key: string, val: string) {
    onChange({ ...address, [key]: val });
  }

  // Support both line_1/line_2 and line1/line2 formats
  const line1Key = address.line_1 !== undefined ? "line_1" : "line1";
  const line2Key = address.line_2 !== undefined ? "line_2" : "line2";

  return (
    <>
      <FormField label="Line 1">
        <input className={inputClass} value={(address[line1Key] as string) ?? ""} onChange={(e) => set(line1Key, e.target.value)} />
      </FormField>
      <FormField label="Line 2">
        <input className={inputClass} value={(address[line2Key] as string) ?? ""} onChange={(e) => set(line2Key, e.target.value)} />
      </FormField>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6">
        <FormField label="City">
          <input className={inputClass} value={(address.city as string) ?? ""} onChange={(e) => set("city", e.target.value)} />
        </FormField>
        <FormField label="Postcode">
          <input className={inputClass} value={(address.postcode as string) ?? ""} onChange={(e) => set("postcode", e.target.value)} />
        </FormField>
        {address.county !== undefined && (
          <FormField label="County">
            <input className={inputClass} value={(address.county as string) ?? ""} onChange={(e) => set("county", e.target.value)} />
          </FormField>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <FormField label="Housing Status">
          <input className={inputClass} value={(address.housingStatus as string) ?? ""} onChange={(e) => set("housingStatus", e.target.value)} />
        </FormField>
        <FormField label="Residing Since">
          <input type="date" className={inputClass} value={(address.residingSince as string) ?? ""} onChange={(e) => set("residingSince", e.target.value)} />
        </FormField>
      </div>
    </>
  );
}

export default function PersonaForm({ data, onChange }: Props) {
  function update(patch: Record<string, unknown>) {
    onChange({ ...data, ...patch });
  }

  const primaryContact = (data.primaryContact ?? {}) as Record<string, unknown>;
  const address = (data.address ?? {}) as Record<string, unknown>;
  const commStyle = (data.communicationStyle ?? {}) as Record<string, unknown>;
  const concerns = (commStyle.primaryConcerns ?? []) as string[];
  const phrases = (commStyle.typicalPhrases ?? []) as string[];

  // Collect remaining keys for JSON fallback (keys not handled by any section)
  const extraKeys = Object.keys(data).filter((k) => !ALL_STRUCTURED_KEYS.has(k));

  function formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();
  }

  return (
    <div className="space-y-4">
      {/* ── 1. Overview ── */}
      <Section title="Overview" defaultOpen>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <FormField label="Persona Name">
            <input
              className={inputClass}
              value={(data.personaName as string) ?? ""}
              onChange={(e) => update({ personaName: e.target.value })}
            />
          </FormField>
          <FormField label="ID" hint="File name and lookup key">
            <input
              className={`${inputClass} bg-gray-50 text-gray-500`}
              value={(data.id as string) ?? ""}
              readOnly
            />
          </FormField>
        </div>
        <FormField label="Description">
          <input
            className={inputClass}
            value={(data.description as string) ?? ""}
            onChange={(e) => update({ description: e.target.value })}
          />
        </FormField>
      </Section>

      {/* ── 2. Identity ── */}
      <Section title="Identity" defaultOpen>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <FormField label="Full Name">
            <input
              className={inputClass}
              value={(data.name as string) ?? ""}
              onChange={(e) => update({ name: e.target.value })}
            />
          </FormField>
          <FormField label="Date of Birth">
            <input
              type="date"
              className={inputClass}
              value={(data.date_of_birth as string) ?? ""}
              onChange={(e) => update({ date_of_birth: e.target.value })}
            />
          </FormField>
          <FormField label="Age">
            <input
              type="number"
              className={inputClass}
              value={(data.age as number) ?? ""}
              onChange={(e) => update({ age: parseInt(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="NI Number">
            <input
              className={inputClass}
              value={(data.national_insurance_number as string) ?? ""}
              onChange={(e) => update({ national_insurance_number: e.target.value })}
            />
          </FormField>
          <FormField label="Employment Status">
            <select
              className={inputClass}
              value={(data.employment_status as string) ?? ""}
              onChange={(e) => update({ employment_status: e.target.value })}
            >
              <option value="employed">Employed</option>
              <option value="self-employed">Self-employed</option>
              <option value="unemployed">Unemployed</option>
              <option value="retired">Retired</option>
            </select>
          </FormField>
          <FormField label="Jurisdiction">
            <select
              className={inputClass}
              value={(data.jurisdiction as string) ?? "England"}
              onChange={(e) => update({ jurisdiction: e.target.value })}
            >
              <option value="England">England</option>
              <option value="Wales">Wales</option>
              <option value="Scotland">Scotland</option>
              <option value="Northern Ireland">Northern Ireland</option>
            </select>
          </FormField>
          <FormField label="Annual Income">
            <input
              type="number"
              className={inputClass}
              value={(data.income as number) ?? ""}
              onChange={(e) => update({ income: parseInt(e.target.value) || 0 })}
            />
          </FormField>
          <FormField label="Savings">
            <input
              type="number"
              className={inputClass}
              value={(data.savings as number) ?? ""}
              onChange={(e) => update({ savings: parseInt(e.target.value) || 0 })}
            />
          </FormField>
          {/* Standalone conditional fields */}
          {data.employer !== undefined && (
            <FormField label="Employer">
              <input
                className={inputClass}
                value={(data.employer as string) ?? ""}
                onChange={(e) => update({ employer: e.target.value })}
              />
            </FormField>
          )}
          {data.self_employed !== undefined && (
            <FormField label="Self Employed">
              <select
                className={inputClass}
                value={data.self_employed ? "yes" : "no"}
                onChange={(e) => update({ self_employed: e.target.value === "yes" })}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </FormField>
          )}
          {data.over_70 !== undefined && (
            <FormField label="Over 70">
              <select
                className={inputClass}
                value={data.over_70 ? "yes" : "no"}
                onChange={(e) => update({ over_70: e.target.value === "yes" })}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </FormField>
          )}
          {data.no_fixed_address !== undefined && (
            <FormField label="No Fixed Address">
              <select
                className={inputClass}
                value={data.no_fixed_address ? "yes" : "no"}
                onChange={(e) => update({ no_fixed_address: e.target.value === "yes" })}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </FormField>
          )}
          {data.pension_qualifying_years !== undefined && (
            <FormField label="Pension Qualifying Years">
              <input
                type="number"
                className={inputClass}
                value={(data.pension_qualifying_years as number) ?? ""}
                onChange={(e) => update({ pension_qualifying_years: parseInt(e.target.value) || 0 })}
              />
            </FormField>
          )}
        </div>
      </Section>

      {/* ── 3. Primary Contact ── */}
      <Section title="Primary Contact">
        <ContactFields
          contact={primaryContact}
          onChange={(c) => update({ primaryContact: c })}
        />
      </Section>

      {/* ── 4. Address ── */}
      <Section title="Address">
        <AddressFields
          address={address}
          onChange={(a) => update({ address: a })}
        />
      </Section>

      {/* ── 5. Communication Style ── */}
      <Section title="Communication Style" defaultOpen>
        <FormField label="Tone">
          <input
            className={inputClass}
            value={(commStyle.tone as string) ?? ""}
            onChange={(e) =>
              update({ communicationStyle: { ...commStyle, tone: e.target.value } })
            }
          />
        </FormField>
        <FormField label="Tech Savvy">
          <input
            className={inputClass}
            value={(commStyle.techSavvy as string) ?? ""}
            onChange={(e) =>
              update({ communicationStyle: { ...commStyle, techSavvy: e.target.value } })
            }
          />
        </FormField>
        {commStyle.needsReassurance !== undefined && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <FormField label="Needs Reassurance">
              <select
                className={inputClass}
                value={commStyle.needsReassurance ? "yes" : "no"}
                onChange={(e) =>
                  update({
                    communicationStyle: {
                      ...commStyle,
                      needsReassurance: e.target.value === "yes",
                    },
                  })
                }
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </FormField>
            {commStyle.prefersStepByStep !== undefined && (
              <FormField label="Prefers Step-by-Step">
                <select
                  className={inputClass}
                  value={commStyle.prefersStepByStep ? "yes" : "no"}
                  onChange={(e) =>
                    update({
                      communicationStyle: {
                        ...commStyle,
                        prefersStepByStep: e.target.value === "yes",
                      },
                    })
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </FormField>
            )}
          </div>
        )}
        <FormField label="Primary Concerns">
          <DynamicList
            items={concerns}
            addLabel="Add concern"
            onAdd={() =>
              update({
                communicationStyle: {
                  ...commStyle,
                  primaryConcerns: [...concerns, ""],
                },
              })
            }
            onRemove={(i) =>
              update({
                communicationStyle: {
                  ...commStyle,
                  primaryConcerns: concerns.filter((_, idx) => idx !== i),
                },
              })
            }
            onChange={(i, val) =>
              update({
                communicationStyle: {
                  ...commStyle,
                  primaryConcerns: concerns.map((c, idx) => (idx === i ? val : c)),
                },
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
        </FormField>
        <FormField label="Typical Phrases">
          <DynamicList
            items={phrases}
            addLabel="Add phrase"
            onAdd={() =>
              update({
                communicationStyle: {
                  ...commStyle,
                  typicalPhrases: [...phrases, ""],
                },
              })
            }
            onRemove={(i) =>
              update({
                communicationStyle: {
                  ...commStyle,
                  typicalPhrases: phrases.filter((_, idx) => idx !== i),
                },
              })
            }
            onChange={(i, val) =>
              update({
                communicationStyle: {
                  ...commStyle,
                  typicalPhrases: phrases.map((p, idx) => (idx === i ? val : p)),
                },
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
        </FormField>
      </Section>

      {/* ── 6. Credentials ── */}
      <SchemaArraySection
        schema={credentialsSchema}
        data={data.credentials as unknown[] | undefined}
        onChange={(val) => update({ credentials: val })}
      />

      {/* ── 7. Partner (conditional) ── */}
      {data.partner !== undefined && (
        <SchemaObjectSection
          schema={partnerSchema}
          data={data.partner as Record<string, unknown>}
          onChange={(val) => update({ partner: val })}
        />
      )}

      {/* ── 7b. Spouse (conditional) ── */}
      {data.spouse !== undefined && (
        <SchemaObjectSection
          schema={spouseSchema}
          data={data.spouse as Record<string, unknown>}
          onChange={(val) => update({ spouse: val })}
        />
      )}

      {/* ── 8. Family ── */}
      {(data.family !== undefined || data.family === undefined) && (
        <FamilySection
          data={data.family as Record<string, unknown> | undefined}
          onChange={(val) => update({ family: val })}
        />
      )}

      {/* ── 8b. Children at root level (conditional) ── */}
      {data.children !== undefined && !data.family && (
        <SchemaArraySection
          schema={childrenSchema}
          data={data.children as unknown[]}
          onChange={(val) => update({ children: val })}
        />
      )}

      {/* ── 9. Employment ── */}
      <SchemaObjectSection
        schema={employmentSchema}
        data={data.employment as Record<string, unknown> | undefined}
        onChange={(val) => update({ employment: val })}
      />

      {/* ── 10. Spouse Employment (conditional) ── */}
      {data.spouseEmployment !== undefined && (
        <SchemaObjectSection
          schema={spouseEmploymentSchema}
          data={data.spouseEmployment as Record<string, unknown>}
          onChange={(val) => update({ spouseEmployment: val })}
        />
      )}

      {/* ── 11. Financials ── */}
      <SchemaObjectSection
        schema={financialsSchema}
        data={data.financials as Record<string, unknown> | undefined}
        onChange={(val) => update({ financials: val })}
      />

      {/* ── 12. Benefits ── */}
      <BenefitsSection
        data={data.benefits as Record<string, unknown> | undefined}
        onChange={(val) => update({ benefits: val })}
      />

      {/* ── 13. Housing (conditional — only some personas have it) ── */}
      {data.housing !== undefined && (
        <SchemaObjectSection
          schema={housingSchema}
          data={data.housing as Record<string, unknown>}
          onChange={(val) => update({ housing: val })}
        />
      )}

      {/* ── 14. Vehicles ── */}
      <SchemaArraySection
        schema={vehiclesSchema}
        data={data.vehicles as unknown[] | undefined}
        onChange={(val) => update({ vehicles: val })}
      />

      {/* ── 15. Health Info ── */}
      <HealthInfoSection
        data={data.healthInfo as Record<string, unknown> | undefined}
        onChange={(val) => update({ healthInfo: val })}
      />

      {/* ── 16. Pregnancy (conditional) ── */}
      {data.pregnancy !== undefined && (
        <SchemaObjectSection
          schema={pregnancySchema}
          data={data.pregnancy as Record<string, unknown>}
          onChange={(val) => update({ pregnancy: val })}
        />
      )}

      {/* ── 17. Deceased (conditional) ── */}
      {data.deceased !== undefined && (
        <SchemaObjectSection
          schema={deceasedSchema}
          data={data.deceased as Record<string, unknown>}
          onChange={(val) => update({ deceased: val })}
        />
      )}

      {/* ── 18. Business Assets (conditional) ── */}
      {data.businessAssets !== undefined && (
        <SchemaObjectSection
          schema={businessAssetsSchema}
          data={data.businessAssets as Record<string, unknown>}
          onChange={(val) => update({ businessAssets: val })}
        />
      )}

      {/* ── 19. Remaining unknown keys as JSON fallback ── */}
      {extraKeys.map((key) => (
        <JsonSection
          key={key}
          label={formatLabel(key)}
          value={data[key]}
          onChange={(val) => update({ [key]: val })}
        />
      ))}
    </div>
  );
}
