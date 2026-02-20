"use client";

import { useState, useEffect } from "react";
import BottleneckChart from "./BottleneckChart";
import CasesList from "./CasesList";
import KPICard from "@/components/ui/KPICard";

interface DashboardData {
  serviceId: string;
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
  recentCases: Array<Record<string, unknown>>;
}

export default function LedgerDashboard({
  serviceId,
}: {
  serviceId: string;
}) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      `http://localhost:3100/api/ledger/services/${encodeURIComponent(serviceId)}/dashboard`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setDashboard(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to connect to citizen-experience API");
        setLoading(false);
      });
  }, [serviceId]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-xl p-4">
        <p className="text-red-600 font-bold">Error loading dashboard</p>
        <p className="text-sm text-red-600 mt-1">{error}</p>
        <p className="text-xs text-gray-500 mt-2">
          Make sure citizen-experience is running on port 3100.
        </p>
      </div>
    );
  }

  if (!dashboard || dashboard.totalCases === 0) {
    return (
      <div className="border border-studio-border rounded-xl bg-white p-6 text-center">
        <h3 className="text-lg font-bold mb-2">No cases yet</h3>
        <p className="text-sm text-gray-500">
          Cases will appear here once citizens start interacting with this
          service. Run <code className="bg-gray-100 px-1 rounded">npm run seed:ledger</code> to populate demo data.
        </p>
      </div>
    );
  }

  const agentPct =
    dashboard.agentActionTotal + dashboard.humanActionTotal > 0
      ? Math.round(
          (dashboard.agentActionTotal /
            (dashboard.agentActionTotal + dashboard.humanActionTotal)) *
            100,
        )
      : 0;

  return (
    <div className="space-y-8">
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
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> Completed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full inline-block" /> Active</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full inline-block" /> Handed off</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> Rejected</span>
        </div>
      </div>

      {/* Second row: Agent vs Human + Avg Progress */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-studio-border rounded-xl bg-white p-4">
          <h3 className="text-sm font-bold mb-2">Agent vs Human Actions</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                <div className="bg-blue-500 rounded-l-full" style={{ width: `${agentPct}%` }} />
                <div className="bg-green-500 rounded-r-full" style={{ width: `${100 - agentPct}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-1 text-gray-500">
                <span>Agent: {dashboard.agentActionTotal}</span>
                <span>Human: {dashboard.humanActionTotal}</span>
              </div>
            </div>
            <div className="text-3xl font-bold">{agentPct}%</div>
          </div>
          <p className="text-xs text-gray-400 mt-1">of actions performed by agent</p>
        </div>

        <div className="border border-studio-border rounded-xl bg-white p-4">
          <h3 className="text-sm font-bold mb-2">Average Progress</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-govuk-green rounded-full"
                style={{ width: `${dashboard.avgProgress}%` }}
              />
            </div>
            <div className="text-3xl font-bold">{dashboard.avgProgress}%</div>
          </div>
          <p className="text-xs text-gray-400 mt-1">of active cases through their journey</p>
        </div>
      </div>

      {/* Bottlenecks */}
      {dashboard.bottlenecks.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-3">Bottleneck States</h3>
          <p className="text-xs text-gray-500 mb-3">
            States where active cases are currently stuck.
          </p>
          <BottleneckChart bottlenecks={dashboard.bottlenecks} />
        </div>
      )}

      {/* Cases List */}
      <div>
        <h3 className="text-lg font-bold mb-3">All Cases</h3>
        <CasesList serviceId={serviceId} />
      </div>
    </div>
  );
}
