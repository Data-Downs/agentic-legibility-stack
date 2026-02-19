"use client";

import { useState, useEffect, useCallback } from "react";

interface Service {
  id: string;
  name: string;
  department: string;
  description: string;
  hasPolicy: boolean;
  hasStateModel: boolean;
  hasConsent: boolean;
  promoted: boolean;
  completeness: number;
  gapCount: number;
}

interface DashboardData {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  rejectedCases: number;
  handedOffCases: number;
  completionRate: number;
  handoffRate: number;
  avgProgress: number;
  agentActionTotal: number;
  humanActionTotal: number;
  bottlenecks: Array<{ stateId: string; caseCount: number }>;
}

/** Built-in services that always appear on the citizen Dashboard */
const BUILT_IN_SERVICE_IDS = new Set([
  "dvla.renew-driving-licence",
  "dwp.apply-universal-credit",
  "dwp.check-state-pension",
]);

function KPICard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="border border-govuk-mid-grey rounded p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-govuk-dark-grey font-bold mt-1">{label}</div>
      {sub && <div className="text-xs text-govuk-dark-grey mt-0.5">{sub}</div>}
    </div>
  );
}

function AllServicesDashboard({ dashboard }: { dashboard: DashboardData }) {
  const agentPct =
    dashboard.agentActionTotal + dashboard.humanActionTotal > 0
      ? Math.round(
          (dashboard.agentActionTotal /
            (dashboard.agentActionTotal + dashboard.humanActionTotal)) *
            100,
        )
      : 0;

  return (
    <div className="border border-govuk-mid-grey rounded p-6 mb-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">All Services Dashboard</h2>
        <p className="text-sm text-govuk-dark-grey">
          Aggregated operational metrics across all services.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Cases" value={dashboard.totalCases} />
        <KPICard label="Active Cases" value={dashboard.activeCases} />
        <KPICard
          label="Completion Rate"
          value={`${dashboard.completionRate}%`}
          sub={`${dashboard.completedCases} completed`}
        />
        <KPICard
          label="Handoff Rate"
          value={`${dashboard.handoffRate}%`}
          sub={`${dashboard.handedOffCases} handed off`}
        />
      </div>

      {/* Status bar */}
      <div>
        <h3 className="text-sm font-bold mb-2">Status Breakdown</h3>
        <div className="flex h-4 rounded overflow-hidden">
          {dashboard.completedCases > 0 && (
            <div
              className="bg-green-500"
              style={{ width: `${(dashboard.completedCases / dashboard.totalCases) * 100}%` }}
              title={`${dashboard.completedCases} completed`}
            />
          )}
          {dashboard.activeCases > 0 && (
            <div
              className="bg-blue-500"
              style={{ width: `${(dashboard.activeCases / dashboard.totalCases) * 100}%` }}
              title={`${dashboard.activeCases} active`}
            />
          )}
          {dashboard.handedOffCases > 0 && (
            <div
              className="bg-yellow-500"
              style={{ width: `${(dashboard.handedOffCases / dashboard.totalCases) * 100}%` }}
              title={`${dashboard.handedOffCases} handed off`}
            />
          )}
          {dashboard.rejectedCases > 0 && (
            <div
              className="bg-red-500"
              style={{ width: `${(dashboard.rejectedCases / dashboard.totalCases) * 100}%` }}
              title={`${dashboard.rejectedCases} rejected`}
            />
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-govuk-dark-grey">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> Completed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full inline-block" /> Active</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full inline-block" /> Handed off</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> Rejected</span>
        </div>
      </div>

      {/* Agent vs Human + Avg Progress */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-govuk-mid-grey rounded p-4">
          <h3 className="text-sm font-bold mb-2">Agent vs Human Actions</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex h-3 rounded overflow-hidden bg-gray-100">
                <div className="bg-blue-500 rounded-l" style={{ width: `${agentPct}%` }} />
                <div className="bg-green-500 rounded-r" style={{ width: `${100 - agentPct}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-1 text-govuk-dark-grey">
                <span>Agent: {dashboard.agentActionTotal}</span>
                <span>Human: {dashboard.humanActionTotal}</span>
              </div>
            </div>
            <div className="text-2xl font-bold">{agentPct}%</div>
          </div>
          <p className="text-xs text-govuk-dark-grey mt-1">of actions performed by agent</p>
        </div>

        <div className="border border-govuk-mid-grey rounded p-4">
          <h3 className="text-sm font-bold mb-2">Average Progress</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-govuk-green rounded"
                style={{ width: `${dashboard.avgProgress}%` }}
              />
            </div>
            <div className="text-2xl font-bold">{dashboard.avgProgress}%</div>
          </div>
          <p className="text-xs text-govuk-dark-grey mt-1">of active cases through their journey</p>
        </div>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch("http://localhost:3100/api/ledger/dashboard").then((r) => r.json()).catch(() => null),
    ]).then(([servicesData, dashboardData]) => {
      setServices(servicesData.services || []);
      if (dashboardData && !dashboardData.error && dashboardData.totalCases > 0) {
        setDashboard(dashboardData);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const togglePromote = useCallback(async (serviceId: string) => {
    setTogglingId(serviceId);
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, promoted: !s.promoted } : s))
    );
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(serviceId)}/promote`, {
        method: "POST",
      });
      if (!res.ok) {
        setServices((prev) =>
          prev.map((s) => (s.id === serviceId ? { ...s, promoted: !s.promoted } : s))
        );
      }
    } catch {
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, promoted: !s.promoted } : s))
      );
    } finally {
      setTogglingId(null);
    }
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-govuk-dark-grey">Loading services...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold">Services</h1>
        <a
          href="/services/new"
          className="bg-green-700 text-white px-4 py-2 rounded font-bold text-sm hover:bg-green-800 no-underline"
        >
          + Create new service
        </a>
      </div>
      <p className="text-govuk-dark-grey mb-6">
        {services.length} service(s) registered in the Agentic Legibility Stack.
      </p>

      {/* All-services dashboard */}
      {dashboard && <AllServicesDashboard dashboard={dashboard} />}

      <div className="space-y-4">
        {services.map((service) => (
          <div
            key={service.id}
            className="border border-govuk-mid-grey hover:border-govuk-blue transition-colors"
          >
            <a
              href={`/services/${encodeURIComponent(service.id)}`}
              className="block p-5 no-underline text-inherit"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{service.name}</h2>
                  <p className="text-sm text-govuk-dark-grey mt-1">{service.department}</p>
                  <p className="text-sm mt-2">{service.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{service.completeness}%</div>
                  <div className="text-xs text-govuk-dark-grey">complete</div>
                  {service.gapCount > 0 && (
                    <div className="text-xs text-red-600 mt-1">
                      {service.gapCount} gap(s)
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                  Manifest
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    service.hasPolicy
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  Policy {service.hasPolicy ? "" : "(missing)"}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    service.hasStateModel
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  State Model {service.hasStateModel ? "" : "(missing)"}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    service.hasConsent
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  Consent {service.hasConsent ? "" : "(missing)"}
                </span>
              </div>
            </a>

            {/* Action bar: ledger, edit, delete + promote toggle */}
            <div className="border-t border-govuk-mid-grey px-5 py-3 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <a
                  href={`/services/${encodeURIComponent(service.id)}/ledger`}
                  className="text-sm font-bold text-govuk-blue hover:underline no-underline"
                >
                  View ledger
                </a>
                <span className="text-govuk-mid-grey">|</span>
                <a
                  href={`/services/${encodeURIComponent(service.id)}/edit`}
                  className="text-sm font-bold text-govuk-blue hover:underline no-underline"
                >
                  Edit service
                </a>
                <span className="text-govuk-mid-grey">|</span>
                <a
                  href={`/services/${encodeURIComponent(service.id)}`}
                  className="text-sm font-bold text-red-600 hover:underline no-underline"
                >
                  Delete
                </a>
              </div>

              <div className="flex items-center gap-3">
                {BUILT_IN_SERVICE_IDS.has(service.id) ? (
                  <span className="text-sm text-govuk-dark-grey">
                    <span className="text-blue-700 font-medium">Built-in</span>
                  </span>
                ) : (
                  <>
                    <span className="text-sm text-govuk-dark-grey">
                      {service.promoted ? (
                        <span className="text-green-700 font-medium">Promoted</span>
                      ) : (
                        "Not promoted"
                      )}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        togglePromote(service.id);
                      }}
                      disabled={togglingId === service.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
                        service.promoted ? "bg-green-600" : "bg-gray-300"
                      } ${togglingId === service.id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                      aria-label={`${service.promoted ? "Remove" : "Add"} ${service.name} from citizen dashboard`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          service.promoted ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
