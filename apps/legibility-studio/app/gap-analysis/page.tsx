"use client";

import { useState, useEffect } from "react";
import KPICard from "@/components/ui/KPICard";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/ui/PageHeader";

interface Service {
  id: string;
  name: string;
  department: string;
  completeness: number;
  gapCount: number;
  hasPolicy: boolean;
  hasStateModel: boolean;
  hasConsent: boolean;
}

export default function GapAnalysisPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        setServices(data.services || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Analyzing gaps...</div>;
  }

  const totalGaps = services.reduce((sum, s) => sum + s.gapCount, 0);
  const avgCompleteness =
    services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.completeness, 0) / services.length)
      : 0;

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Gap Analysis" }]} />
      <PageHeader
        title="Gap Analysis"
        subtitle="Overview of artefact completeness across all registered services."
      />

      {/* Summary KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <KPICard label="Services" value={services.length} />
        <KPICard label="Avg Completeness" value={`${avgCompleteness}%`} />
        <KPICard label="Total Gaps" value={totalGaps} />
      </div>

      {/* Per-service table */}
      <div className="border border-studio-border rounded-xl bg-white overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-studio-border bg-gray-50">
              <th className="text-left py-3 px-4 text-sm font-semibold">Service</th>
              <th className="text-left py-3 px-4 text-sm font-semibold">Dept</th>
              <th className="text-center py-3 px-4 text-sm font-semibold">Manifest</th>
              <th className="text-center py-3 px-4 text-sm font-semibold">Policy</th>
              <th className="text-center py-3 px-4 text-sm font-semibold">States</th>
              <th className="text-center py-3 px-4 text-sm font-semibold">Consent</th>
              <th className="text-right py-3 px-4 text-sm font-semibold">Complete</th>
              <th className="text-right py-3 px-4 text-sm font-semibold">Gaps</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-studio-border">
            {services.map((service) => (
              <tr key={service.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <a href={`/services/${encodeURIComponent(service.id)}`} className="text-studio-accent font-medium hover:underline">
                    {service.name}
                  </a>
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">{service.department}</td>
                <td className="py-3 px-4 text-center text-green-600">&#10003;</td>
                <td className="py-3 px-4 text-center">
                  {service.hasPolicy ? (
                    <span className="text-green-600">&#10003;</span>
                  ) : (
                    <span className="text-red-600">&#10007;</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {service.hasStateModel ? (
                    <span className="text-green-600">&#10003;</span>
                  ) : (
                    <span className="text-red-600">&#10007;</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {service.hasConsent ? (
                    <span className="text-green-600">&#10003;</span>
                  ) : (
                    <span className="text-red-600">&#10007;</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-bold">{service.completeness}%</td>
                <td className="py-3 px-4 text-right">
                  {service.gapCount > 0 ? (
                    <span className="text-red-600 font-bold">{service.gapCount}</span>
                  ) : (
                    <span className="text-green-600">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
