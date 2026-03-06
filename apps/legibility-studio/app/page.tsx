"use client";

import { useState, useEffect } from "react";
import { Server, FileSearch, BarChart3, ArrowRight, Clock, ExternalLink } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import PageHeader from "@/components/ui/PageHeader";

interface DashboardSummary {
  serviceCount: number;
  totalCases: number;
  activeCases: number;
  completionRate: number;
}

interface RecentCase {
  caseId: string;
  userId: string;
  serviceId: string;
  currentState: string;
  status: string;
  lastActivityAt: string;
  progressPercent: number;
  eventCount: number;
}

interface ServiceInfo {
  id: string;
  name: string;
  department: string;
}

const STATUS_STYLES: Record<string, string> = {
  "in-progress": "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  "handed-off": "bg-yellow-100 text-yellow-700",
  abandoned: "bg-gray-100 text-gray-500",
};

const PAGE_SIZE = 8;
const MAX_CASES = 80;

export default function StudioHomePage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [serviceMap, setServiceMap] = useState<Record<string, ServiceInfo>>({});
  const [page, setPage] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_CITIZEN_API || "http://localhost:3100"}/api/ledger/dashboard`).then((r) => r.json()).catch(() => null),
    ]).then(([servicesData, dashboardData]) => {
      const services = servicesData.services || [];
      const map: Record<string, ServiceInfo> = {};
      for (const s of services) {
        map[s.id] = { id: s.id, name: s.name, department: s.department };
      }
      setServiceMap(map);

      setSummary({
        serviceCount: services.length,
        totalCases: dashboardData?.totalCases || 0,
        activeCases: dashboardData?.activeCases || 0,
        completionRate: dashboardData?.completionRate || 0,
      });

      setRecentCases((dashboardData?.recentCases || []).slice(0, MAX_CASES));
    }).catch(() => {
      setSummary({ serviceCount: 0, totalCases: 0, activeCases: 0, completionRate: 0 });
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of services, cases, and system health."
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <KPICard label="Services" value={summary?.serviceCount ?? "..."} />
        <KPICard label="Total Cases" value={summary ? summary.totalCases.toLocaleString() : "..."} />
        <KPICard label="Active Cases" value={summary ? summary.activeCases.toLocaleString() : "..."} />
        <KPICard label="Completion Rate" value={summary ? `${summary.completionRate}%` : "..."} />
      </div>

      {/* Recent Cases */}
      {recentCases.length > 0 && (() => {
        const totalPages = Math.ceil(recentCases.length / PAGE_SIZE);
        const pageCases = recentCases.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        return (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wide">
                  Recent Cases
                </h2>
              </div>
              <a
                href="/evidence"
                className="text-xs text-studio-accent hover:underline flex items-center gap-1"
              >
                View all evidence <ExternalLink size={10} />
              </a>
            </div>
            <div className="border border-studio-border rounded-xl bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-studio-border bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="py-2.5 px-4">Service</th>
                    <th className="py-2.5 px-4">User</th>
                    <th className="py-2.5 px-4">State</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Progress</th>
                    <th className="py-2.5 px-4">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {pageCases.map((c) => {
                    const service = serviceMap[c.serviceId];
                    const caseUrl = `/services/${encodeURIComponent(c.serviceId)}/ledger/cases/${encodeURIComponent(c.userId)}`;
                    return (
                      <tr
                        key={c.caseId}
                        onClick={() => window.location.href = caseUrl}
                        className="border-b border-studio-border last:border-0 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <span className="text-studio-accent font-medium">
                            {service ? service.name : c.serviceId}
                          </span>
                          {service && (
                            <div className="text-xs text-gray-400">{service.department}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">{c.userId}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {c.currentState}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              STATUS_STYLES[c.status] || "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-studio-accent rounded-full"
                                style={{ width: `${c.progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{c.progressPercent}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-500">
                          {new Date(c.lastActivityAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, recentCases.length)} of {recentCases.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-xs font-medium border border-studio-border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-xs font-medium border border-studio-border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Quick nav cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <a
          href="/services"
          className="border border-studio-border rounded-xl bg-white p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-govuk-blue">
              <Server size={20} />
            </div>
            <h2 className="text-lg font-bold">Services</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Browse services, view operational ledgers, and manage capability manifests.
          </p>
          <span className="text-sm font-semibold text-studio-accent flex items-center gap-1 group-hover:gap-2 transition-all">
            View services <ArrowRight size={14} />
          </span>
        </a>

        <a
          href="/evidence"
          className="border border-studio-border rounded-xl bg-white p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-govuk-green">
              <FileSearch size={20} />
            </div>
            <h2 className="text-lg font-bold">Evidence</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Explore traces, receipts, and audit logs from agent interactions.
          </p>
          <span className="text-sm font-semibold text-studio-accent flex items-center gap-1 group-hover:gap-2 transition-all">
            View evidence <ArrowRight size={14} />
          </span>
        </a>

        <a
          href="/gap-analysis"
          className="border border-studio-border rounded-xl bg-white p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center text-yellow-600">
              <BarChart3 size={20} />
            </div>
            <h2 className="text-lg font-bold">Gap Analysis</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            See which services have complete artefacts and where gaps exist.
          </p>
          <span className="text-sm font-semibold text-studio-accent flex items-center gap-1 group-hover:gap-2 transition-all">
            Run analysis <ArrowRight size={14} />
          </span>
        </a>
      </div>
    </div>
  );
}
