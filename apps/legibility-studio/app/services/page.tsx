"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import KPICard from "@/components/ui/KPICard";
import PageHeader from "@/components/ui/PageHeader";
import Breadcrumbs from "@/components/layout/Breadcrumbs";

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
  source?: "full" | "graph";
  serviceType?: string;
  govuk_url?: string;
}

interface LifeEventFilter {
  id: string;
  name: string;
  icon: string;
  serviceIds: string[];
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
    <div className="border border-studio-border rounded-xl bg-white p-6 mb-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">All Services Dashboard</h2>
        <p className="text-sm text-gray-500">
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
        <div className="flex h-4 rounded-full overflow-hidden">
          {dashboard.completedCases > 0 && (
            <div
              className="bg-govuk-blue"
              style={{ width: `${(dashboard.completedCases / dashboard.totalCases) * 100}%` }}
              title={`${dashboard.completedCases} completed`}
            />
          )}
          {dashboard.activeCases > 0 && (
            <div
              className="bg-govuk-blue/70"
              style={{ width: `${(dashboard.activeCases / dashboard.totalCases) * 100}%` }}
              title={`${dashboard.activeCases} active`}
            />
          )}
          {dashboard.handedOffCases > 0 && (
            <div
              className="bg-govuk-blue/45"
              style={{ width: `${(dashboard.handedOffCases / dashboard.totalCases) * 100}%` }}
              title={`${dashboard.handedOffCases} handed off`}
            />
          )}
          {dashboard.rejectedCases > 0 && (
            <div
              className="bg-govuk-blue/25"
              style={{ width: `${(dashboard.rejectedCases / dashboard.totalCases) * 100}%` }}
              title={`${dashboard.rejectedCases} rejected`}
            />
          )}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-govuk-blue rounded-full inline-block" /> Completed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-govuk-blue/70 rounded-full inline-block" /> Active</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-govuk-blue/45 rounded-full inline-block" /> Handed off</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-govuk-blue/25 rounded-full inline-block" /> Rejected</span>
        </div>
      </div>

      {/* Agent vs Human + Avg Progress */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-studio-border rounded-xl p-4">
          <h3 className="text-sm font-bold mb-2">Agent vs Human Actions</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                <div className="bg-govuk-blue rounded-l-full" style={{ width: `${agentPct}%` }} />
                <div className="bg-govuk-blue/25 rounded-r-full" style={{ width: `${100 - agentPct}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-1 text-gray-500">
                <span>Agent: {dashboard.agentActionTotal}</span>
                <span>Human: {dashboard.humanActionTotal}</span>
              </div>
            </div>
            <div className="text-3xl font-light tracking-tight">{agentPct}%</div>
          </div>
          <p className="text-xs text-gray-400 mt-1">of actions performed by agent</p>
        </div>

        <div className="border border-studio-border rounded-xl p-4">
          <h3 className="text-sm font-bold mb-2">Average Progress</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-govuk-blue/70 rounded-full"
                style={{ width: `${dashboard.avgProgress}%` }}
              />
            </div>
            <div className="text-3xl font-light tracking-tight">{dashboard.avgProgress}%</div>
          </div>
          <p className="text-xs text-gray-400 mt-1">of active cases through their journey</p>
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
  const [sourceFilter, setSourceFilter] = useState<"all" | "full" | "graph">("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [lifeEventFilter, setLifeEventFilter] = useState<string>("all");
  const [lifeEvents, setLifeEvents] = useState<LifeEventFilter[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_CITIZEN_API || "http://localhost:3100"}/api/ledger/dashboard`).then((r) => r.json()).catch(() => null),
    ]).then(([servicesData, dashboardData]) => {
      setServices(servicesData.services || []);
      setLifeEvents(servicesData.lifeEvents || []);
      if (dashboardData && !dashboardData.error && dashboardData.totalCases > 0) {
        setDashboard(dashboardData);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const departments = useMemo(() => {
    const depts = new Set(services.map((s) => s.department));
    return [...depts].sort();
  }, [services]);

  const filteredServices = useMemo(() => {
    let filtered = services;
    if (sourceFilter !== "all") {
      filtered = filtered.filter((s) => (s.source || "full") === sourceFilter);
    }
    if (deptFilter !== "all") {
      filtered = filtered.filter((s) => s.department === deptFilter);
    }
    if (lifeEventFilter !== "all") {
      const le = lifeEvents.find((e) => e.id === lifeEventFilter);
      if (le) {
        const ids = new Set(le.serviceIds);
        filtered = filtered.filter((s) => ids.has(s.id));
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [services, sourceFilter, deptFilter, lifeEventFilter, lifeEvents, searchQuery]);

  const fullCount = services.filter((s) => (s.source || "full") === "full").length;
  const graphCount = services.filter((s) => s.source === "graph").length;

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
    return <div className="text-center py-12 text-gray-500">Loading services...</div>;
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Services" }]} />
      <PageHeader
        title="Services"
        subtitle={`${services.length} service(s) registered — ${fullCount} full, ${graphCount} from graph.`}
        actions={
          <a
            href="/services/new"
            className="bg-govuk-green text-white px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90"
          >
            + Create new service
          </a>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Source filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-500">Source:</span>
          {(["all", "full", "graph"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSourceFilter(f)}
              className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-colors ${
                sourceFilter === f
                  ? "bg-govuk-blue text-white border-govuk-blue"
                  : "bg-white text-gray-600 border-gray-300 hover:border-govuk-blue"
              }`}
            >
              {f === "all" ? `All (${services.length})` : f === "full" ? `Full (${fullCount})` : `Graph (${graphCount})`}
            </button>
          ))}
        </div>

        {/* Department filter */}
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2.5 py-1"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Life event filter */}
        {lifeEvents.length > 0 && (
          <select
            value={lifeEventFilter}
            onChange={(e) => setLifeEventFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2.5 py-1"
          >
            <option value="all">All life events</option>
            {lifeEvents.map((le) => (
              <option key={le.id} value={le.id}>{le.icon} {le.name} ({le.serviceIds.length})</option>
            ))}
          </select>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1 flex-1 min-w-[200px]"
        />
      </div>

      {/* All-services dashboard */}
      {dashboard && <AllServicesDashboard dashboard={dashboard} />}

      <div className="space-y-4">
        {filteredServices.map((service) => (
          <div
            key={service.id}
            className="border border-studio-border rounded-xl bg-white hover:shadow-sm transition-shadow"
          >
            <a
              href={service.source === "graph" && service.govuk_url ? service.govuk_url : `/services/${encodeURIComponent(service.id)}`}
              className="block p-5"
              target={service.source === "graph" ? "_blank" : undefined}
              rel={service.source === "graph" ? "noopener noreferrer" : undefined}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold">{service.name}</h2>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      (service.source || "full") === "full"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {(service.source || "full") === "full" ? "Full" : "Graph"}
                    </span>
                    {service.serviceType && (
                      <span className="text-[10px] font-medium text-gray-500 uppercase">{service.serviceType}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{service.department}</p>
                  <p className="text-sm mt-2 text-gray-700">{service.description}</p>
                </div>
                {(service.source || "full") === "full" && (
                  <div className="text-right">
                    <div className="text-3xl font-light tracking-tight">{service.completeness}%</div>
                    <div className="text-xs text-gray-500">complete</div>
                    {service.gapCount > 0 && (
                      <div className="text-xs text-red-600 mt-1">
                        {service.gapCount} gap(s)
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-3">
                {(service.source || "full") === "full" ? (
                  <>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      Manifest
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        service.hasPolicy
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      Policy {service.hasPolicy ? "" : "(missing)"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        service.hasStateModel
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      State Model {service.hasStateModel ? "" : "(missing)"}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        service.hasConsent
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      Consent {service.hasConsent ? "" : "(missing)"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      Eligibility data
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      GOV.UK link
                    </span>
                  </>
                )}
              </div>
            </a>

            {/* Action bar */}
            <div className="border-t border-studio-border px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(service.source || "full") === "full" ? (
                  <>
                    <a
                      href={`/services/${encodeURIComponent(service.id)}/ledger`}
                      className="text-sm font-semibold text-studio-accent hover:underline"
                    >
                      View ledger
                    </a>
                    <span className="text-gray-300">|</span>
                    <a
                      href={`/services/${encodeURIComponent(service.id)}/edit`}
                      className="text-sm font-semibold text-studio-accent hover:underline"
                    >
                      Edit service
                    </a>
                    <span className="text-gray-300">|</span>
                    <a
                      href={`/services/${encodeURIComponent(service.id)}`}
                      className="text-sm font-semibold text-red-600 hover:underline"
                    >
                      Delete
                    </a>
                  </>
                ) : (
                  <span className="text-sm text-gray-500">
                    Graph-only — needs artefacts for full integration
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {(service.source || "full") === "full" && (
                  <>
                    <span className="text-sm text-gray-500">
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
