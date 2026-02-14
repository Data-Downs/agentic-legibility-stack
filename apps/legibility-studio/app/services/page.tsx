"use client";

import { useState, useEffect } from "react";

interface Service {
  id: string;
  name: string;
  department: string;
  description: string;
  hasPolicy: boolean;
  hasStateModel: boolean;
  hasConsent: boolean;
  completeness: number;
  gapCount: number;
}

export default function ServicesPage() {
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
    return <div className="text-center py-12 text-govuk-dark-grey">Loading services...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Services</h1>
      <p className="text-govuk-dark-grey mb-6">
        {services.length} service(s) registered in the Agentic Legibility Stack.
      </p>

      <div className="space-y-4">
        {services.map((service) => (
          <a
            key={service.id}
            href={`/services/${encodeURIComponent(service.id)}`}
            className="block border border-govuk-mid-grey p-5 hover:border-govuk-blue transition-colors no-underline text-inherit"
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
        ))}
      </div>
    </div>
  );
}
