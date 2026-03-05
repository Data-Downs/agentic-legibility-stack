"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { ServicePlanStatus, ServiceType } from "@/lib/types";
import { computeServiceHints } from "@/lib/plan-hints";
import { DocumentUploadCard } from "@/components/cards/DocumentUploadCard";
import type { CardDefinition } from "@als/schemas";

const STATUS_CONFIG: Record<
  ServicePlanStatus,
  { icon: string; label: string; bgClass: string; textClass: string; borderClass: string; dimmed: boolean }
> = {
  completed: {
    icon: "check",
    label: "Done",
    bgClass: "bg-green-50",
    textClass: "text-green-700",
    borderClass: "border-green-200",
    dimmed: false,
  },
  in_progress: {
    icon: "play",
    label: "Continue",
    bgClass: "bg-blue-50",
    textClass: "text-blue-700",
    borderClass: "border-blue-200",
    dimmed: false,
  },
  available: {
    icon: "arrow",
    label: "Start",
    bgClass: "bg-white",
    textClass: "text-govuk-black",
    borderClass: "border-green-300",
    dimmed: false,
  },
  locked: {
    icon: "lock",
    label: "Locked",
    bgClass: "bg-gray-50",
    textClass: "text-gray-400",
    borderClass: "border-gray-200",
    dimmed: true,
  },
  skipped: {
    icon: "skip",
    label: "Skipped",
    bgClass: "bg-gray-50",
    textClass: "text-gray-500",
    borderClass: "border-gray-200",
    dimmed: false,
  },
};

function StatusIcon({ status }: { status: ServicePlanStatus }) {
  switch (status) {
    case "completed":
      return (
        <span className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      );
    case "in_progress":
      return (
        <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      );
    case "available":
      return (
        <span className="w-6 h-6 rounded-full bg-green-100 border-2 border-green-500 flex items-center justify-center shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      );
    case "skipped":
      return (
        <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </span>
      );
    case "locked":
    default:
      return (
        <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </span>
      );
  }
}

export function PlanView() {
  const activePlan = useAppStore((s) => s.activePlan);
  const personaData = useAppStore((s) => s.personaData);
  const navigateTo = useAppStore((s) => s.navigateTo);
  const loadConversation = useAppStore((s) => s.loadConversation);
  const startServiceFromPlan = useAppStore((s) => s.startServiceFromPlan);
  const markServiceSkipped = useAppStore((s) => s.markServiceSkipped);
  const completeServiceWithUpload = useAppStore((s) => s.completeServiceWithUpload);

  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [uploadingServiceId, setUploadingServiceId] = useState<string | null>(null);

  if (!activePlan) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <p className="text-govuk-dark-grey">No active plan found.</p>
        <button
          onClick={() => navigateTo("dashboard")}
          className="mt-4 text-govuk-blue underline text-sm"
        >
          Return to dashboard
        </button>
      </div>
    );
  }

  const { plan, services, serviceProgress } = activePlan;
  const svcLookup = new Map(services.map((s) => [s.id, s]));

  const serviceHints = useMemo(
    () => computeServiceHints(services, personaData),
    [services, personaData]
  );

  // Compute progress
  const total = services.length;
  const completedCount = Object.values(serviceProgress).filter(
    (s) => s === "completed" || s === "skipped"
  ).length;
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  function handleServiceClick(serviceId: string, status: ServicePlanStatus) {
    const svc = svcLookup.get(serviceId);
    if (!svc) return;

    if (status === "available") {
      setExpandedServiceId((prev) => (prev === serviceId ? null : serviceId));
      return;
    } else if (status === "in_progress") {
      const convId = activePlan?.serviceConversations[serviceId];
      if (convId) {
        loadConversation(convId);
        navigateTo("chat", svc.id as ServiceType, svc.name);
      }
    }
  }

  function handleStartService(serviceId: string) {
    const svc = svcLookup.get(serviceId);
    if (!svc) return;
    setExpandedServiceId(null);
    startServiceFromPlan(svc.id, svc.name);
  }

  function handleSkipService(serviceId: string) {
    setExpandedServiceId(null);
    markServiceSkipped(serviceId);
  }

  return (
    <div className="max-w-lg mx-auto pb-20">
      {/* Plan header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{activePlan.lifeEventIcon}</span>
          <div>
            <h2 className="text-2xl font-bold text-govuk-black">
              {activePlan.lifeEventName}
            </h2>
            <p className="text-sm text-govuk-dark-grey">
              {completedCount} of {total} service{total !== 1 ? "s" : ""} complete
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-govuk-green rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-govuk-dark-grey mt-1 text-right">{pct}%</p>
      </div>

      {/* Grouped services */}
      <div className="flex flex-col">
        {plan.groups.map((group, gi) => (
          <div key={gi}>
            {/* Connector arrow between groups */}
            {gi > 0 && (
              <div className="flex justify-center py-2">
                <svg width="16" height="24" viewBox="0 0 16 24" fill="none" className="text-govuk-mid-grey">
                  <path d="M8 0v20M4 16l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}

            {/* Group label */}
            <div className="mb-3">
              <p className={`text-xs font-bold uppercase tracking-wide ${
                group.depth === 0 ? "text-green-700" : "text-govuk-dark-grey"
              }`}>
                {group.depth === 0 ? "Start here" : group.label}
              </p>
            </div>

            {/* Service cards */}
            <div className="flex flex-col gap-2 mb-2">
              {group.serviceIds.map((svcId) => {
                const svc = svcLookup.get(svcId);
                if (!svc) return null;
                const status = serviceProgress[svcId] || "locked";
                const config = STATUS_CONFIG[status];
                const clickable = status === "available" || status === "in_progress";

                const isExpanded = expandedServiceId === svcId;

                return (
                  <div key={svcId}>
                    <button
                      onClick={() => handleServiceClick(svcId, status)}
                      disabled={!clickable}
                      className={`w-full text-left p-3 rounded-card shadow-sm transition-all touch-feedback ${config.bgClass} ${
                        clickable ? "hover:shadow-md cursor-pointer" : "cursor-default"
                      } ${config.dimmed ? "opacity-60" : ""} ${
                        isExpanded ? "rounded-b-none" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon status={status} />
                        <div className="flex-1 min-w-0">
                          <strong className={`block text-sm ${config.textClass}`}>
                            {svc.name}
                          </strong>
                          <span className={`text-xs ${config.dimmed ? "text-gray-400" : "text-govuk-dark-grey"}`}>
                            {svc.dept} &middot; {svc.serviceType}
                          </span>
                        </div>
                        {clickable && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                            status === "in_progress"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}>
                            {status === "available" && isExpanded ? "Collapse" : config.label}
                          </span>
                        )}
                        {status === "completed" && (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
                            Done
                          </span>
                        )}
                        {status === "skipped" && (
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 shrink-0">
                            Skipped
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Inline service brief */}
                    {isExpanded && status === "available" && (() => {
                      const hint = serviceHints[svcId];
                      return (
                      <div className="shadow-sm rounded-b-card bg-green-50/50 p-4 space-y-3">
                        {hint ? (
                          <>
                            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d70b8" strokeWidth="2" className="shrink-0 mt-0.5">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4M12 8h.01" />
                              </svg>
                              <span className="text-sm text-blue-800 leading-relaxed">{hint.message}</span>
                            </div>

                            {uploadingServiceId === svcId ? (
                              <DocumentUploadCard
                                definition={{
                                  cardType: "document-upload",
                                  title: hint.uploadLabel,
                                  description: `Upload your document for ${svc.name}`,
                                  fields: [],
                                  dataCategory: "documents",
                                }}
                                serviceId={svcId}
                                stateId={`${svcId}-upload`}
                                onSubmit={(fields) => {
                                  setUploadingServiceId(null);
                                  setExpandedServiceId(null);
                                  completeServiceWithUpload(svcId, fields);
                                }}
                              />
                            ) : (
                              <div className="flex flex-col gap-2 pt-1">
                                <button
                                  onClick={() => setUploadingServiceId(svcId)}
                                  className="w-full py-2.5 rounded-full bg-govuk-green text-white text-sm font-bold hover:bg-govuk-green/90 transition-colors touch-feedback"
                                >
                                  {hint.uploadLabel}
                                </button>
                                <button
                                  onClick={() => handleStartService(svcId)}
                                  className="w-full py-2.5 rounded-full bg-white border border-gray-300 text-govuk-black text-sm font-bold hover:bg-gray-50 transition-colors touch-feedback"
                                >
                                  {hint.chatLabel}
                                </button>
                                <button
                                  onClick={() => handleSkipService(svcId)}
                                  className="text-sm text-govuk-dark-grey underline hover:text-govuk-black transition-colors mt-1"
                                >
                                  Skip
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-govuk-black leading-relaxed">
                              {svc.desc}
                            </p>

                            {svc.eligibility_summary && (
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <p className="text-xs font-bold text-govuk-dark-grey uppercase tracking-wide mb-1">
                                  Eligibility
                                </p>
                                <p className="text-sm text-govuk-black">
                                  {svc.eligibility_summary}
                                </p>
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-xs text-govuk-dark-grey">
                              <span className="font-medium">{svc.dept}</span>
                              <span>&middot;</span>
                              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                                {svc.serviceType}
                              </span>
                            </div>

                            {svc.govuk_url && (
                              <a
                                href={svc.govuk_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-govuk-blue underline hover:text-govuk-blue/80"
                              >
                                View on GOV.UK
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                                </svg>
                              </a>
                            )}

                            <div className="flex items-center gap-3 pt-1">
                              <button
                                onClick={() => handleStartService(svcId)}
                                className="flex-1 py-2.5 rounded-full bg-govuk-green text-white text-sm font-bold hover:bg-govuk-green/90 transition-colors touch-feedback"
                              >
                                Start this service
                              </button>
                              <button
                                onClick={() => handleSkipService(svcId)}
                                className="text-sm text-govuk-dark-grey underline hover:text-govuk-black transition-colors"
                              >
                                Skip
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Return to dashboard */}
      <div className="mt-8 mb-6">
        <button
          onClick={() => navigateTo("dashboard")}
          className="w-full py-3 rounded-full bg-gray-100 text-sm font-bold text-govuk-dark-grey hover:bg-gray-200 transition-colors touch-feedback"
        >
          Return to dashboard
        </button>
      </div>
    </div>
  );
}
