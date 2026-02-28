"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";

interface RelatedService {
  id: string;
  name: string;
  dept: string;
  serviceType: string;
  desc: string;
}

interface RelatedServicesCardProps {
  serviceId: string;
}

export function RelatedServicesCard({ serviceId }: RelatedServicesCardProps) {
  const [services, setServices] = useState<RelatedService[]>([]);
  const [loading, setLoading] = useState(true);
  const startNewConversation = useAppStore((s) => s.startNewConversation);
  const navigateTo = useAppStore((s) => s.navigateTo);

  useEffect(() => {
    fetch(`/api/services/${encodeURIComponent(serviceId)}/related`)
      .then((r) => r.json())
      .then((data) => {
        setServices((data.services || []).slice(0, 3));
      })
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [serviceId]);

  if (loading || services.length === 0) return null;

  const handleServiceClick = (svc: RelatedService) => {
    startNewConversation(svc.id, svc.name);
    navigateTo("chat", svc.id, svc.name);
  };

  return (
    <div className="my-3 rounded-2xl border border-blue-100 bg-white" style={{ boxShadow: "0 2px 8px rgba(29,112,184,0.06)" }}>
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1d70b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
          <span className="text-xs font-bold text-govuk-dark-grey uppercase tracking-wider">
            You may also need
          </span>
        </div>

        <div className="space-y-2">
          {services.map((svc) => (
            <button
              key={svc.id}
              onClick={() => handleServiceClick(svc)}
              className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-govuk-blue group-hover:underline truncate">
                    {svc.name}
                  </p>
                  <p className="text-[11px] text-govuk-dark-grey mt-0.5">
                    {svc.dept}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-govuk-blue shrink-0 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
