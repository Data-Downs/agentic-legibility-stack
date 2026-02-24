"use client";

import { useState, useEffect } from "react";
import { Server, FileSearch, BarChart3, ArrowRight } from "lucide-react";
import KPICard from "@/components/ui/KPICard";
import PageHeader from "@/components/ui/PageHeader";

interface DashboardSummary {
  serviceCount: number;
  totalCases: number;
  activeCases: number;
  completionRate: number;
}

export default function StudioHomePage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/services").then((r) => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_CITIZEN_API || "http://localhost:3100"}/api/ledger/dashboard`).then((r) => r.json()).catch(() => null),
    ]).then(([servicesData, dashboardData]) => {
      setSummary({
        serviceCount: servicesData.services?.length || 0,
        totalCases: dashboardData?.totalCases || 0,
        activeCases: dashboardData?.activeCases || 0,
        completionRate: dashboardData?.completionRate || 0,
      });
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
        <KPICard label="Services" value={summary?.serviceCount ?? "..."} sparkSeed="services" />
        <KPICard label="Total Cases" value={summary ? summary.totalCases.toLocaleString() : "..."} sparkSeed="total-cases" />
        <KPICard label="Active Cases" value={summary ? summary.activeCases.toLocaleString() : "..."} sparkSeed="active-cases" />
        <KPICard
          label="Completion Rate"
          value={summary ? `${summary.completionRate}%` : "..."}
          sparkSeed="completion-rate"
        />
      </div>

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
