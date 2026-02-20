"use client";

import { useState } from "react";
import FormField from "./FormField";
import DynamicList from "./DynamicList";
import KeyValueEditor, { type SchemaField } from "./KeyValueEditor";

// ── Types ──

interface PolicyRule {
  description: string;
  field: string;
  operator: string;
  value: string;
  reason_if_failed: string;
}

interface StateItem {
  id: string;
  type: string;
  receipt: boolean;
}

interface TransitionItem {
  from: string;
  to: string;
  trigger: string;
  condition: string;
}

interface ConsentGrant {
  description: string;
  data_shared: string;
  source: string;
  purpose: string;
  duration: string;
  required: boolean;
}

interface EdgeCase {
  description: string;
  action: string;
}

export interface ServiceFormData {
  // Core
  name: string;
  department: string;
  description: string;
  version: string;
  jurisdiction: string;

  // Schema
  inputFields: SchemaField[];
  requiredInputs: string[];
  outputFields: SchemaField[];

  // Constraints
  sla: string;
  feeAmount: string;
  feeCurrency: string;
  availability: string;

  // Redress
  complaintUrl: string;
  appealProcess: string;
  ombudsman: string;

  // Audit
  retentionPeriod: string;
  dataController: string;
  lawfulBasis: string;

  // Handoff
  escalationPhone: string;
  openingHours: string;
  departmentQueue: string;

  // Policy
  enablePolicy: boolean;
  policyRules: PolicyRule[];
  explanationTemplate: string;
  edgeCases: EdgeCase[];

  // State Model
  enableStateModel: boolean;
  states: StateItem[];
  transitions: TransitionItem[];

  // Consent
  enableConsent: boolean;
  consentGrants: ConsentGrant[];
  revocationMechanism: string;
  revocationEffect: string;
  delegationAgentIdentity: string;
  delegationScopes: string;
  delegationLimitations: string;
}

// ── Helpers ──

function emptyFormData(): ServiceFormData {
  return {
    name: "", department: "", description: "", version: "1.0.0", jurisdiction: "",
    inputFields: [], requiredInputs: [], outputFields: [],
    sla: "", feeAmount: "", feeCurrency: "GBP", availability: "",
    complaintUrl: "", appealProcess: "", ombudsman: "",
    retentionPeriod: "", dataController: "", lawfulBasis: "",
    escalationPhone: "", openingHours: "", departmentQueue: "",
    enablePolicy: false, policyRules: [], explanationTemplate: "", edgeCases: [],
    enableStateModel: false, states: [], transitions: [],
    enableConsent: false, consentGrants: [],
    revocationMechanism: "", revocationEffect: "",
    delegationAgentIdentity: "", delegationScopes: "", delegationLimitations: "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiDataToFormData(data: any): ServiceFormData {
  const m = data.manifest || {};
  const p = data.policy;
  const sm = data.stateModel;
  const c = data.consent;

  // Convert input_schema properties to SchemaField[]
  const inputFields: SchemaField[] = [];
  const requiredInputs: string[] = [];
  if (m.input_schema?.properties) {
    for (const [name, prop] of Object.entries(m.input_schema.properties)) {
      inputFields.push({ name, type: (prop as Record<string, string>).type || "string" });
    }
    if (Array.isArray(m.input_schema.required)) {
      requiredInputs.push(...m.input_schema.required);
    }
  }

  const outputFields: SchemaField[] = [];
  if (m.output_schema?.properties) {
    for (const [name, prop] of Object.entries(m.output_schema.properties)) {
      outputFields.push({ name, type: (prop as Record<string, string>).type || "string" });
    }
  }

  return {
    name: m.name || "",
    department: m.department || "",
    description: m.description || "",
    version: m.version || "1.0.0",
    jurisdiction: m.jurisdiction || "",
    inputFields,
    requiredInputs,
    outputFields,
    sla: m.constraints?.sla || "",
    feeAmount: m.constraints?.fee?.amount?.toString() || "",
    feeCurrency: m.constraints?.fee?.currency || "GBP",
    availability: m.constraints?.availability || "",
    complaintUrl: m.redress?.complaint_url || "",
    appealProcess: m.redress?.appeal_process || "",
    ombudsman: m.redress?.ombudsman || "",
    retentionPeriod: m.audit_requirements?.retention_period || "",
    dataController: m.audit_requirements?.data_controller || "",
    lawfulBasis: m.audit_requirements?.lawful_basis || "",
    escalationPhone: m.handoff?.escalation_phone || "",
    openingHours: m.handoff?.opening_hours || "",
    departmentQueue: m.handoff?.department_queue || "",
    enablePolicy: !!p,
    policyRules: p?.rules?.map((r: Record<string, unknown>) => ({
      description: r.description || "",
      field: (r.condition as Record<string, string>)?.field || "",
      operator: (r.condition as Record<string, string>)?.operator || "",
      value: JSON.stringify((r.condition as Record<string, unknown>)?.value ?? ""),
      reason_if_failed: r.reason_if_failed || "",
    })) || [],
    explanationTemplate: p?.explanation_template || "",
    edgeCases: p?.edge_cases?.map((ec: Record<string, string>) => ({
      description: ec.description || "",
      action: ec.action || "",
    })) || [],
    enableStateModel: !!sm,
    states: sm?.states?.map((s: Record<string, unknown>) => ({
      id: s.id || "",
      type: s.type || "",
      receipt: !!s.receipt,
    })) || [],
    transitions: sm?.transitions?.map((t: Record<string, string>) => ({
      from: t.from || "",
      to: t.to || "",
      trigger: t.trigger || "",
      condition: t.condition || "",
    })) || [],
    enableConsent: !!c,
    consentGrants: c?.grants?.map((g: Record<string, unknown>) => ({
      description: (g.description as string) || "",
      data_shared: Array.isArray(g.data_shared) ? (g.data_shared as string[]).join(", ") : "",
      source: (g.source as string) || "",
      purpose: (g.purpose as string) || "",
      duration: (g.duration as string) || "",
      required: !!g.required,
    })) || [],
    revocationMechanism: c?.revocation?.mechanism || "",
    revocationEffect: c?.revocation?.effect || "",
    delegationAgentIdentity: c?.delegation?.agent_identity || "",
    delegationScopes: Array.isArray(c?.delegation?.scopes) ? c.delegation.scopes.join(", ") : "",
    delegationLimitations: c?.delegation?.limitations || "",
  };
}

export function formDataToApiPayload(data: ServiceFormData) {
  // Build input_schema
  const inputProperties: Record<string, { type: string }> = {};
  for (const f of data.inputFields) {
    if (f.name) inputProperties[f.name] = { type: f.type };
  }
  const outputProperties: Record<string, { type: string }> = {};
  for (const f of data.outputFields) {
    if (f.name) outputProperties[f.name] = { type: f.type };
  }

  const manifest: Record<string, unknown> = {
    name: data.name,
    department: data.department,
    description: data.description,
    version: data.version,
  };

  if (data.jurisdiction) manifest.jurisdiction = data.jurisdiction;

  if (Object.keys(inputProperties).length > 0) {
    manifest.input_schema = {
      type: "object",
      properties: inputProperties,
      ...(data.requiredInputs.length > 0 ? { required: data.requiredInputs } : {}),
    };
  }

  if (Object.keys(outputProperties).length > 0) {
    manifest.output_schema = {
      type: "object",
      properties: outputProperties,
    };
  }

  if (data.sla || data.feeAmount || data.availability) {
    const constraints: Record<string, unknown> = {};
    if (data.sla) constraints.sla = data.sla;
    if (data.feeAmount) constraints.fee = { amount: parseFloat(data.feeAmount), currency: data.feeCurrency };
    if (data.availability) constraints.availability = data.availability;
    manifest.constraints = constraints;
  }

  if (data.complaintUrl || data.appealProcess || data.ombudsman) {
    const redress: Record<string, string> = {};
    if (data.complaintUrl) redress.complaint_url = data.complaintUrl;
    if (data.appealProcess) redress.appeal_process = data.appealProcess;
    if (data.ombudsman) redress.ombudsman = data.ombudsman;
    manifest.redress = redress;
  }

  if (data.retentionPeriod || data.dataController || data.lawfulBasis) {
    const audit: Record<string, string> = {};
    if (data.retentionPeriod) audit.retention_period = data.retentionPeriod;
    if (data.dataController) audit.data_controller = data.dataController;
    if (data.lawfulBasis) audit.lawful_basis = data.lawfulBasis;
    manifest.audit_requirements = audit;
  }

  if (data.escalationPhone || data.openingHours || data.departmentQueue) {
    const handoff: Record<string, string> = {};
    if (data.escalationPhone) handoff.escalation_phone = data.escalationPhone;
    if (data.openingHours) handoff.opening_hours = data.openingHours;
    if (data.departmentQueue) handoff.department_queue = data.departmentQueue;
    manifest.handoff = handoff;
  }

  const payload: Record<string, unknown> = { manifest };

  // Policy
  if (data.enablePolicy && data.policyRules.length > 0) {
    payload.policy = {
      id: "",
      version: data.version,
      rules: data.policyRules.map((r, i) => {
        let parsedValue: unknown = r.value;
        try { parsedValue = JSON.parse(r.value); } catch { /* keep as string */ }
        return {
          id: `rule-${i + 1}`,
          description: r.description,
          condition: { field: r.field, operator: r.operator, value: parsedValue },
          reason_if_failed: r.reason_if_failed,
        };
      }),
      explanation_template: data.explanationTemplate || undefined,
      edge_cases: data.edgeCases.length > 0
        ? data.edgeCases.map((ec, i) => ({
            id: `edge-${i + 1}`,
            description: ec.description,
            action: ec.action,
          }))
        : undefined,
    };
  }

  // State Model
  if (data.enableStateModel && data.states.length > 0) {
    payload.stateModel = {
      id: "",
      version: data.version,
      states: data.states.map((s) => ({
        id: s.id,
        ...(s.type ? { type: s.type } : {}),
        ...(s.receipt ? { receipt: true } : {}),
      })),
      transitions: data.transitions.map((t) => ({
        from: t.from,
        to: t.to,
        trigger: t.trigger,
        ...(t.condition ? { condition: t.condition } : {}),
      })),
    };
  }

  // Consent
  if (data.enableConsent && data.consentGrants.length > 0) {
    payload.consent = {
      id: "",
      version: data.version,
      grants: data.consentGrants.map((g, i) => ({
        id: `grant-${i + 1}`,
        description: g.description,
        data_shared: g.data_shared.split(",").map((s) => s.trim()).filter(Boolean),
        source: g.source,
        purpose: g.purpose,
        duration: g.duration || "session",
        required: g.required,
      })),
      ...(data.revocationMechanism ? {
        revocation: {
          mechanism: data.revocationMechanism,
          effect: data.revocationEffect,
        },
      } : {}),
      ...(data.delegationAgentIdentity ? {
        delegation: {
          agent_identity: data.delegationAgentIdentity,
          scopes: data.delegationScopes.split(",").map((s) => s.trim()).filter(Boolean),
          limitations: data.delegationLimitations,
        },
      } : {}),
    };
  }

  return payload;
}

// ── Collapsible Section ──

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-studio-border rounded-xl bg-white mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 rounded-t-xl font-bold text-sm"
      >
        {title}
        <span className="text-xs text-gray-500">{open ? "Collapse" : "Expand"}</span>
      </button>
      {open && <div className="border-t border-studio-border p-4">{children}</div>}
    </div>
  );
}

// ── Toggle Section (for optional artefacts) ──

function ToggleSection({ title, enabled, onToggle, children }: { title: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="border border-studio-border rounded-xl bg-white mb-4">
      <div className="p-4 flex justify-between items-center">
        <span className="font-bold text-sm">{title}</span>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="w-4 h-4"
          />
          {enabled ? "Enabled" : "Disabled"}
        </label>
      </div>
      {enabled && <div className="border-t border-studio-border p-4">{children}</div>}
    </div>
  );
}

// ── Main Form ──

interface ServiceFormProps {
  initialData?: ServiceFormData;
  onSubmit: (data: ServiceFormData) => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export default function ServiceForm({
  initialData,
  onSubmit,
  submitLabel = "Save service",
  isSubmitting = false,
}: ServiceFormProps) {
  const [form, setForm] = useState<ServiceFormData>(initialData || emptyFormData());
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update<K extends keyof ServiceFormData>(key: K, value: ServiceFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Service name is required";
    if (!form.department.trim()) newErrors.department = "Department is required";
    if (!form.description.trim()) newErrors.description = "Description is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(form);
  }

  const inputClass = "w-full border border-studio-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-studio-accent";

  return (
    <form onSubmit={handleSubmit}>
      {/* Core Details — always visible */}
      <Section title="Core Details" defaultOpen={true}>
        <FormField label="Service name" required error={errors.name}>
          <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} placeholder="e.g. Renew Driving Licence" />
        </FormField>
        <FormField label="Department" required error={errors.department}>
          <input type="text" value={form.department} onChange={(e) => update("department", e.target.value)} className={inputClass} placeholder="e.g. DVLA" />
        </FormField>
        <FormField label="Description" required error={errors.description}>
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} className={inputClass} rows={3} placeholder="What does this service do?" />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Version">
            <input type="text" value={form.version} onChange={(e) => update("version", e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Jurisdiction">
            <input type="text" value={form.jurisdiction} onChange={(e) => update("jurisdiction", e.target.value)} className={inputClass} placeholder="e.g. England, Wales, Scotland" />
          </FormField>
        </div>
      </Section>

      {/* Input/Output Schema */}
      <Section title="Input / Output Schema">
        <KeyValueEditor label="Input fields" fields={form.inputFields} onChange={(fields) => update("inputFields", fields)} />
        {form.inputFields.length > 0 && (
          <div className="mt-3">
            <label className="block text-sm font-bold mb-1">Required inputs</label>
            <div className="flex flex-wrap gap-2">
              {form.inputFields.filter((f) => f.name).map((f) => (
                <label key={f.name} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={form.requiredInputs.includes(f.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        update("requiredInputs", [...form.requiredInputs, f.name]);
                      } else {
                        update("requiredInputs", form.requiredInputs.filter((n) => n !== f.name));
                      }
                    }}
                  />
                  {f.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4">
          <KeyValueEditor label="Output fields" fields={form.outputFields} onChange={(fields) => update("outputFields", fields)} />
        </div>
      </Section>

      {/* Constraints */}
      <Section title="Constraints">
        <FormField label="SLA" hint="e.g. 10 working days">
          <input type="text" value={form.sla} onChange={(e) => update("sla", e.target.value)} className={inputClass} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Fee amount">
            <input type="text" value={form.feeAmount} onChange={(e) => update("feeAmount", e.target.value)} className={inputClass} placeholder="e.g. 14" />
          </FormField>
          <FormField label="Currency">
            <input type="text" value={form.feeCurrency} onChange={(e) => update("feeCurrency", e.target.value)} className={inputClass} />
          </FormField>
        </div>
        <FormField label="Availability" hint="e.g. 24/7 online">
          <input type="text" value={form.availability} onChange={(e) => update("availability", e.target.value)} className={inputClass} />
        </FormField>
      </Section>

      {/* Redress */}
      <Section title="Redress">
        <FormField label="Complaint URL">
          <input type="text" value={form.complaintUrl} onChange={(e) => update("complaintUrl", e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Appeal process">
          <input type="text" value={form.appealProcess} onChange={(e) => update("appealProcess", e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Ombudsman">
          <input type="text" value={form.ombudsman} onChange={(e) => update("ombudsman", e.target.value)} className={inputClass} />
        </FormField>
      </Section>

      {/* Audit */}
      <Section title="Audit Requirements">
        <FormField label="Retention period">
          <input type="text" value={form.retentionPeriod} onChange={(e) => update("retentionPeriod", e.target.value)} className={inputClass} placeholder="e.g. 7 years" />
        </FormField>
        <FormField label="Data controller">
          <input type="text" value={form.dataController} onChange={(e) => update("dataController", e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Lawful basis">
          <input type="text" value={form.lawfulBasis} onChange={(e) => update("lawfulBasis", e.target.value)} className={inputClass} placeholder="e.g. Public task" />
        </FormField>
      </Section>

      {/* Handoff */}
      <Section title="Handoff Configuration">
        <FormField label="Escalation phone">
          <input type="text" value={form.escalationPhone} onChange={(e) => update("escalationPhone", e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Opening hours">
          <input type="text" value={form.openingHours} onChange={(e) => update("openingHours", e.target.value)} className={inputClass} placeholder="e.g. Mon-Fri 8am-7pm" />
        </FormField>
        <FormField label="Department queue">
          <input type="text" value={form.departmentQueue} onChange={(e) => update("departmentQueue", e.target.value)} className={inputClass} />
        </FormField>
      </Section>

      {/* Policy Ruleset */}
      <ToggleSection title="Policy Ruleset" enabled={form.enablePolicy} onToggle={(v) => update("enablePolicy", v)}>
        <FormField label="Explanation template" hint="Use {outcome} as placeholder">
          <input type="text" value={form.explanationTemplate} onChange={(e) => update("explanationTemplate", e.target.value)} className={inputClass} />
        </FormField>

        <label className="block text-sm font-bold mb-2 mt-4">Eligibility Rules</label>
        <DynamicList
          items={form.policyRules}
          onAdd={() => update("policyRules", [...form.policyRules, { description: "", field: "", operator: ">=", value: "", reason_if_failed: "" }])}
          onRemove={(i) => update("policyRules", form.policyRules.filter((_, idx) => idx !== i))}
          onChange={(i, item) => update("policyRules", form.policyRules.map((r, idx) => idx === i ? item : r))}
          addLabel="Add rule"
          renderItem={(rule, _i, onChange) => (
            <div className="space-y-2 pr-12">
              <input type="text" value={rule.description} onChange={(e) => onChange({ ...rule, description: e.target.value })} placeholder="Description" className={inputClass} />
              <div className="grid grid-cols-3 gap-2">
                <input type="text" value={rule.field} onChange={(e) => onChange({ ...rule, field: e.target.value })} placeholder="Field" className={inputClass} />
                <select value={rule.operator} onChange={(e) => onChange({ ...rule, operator: e.target.value })} className={inputClass}>
                  <option value=">=">{"≥ (>=)"}</option>
                  <option value="<=">{"≤ (<=)"}</option>
                  <option value="==">{"= (==)"}</option>
                  <option value="!=">{"≠ (!=)"}</option>
                  <option value=">">{">"}</option>
                  <option value="<">{"<"}</option>
                  <option value="exists">exists</option>
                  <option value="in">in</option>
                </select>
                <input type="text" value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })} placeholder='Value (e.g. 16 or ["a","b"])' className={inputClass} />
              </div>
              <input type="text" value={rule.reason_if_failed} onChange={(e) => onChange({ ...rule, reason_if_failed: e.target.value })} placeholder="Reason if failed" className={inputClass} />
            </div>
          )}
        />

        <label className="block text-sm font-bold mb-2 mt-4">Edge Cases</label>
        <DynamicList
          items={form.edgeCases}
          onAdd={() => update("edgeCases", [...form.edgeCases, { description: "", action: "" }])}
          onRemove={(i) => update("edgeCases", form.edgeCases.filter((_, idx) => idx !== i))}
          onChange={(i, item) => update("edgeCases", form.edgeCases.map((ec, idx) => idx === i ? item : ec))}
          addLabel="Add edge case"
          renderItem={(ec, _i, onChange) => (
            <div className="space-y-2 pr-12">
              <input type="text" value={ec.description} onChange={(e) => onChange({ ...ec, description: e.target.value })} placeholder="Description" className={inputClass} />
              <input type="text" value={ec.action} onChange={(e) => onChange({ ...ec, action: e.target.value })} placeholder="Action to take" className={inputClass} />
            </div>
          )}
        />
      </ToggleSection>

      {/* State Model */}
      <ToggleSection title="State Model" enabled={form.enableStateModel} onToggle={(v) => update("enableStateModel", v)}>
        <label className="block text-sm font-bold mb-2">States</label>
        <DynamicList
          items={form.states}
          onAdd={() => update("states", [...form.states, { id: "", type: "", receipt: false }])}
          onRemove={(i) => update("states", form.states.filter((_, idx) => idx !== i))}
          onChange={(i, item) => update("states", form.states.map((s, idx) => idx === i ? item : s))}
          addLabel="Add state"
          renderItem={(state, _i, onChange) => (
            <div className="flex gap-2 items-center pr-12">
              <input type="text" value={state.id} onChange={(e) => onChange({ ...state, id: e.target.value })} placeholder="State ID" className={`${inputClass} flex-1`} />
              <select value={state.type} onChange={(e) => onChange({ ...state, type: e.target.value })} className={inputClass} style={{ width: "auto" }}>
                <option value="">Normal</option>
                <option value="initial">Initial</option>
                <option value="terminal">Terminal</option>
              </select>
              <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                <input type="checkbox" checked={state.receipt} onChange={(e) => onChange({ ...state, receipt: e.target.checked })} />
                Receipt
              </label>
            </div>
          )}
        />

        <label className="block text-sm font-bold mb-2 mt-4">Transitions</label>
        <DynamicList
          items={form.transitions}
          onAdd={() => update("transitions", [...form.transitions, { from: "", to: "", trigger: "", condition: "" }])}
          onRemove={(i) => update("transitions", form.transitions.filter((_, idx) => idx !== i))}
          onChange={(i, item) => update("transitions", form.transitions.map((t, idx) => idx === i ? item : t))}
          addLabel="Add transition"
          renderItem={(transition, _i, onChange) => (
            <div className="grid grid-cols-2 gap-2 pr-12">
              <select value={transition.from} onChange={(e) => onChange({ ...transition, from: e.target.value })} className={inputClass}>
                <option value="">From...</option>
                {form.states.filter((s) => s.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.id}</option>
                ))}
              </select>
              <select value={transition.to} onChange={(e) => onChange({ ...transition, to: e.target.value })} className={inputClass}>
                <option value="">To...</option>
                {form.states.filter((s) => s.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.id}</option>
                ))}
              </select>
              <input type="text" value={transition.trigger} onChange={(e) => onChange({ ...transition, trigger: e.target.value })} placeholder="Trigger" className={inputClass} />
              <input type="text" value={transition.condition} onChange={(e) => onChange({ ...transition, condition: e.target.value })} placeholder="Condition (optional)" className={inputClass} />
            </div>
          )}
        />
      </ToggleSection>

      {/* Consent Model */}
      <ToggleSection title="Consent Model" enabled={form.enableConsent} onToggle={(v) => update("enableConsent", v)}>
        <label className="block text-sm font-bold mb-2">Consent Grants</label>
        <DynamicList
          items={form.consentGrants}
          onAdd={() => update("consentGrants", [...form.consentGrants, { description: "", data_shared: "", source: "", purpose: "", duration: "session", required: true }])}
          onRemove={(i) => update("consentGrants", form.consentGrants.filter((_, idx) => idx !== i))}
          onChange={(i, item) => update("consentGrants", form.consentGrants.map((g, idx) => idx === i ? item : g))}
          addLabel="Add consent grant"
          renderItem={(grant, _i, onChange) => (
            <div className="space-y-2 pr-12">
              <input type="text" value={grant.description} onChange={(e) => onChange({ ...grant, description: e.target.value })} placeholder="Description" className={inputClass} />
              <input type="text" value={grant.data_shared} onChange={(e) => onChange({ ...grant, data_shared: e.target.value })} placeholder="Data shared (comma-separated)" className={inputClass} />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={grant.source} onChange={(e) => onChange({ ...grant, source: e.target.value })} placeholder="Source" className={inputClass} />
                <input type="text" value={grant.purpose} onChange={(e) => onChange({ ...grant, purpose: e.target.value })} placeholder="Purpose" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={grant.duration} onChange={(e) => onChange({ ...grant, duration: e.target.value })} placeholder="Duration" className={inputClass} />
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={grant.required} onChange={(e) => onChange({ ...grant, required: e.target.checked })} />
                  Required
                </label>
              </div>
            </div>
          )}
        />

        <div className="mt-4 space-y-4">
          <FormField label="Revocation mechanism">
            <input type="text" value={form.revocationMechanism} onChange={(e) => update("revocationMechanism", e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Revocation effect">
            <input type="text" value={form.revocationEffect} onChange={(e) => update("revocationEffect", e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Delegation: Agent identity">
            <input type="text" value={form.delegationAgentIdentity} onChange={(e) => update("delegationAgentIdentity", e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Delegation: Scopes" hint="Comma-separated">
            <input type="text" value={form.delegationScopes} onChange={(e) => update("delegationScopes", e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Delegation: Limitations">
            <textarea value={form.delegationLimitations} onChange={(e) => update("delegationLimitations", e.target.value)} className={inputClass} rows={2} />
          </FormField>
        </div>
      </ToggleSection>

      {/* Submit */}
      <div className="flex gap-3 mt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-govuk-green text-white px-6 py-2 rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
        <a href="/services" className="px-6 py-2 rounded-lg border border-studio-border text-sm hover:bg-gray-50">
          Cancel
        </a>
      </div>
    </form>
  );
}
