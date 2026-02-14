"use client";

import { useState, useEffect } from "react";

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
    return <div className="text-center py-12 text-govuk-dark-grey">Analyzing gaps...</div>;
  }

  const totalGaps = services.reduce((sum, s) => sum + s.gapCount, 0);
  const avgCompleteness =
    services.length > 0
      ? Math.round(services.reduce((sum, s) => sum + s.completeness, 0) / services.length)
      : 0;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Gap Analysis</h1>
      <p className="text-govuk-dark-grey mb-6">
        Overview of artefact completeness across all registered services.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border border-govuk-mid-grey rounded p-4 text-center">
          <div className="text-3xl font-bold">{services.length}</div>
          <div className="text-xs text-govuk-dark-grey mt-1">Services</div>
        </div>
        <div className="border border-govuk-mid-grey rounded p-4 text-center">
          <div className="text-3xl font-bold">{avgCompleteness}%</div>
          <div className="text-xs text-govuk-dark-grey mt-1">Avg completeness</div>
        </div>
        <div className="border border-govuk-mid-grey rounded p-4 text-center">
          <div className={`text-3xl font-bold ${totalGaps > 0 ? "text-red-600" : "text-green-600"}`}>
            {totalGaps}
          </div>
          <div className="text-xs text-govuk-dark-grey mt-1">Total gaps</div>
        </div>
      </div>

      {/* Per-service table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-govuk-dark-grey">
            <th className="text-left py-2 text-sm">Service</th>
            <th className="text-left py-2 text-sm">Dept</th>
            <th className="text-center py-2 text-sm">Manifest</th>
            <th className="text-center py-2 text-sm">Policy</th>
            <th className="text-center py-2 text-sm">States</th>
            <th className="text-center py-2 text-sm">Consent</th>
            <th className="text-right py-2 text-sm">Complete</th>
            <th className="text-right py-2 text-sm">Gaps</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id} className="border-b border-govuk-mid-grey">
              <td className="py-3">
                <a href={`/services/${encodeURIComponent(service.id)}`} className="text-govuk-blue font-medium">
                  {service.name}
                </a>
              </td>
              <td className="py-3 text-sm text-govuk-dark-grey">{service.department}</td>
              <td className="py-3 text-center text-green-600">&#10003;</td>
              <td className="py-3 text-center">
                {service.hasPolicy ? (
                  <span className="text-green-600">&#10003;</span>
                ) : (
                  <span className="text-red-600">&#10007;</span>
                )}
              </td>
              <td className="py-3 text-center">
                {service.hasStateModel ? (
                  <span className="text-green-600">&#10003;</span>
                ) : (
                  <span className="text-red-600">&#10007;</span>
                )}
              </td>
              <td className="py-3 text-center">
                {service.hasConsent ? (
                  <span className="text-green-600">&#10003;</span>
                ) : (
                  <span className="text-red-600">&#10007;</span>
                )}
              </td>
              <td className="py-3 text-right font-bold">{service.completeness}%</td>
              <td className="py-3 text-right">
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
  );
}
