"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Breadcrumbs from "@/components/layout/Breadcrumbs";

interface GapItem {
  field: string;
  status: "present" | "missing" | "incomplete";
  artefact: string;
}

interface PolicyRule {
  id: string;
  description: string;
  condition: { field: string; operator: string; value: unknown };
  reason_if_failed: string;
  alternative_service?: string;
}

interface StateDefinition {
  id: string;
  type?: string;
  receipt?: boolean;
}

interface Transition {
  from: string;
  to: string;
  trigger: string;
  condition?: string;
}

interface ConsentGrant {
  id: string;
  data_category: string;
  purpose: string;
  duration?: string;
  revocable?: boolean;
}

// ── Policy Rules View ──
function PolicyView({ policy }: { policy: Record<string, unknown> }) {
  const rules = (policy.rules || []) as PolicyRule[];
  const edgeCases = (policy.edge_cases || []) as Array<{ id: string; description: string; action: string }>;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-bold text-sm mb-2">Eligibility Rules ({rules.length})</h4>
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="border border-studio-border rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-sm font-medium">{rule.description}</span>
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    {rule.condition.field} {rule.condition.operator} {JSON.stringify(rule.condition.value)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-red-600 mt-2 italic">
                If failed: {rule.reason_if_failed}
              </div>
              {rule.alternative_service && (
                <div className="text-xs text-studio-accent mt-1">
                  Alternative: {rule.alternative_service}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {edgeCases.length > 0 && (
        <div>
          <h4 className="font-bold text-sm mb-2">Edge Cases ({edgeCases.length})</h4>
          <div className="space-y-2">
            {edgeCases.map((ec) => (
              <div key={ec.id} className="border border-orange-200 bg-orange-50 rounded-lg p-3">
                <span className="text-sm font-medium">{ec.description}</span>
                <div className="text-xs text-orange-700 mt-1">{ec.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── State Model View ──
function StateModelView({ stateModel }: { stateModel: Record<string, unknown> }) {
  const states = (stateModel.states || []) as StateDefinition[];
  const transitions = (stateModel.transitions || []) as Transition[];

  const stateColors: Record<string, string> = {
    initial: "bg-green-100 border-green-400 text-green-800",
    terminal: "bg-gray-200 border-gray-400 text-gray-700",
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-bold text-sm mb-2">States ({states.length})</h4>
        <div className="flex flex-wrap gap-2">
          {states.map((state) => (
            <div
              key={state.id}
              className={`text-xs font-mono px-3 py-1.5 rounded-full border ${stateColors[state.type || ""] || "bg-blue-50 border-blue-200 text-blue-800"}`}
            >
              {state.id}
              {state.receipt && <span className="ml-1 opacity-60" title="Receipt required">R</span>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-bold text-sm mb-2">Transitions ({transitions.length})</h4>
        <div className="space-y-1">
          {transitions.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{t.from}</span>
              <span className="text-gray-400">&rarr;</span>
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{t.to}</span>
              <span className="text-studio-accent font-medium">[{t.trigger}]</span>
              {t.condition && (
                <span className="text-orange-600 text-xs">({t.condition})</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Consent View ──
function ConsentView({ consent }: { consent: Record<string, unknown> }) {
  const grants = (consent.grants || consent.consent_grants || []) as ConsentGrant[];
  const model = consent;

  return (
    <div className="space-y-3">
      {typeof model.delegation_scope === "string" && (
        <div className="text-sm">
          <span className="text-gray-500">Delegation scope:</span>{" "}
          <span className="font-medium">{model.delegation_scope}</span>
        </div>
      )}

      {grants.length > 0 ? (
        <div className="space-y-2">
          {grants.map((grant) => (
            <div key={grant.id} className="border border-studio-border rounded-lg p-3 bg-white">
              <div className="font-medium text-sm">{grant.data_category}</div>
              <div className="text-xs text-gray-500 mt-1">{grant.purpose}</div>
              {grant.duration && (
                <div className="text-xs mt-1">Duration: {grant.duration}</div>
              )}
              <div className="text-xs mt-1">
                {grant.revocable !== false ? (
                  <span className="text-green-700">Revocable</span>
                ) : (
                  <span className="text-red-700">Non-revocable</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <pre className="text-xs overflow-auto max-h-48 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
          {JSON.stringify(consent, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Manifest Summary ──
function ManifestSummary({ manifest }: { manifest: Record<string, unknown> }) {
  const inputs = manifest.input_schema as Record<string, unknown> | undefined;
  const outputs = manifest.output_schema as Record<string, unknown> | undefined;

  function getFieldNames(schema: Record<string, unknown> | undefined): string[] {
    if (!schema) return [];
    if (Array.isArray(schema.required)) return schema.required as string[];
    if (schema.properties && typeof schema.properties === "object") return Object.keys(schema.properties as Record<string, unknown>);
    return [];
  }

  const inputFields = getFieldNames(inputs);
  const outputFields = getFieldNames(outputs);

  return (
    <div className="space-y-4">
      {inputFields.length > 0 ? (
        <div>
          <h4 className="font-bold text-sm mb-2">Required Inputs</h4>
          <div className="flex flex-wrap gap-1.5">
            {inputFields.map((field) => (
              <span key={field} className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">
                {field}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {outputFields.length > 0 ? (
        <div>
          <h4 className="font-bold text-sm mb-2">Outputs</h4>
          <div className="flex flex-wrap gap-1.5">
            {outputFields.map((field) => (
              <span key={field} className="text-xs font-mono bg-green-50 text-green-700 px-2 py-1 rounded">
                {field}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {manifest.redress ? (
        <div>
          <h4 className="font-bold text-sm mb-2">Redress</h4>
          <div className="text-sm space-y-1">
            {Object.entries(manifest.redress as Record<string, unknown>).map(([key, val]) => (
              <div key={key} className="flex gap-2">
                <span className="text-gray-500 capitalize">{key.replace(/_/g, " ")}:</span>
                <span className="font-medium">{typeof val === "string" ? val : JSON.stringify(val)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <details className="mt-2">
        <summary className="text-xs text-studio-accent cursor-pointer">View raw manifest JSON</summary>
        <pre className="text-xs overflow-auto max-h-64 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg mt-2">
          {JSON.stringify(manifest, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ── Artefact Section ──
function ArtefactSection({
  title,
  present,
  children,
}: {
  title: string;
  present: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  if (!present) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-xl p-4">
        <h3 className="font-bold text-sm">{title}</h3>
        <p className="text-sm text-red-600 mt-1">Not defined — this artefact is missing.</p>
      </div>
    );
  }

  return (
    <div className="border border-studio-border rounded-xl bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 rounded-t-xl"
      >
        <h3 className="font-bold text-sm flex items-center gap-2">
          <span className="text-green-600">&#10003;</span>
          {title}
        </h3>
        <span className="text-xs text-gray-500">{expanded ? "Collapse" : "Expand"}</span>
      </button>
      {expanded && (
        <div className="border-t border-studio-border p-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = use(params);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/services/${encodeURIComponent(serviceId)}`)
      .then((r) => r.json())
      .then((data) => {
        setService(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [serviceId]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Are you sure you want to delete "${service?.manifest?.name}"? This will permanently remove all artefact files.`)) {
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch(`/api/services/${encodeURIComponent(serviceId)}`, { method: "DELETE" });
      if (response.ok) {
        router.push("/services");
      } else {
        const err = await response.json();
        alert(err.error || "Failed to delete service");
        setDeleting(false);
      }
    } catch {
      alert("Failed to delete service");
      setDeleting(false);
    }
  }, [serviceId, service, router]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading service...</div>;
  }

  if (!service || service.error) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600">Service not found</h1>
        <a href="/services" className="text-studio-accent mt-4 inline-block hover:underline">
          Back to services
        </a>
      </div>
    );
  }

  const gaps: GapItem[] = service.gaps || [];
  const present = gaps.filter((g: GapItem) => g.status === "present").length;
  const completeness = gaps.length > 0 ? Math.round((present / gaps.length) * 100) : 0;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Services", href: "/services" },
          { label: service.manifest.name },
        ]}
      />

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{service.manifest.name}</h1>
          <p className="text-gray-500 mt-1">{service.manifest.department}</p>
          <p className="mt-2 text-gray-700">{service.manifest.description}</p>
          <div className="flex gap-2 mt-3">
            <a
              href={`/services/${encodeURIComponent(serviceId)}/ledger`}
              className="bg-govuk-green text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90"
            >
              View ledger
            </a>
            <a
              href={`/services/${encodeURIComponent(serviceId)}/edit`}
              className="bg-studio-accent text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90"
            >
              Edit service
            </a>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-light tracking-tight">{completeness}%</div>
          <div className="text-xs text-gray-500">artefact completeness</div>
        </div>
      </div>

      {/* Gap Analysis */}
      {gaps.filter((g: GapItem) => g.status !== "present").length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <h3 className="font-bold text-sm mb-2">Gaps detected</h3>
          <div className="space-y-1">
            {gaps
              .filter((g: GapItem) => g.status !== "present")
              .map((gap: GapItem) => (
                <div key={gap.field} className="flex items-center gap-2 text-sm">
                  <span className="text-red-500">&#10007;</span>
                  <span className="font-mono text-xs">{gap.field}</span>
                  <span className="text-gray-500">({gap.artefact})</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Service details */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {service.manifest.constraints?.sla && (
          <div className="border border-studio-border rounded-xl bg-white p-3">
            <div className="text-xs text-gray-500">SLA</div>
            <div className="font-bold">{service.manifest.constraints.sla}</div>
          </div>
        )}
        {service.manifest.constraints?.fee && (
          <div className="border border-studio-border rounded-xl bg-white p-3">
            <div className="text-xs text-gray-500">Fee</div>
            <div className="font-bold">
              {service.manifest.constraints.fee.currency} {service.manifest.constraints.fee.amount}
            </div>
          </div>
        )}
        {service.manifest.handoff?.escalation_phone && (
          <div className="border border-studio-border rounded-xl bg-white p-3">
            <div className="text-xs text-gray-500">Escalation phone</div>
            <div className="font-bold">{service.manifest.handoff.escalation_phone}</div>
          </div>
        )}
        {service.manifest.audit_requirements?.lawful_basis && (
          <div className="border border-studio-border rounded-xl bg-white p-3">
            <div className="text-xs text-gray-500">Lawful basis</div>
            <div className="font-bold">{service.manifest.audit_requirements.lawful_basis}</div>
          </div>
        )}
      </div>

      {/* Artefact views */}
      <h2 className="text-xl font-bold mb-3">Artefacts</h2>
      <div className="space-y-3">
        <ArtefactSection title="Capability Manifest" present={!!service.manifest}>
          <ManifestSummary manifest={service.manifest} />
        </ArtefactSection>

        <ArtefactSection title="Policy Ruleset" present={!!service.policy}>
          {service.policy && <PolicyView policy={service.policy} />}
        </ArtefactSection>

        <ArtefactSection title="State Model" present={!!service.stateModel}>
          {service.stateModel && <StateModelView stateModel={service.stateModel} />}
        </ArtefactSection>

        <ArtefactSection title="Consent Model" present={!!service.consent}>
          {service.consent && <ConsentView consent={service.consent} />}
        </ArtefactSection>
      </div>
    </div>
  );
}
