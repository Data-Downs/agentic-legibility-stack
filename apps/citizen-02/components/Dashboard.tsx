"use client";

import { useState, useEffect } from "react";
import { useAppStore, getConversations, getActivePlans } from "@/lib/store";
import type { ServiceType, LifeEventInfo, ActivePlan } from "@/lib/types";
import { UnifiedTimeline } from "./dashboard/UnifiedTimeline";
import { NearYouSection } from "./dashboard/NearYouSection";

/** Blue-circle icon set — white strokes on filled blue circles matching GOV.UK style */
function ServiceIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-14 h-14 rounded-full bg-govuk-blue flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

const serviceIcons: Record<string, React.ReactNode> = {
  driving: (
    <ServiceIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17h14M7 11l1.5-4h7L17 11" />
        <rect x="3" y="11" width="18" height="6" rx="2" />
        <circle cx="7" cy="17" r="1.5" fill="white" />
        <circle cx="17" cy="17" r="1.5" fill="white" />
      </svg>
    </ServiceIcon>
  ),
  benefits: (
    <ServiceIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" />
        <text x="12" y="16" textAnchor="middle" fill="white" stroke="none" fontSize="12" fontWeight="bold" fontFamily="Arial">£</text>
      </svg>
    </ServiceIcon>
  ),
  money: (
    <ServiceIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" />
        <path d="M15 9.5L10.5 14.5" />
        <path d="M9 12l2 2" />
        <line x1="9" y1="9" x2="15" y2="9" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    </ServiceIcon>
  ),
  health: (
    <ServiceIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H13V8H17V10H13V14H11V10H7V8H11V4Z" fill="white" stroke="none" />
        <rect x="4" y="3" width="16" height="12" rx="2" />
        <path d="M8 19h8M10 15v4M14 15v4" />
      </svg>
    </ServiceIcon>
  ),
  "work-pension": (
    <ServiceIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M8 7V5a4 4 0 0 1 8 0v2" />
        <line x1="12" y1="11" x2="12" y2="15" />
        <circle cx="12" cy="11" r="1" fill="white" stroke="none" />
      </svg>
    </ServiceIcon>
  ),
  "home-family": (
    <ServiceIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L12 4l9 6.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10.5z" />
        <path d="M9 21v-6h6v6" />
      </svg>
    </ServiceIcon>
  ),
  "travel-identity": (
    <ServiceIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <circle cx="12" cy="10" r="3" />
        <path d="M7 18c0-2.2 2.2-4 5-4s5 1.8 5 4" />
      </svg>
    </ServiceIcon>
  ),
};

function getServiceDetail(service: string, data: import("@/lib/types").PersonaData): string {
  const raw = data as unknown as Record<string, unknown>;
  if (service === "driving") {
    const vehicles = data.vehicles;
    if (!vehicles || vehicles.length === 0) return "No vehicles registered";
    return `${vehicles.length} vehicle${vehicles.length > 1 ? "s" : ""}`;
  }
  if (service === "benefits") {
    const current = data.benefits?.currentlyReceiving;
    if (current && current.length > 0) return current.map((b) => b.type).join(", ");
    return "Childcare, housing, disability";
  }
  if (service === "money") {
    const fin = data.financials as Record<string, unknown> | undefined;
    if (fin?.statePension) return "State Pension, tax";
    return "Personal tax";
  }
  if (service === "health") {
    const hi = data.healthInfo as Record<string, unknown> | undefined;
    const conditions = hi?.conditions as string[] | undefined;
    if (conditions && conditions.length > 0) return conditions.slice(0, 2).join(", ");
    return "NHS, prescriptions, GP";
  }
  if (service === "work-pension") {
    const emp = data.employment as Record<string, unknown> | undefined;
    const status = emp?.status ?? emp?.employment_status ?? (raw.employment_status as string);
    if (status === "self-employed" || status === "Self-Employed") return "Self-employed";
    if (status === "retired" || status === "Retired") return "Retired, state pension";
    return "Employment, state pension";
  }
  if (service === "home-family") {
    if (data.pregnancy) {
      return `Baby due ${new Date(data.pregnancy.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    }
    if (data.children && data.children.length > 0) {
      return data.children.map((c) => c.firstName).join(" & ");
    }
    return "Housing, childcare, family";
  }
  if (service === "travel-identity") {
    return "Passport, visa, travel";
  }
  return "";
}

/** Determine whether a service category is relevant based on persona data */
function isServiceRelevant(service: string, data: import("@/lib/types").PersonaData): boolean {
  const raw = data as unknown as Record<string, unknown>;
  switch (service) {
    case "driving":
      return !!(data.vehicles && data.vehicles.length > 0);
    case "benefits":
      return !!(
        (data.benefits?.currentlyReceiving && data.benefits.currentlyReceiving.length > 0) ||
        (data.benefits?.potentiallyEligibleFor && data.benefits.potentiallyEligibleFor.length > 0) ||
        data.pregnancy ||
        (data.children && data.children.length > 0) ||
        raw.over_70
      );
    case "money":
      return !!(
        data.financials ||
        raw.income ||
        raw.savings
      );
    case "health":
      return !!(
        data.healthInfo ||
        data.pregnancy ||
        raw.over_70
      );
    case "work-pension":
      return !!(
        data.employment ||
        raw.employment_status ||
        (data.financials as Record<string, unknown> | undefined)?.statePension
      );
    case "home-family":
      return !!(
        data.pregnancy ||
        (data.children && data.children.length > 0) ||
        data.partner ||
        raw.powerOfAttorney ||
        data.family
      );
    case "travel-identity":
      // Show if they have credential data indicating passport/visa
      return !!(raw.credentials || raw.visa || raw.immigration);
    default:
      return false;
  }
}

/** Category → life events mapping */
export const SERVICE_LIFE_EVENTS: Record<string, string[]> = {
  driving: ["Moving House", "Learning to Drive", "Starting a New Job"],
  benefits: ["Having a Baby", "Death of Someone Close", "Losing Your Job", "Disability or Health Condition", "Becoming a Carer", "Separating or Divorcing", "Arriving in the UK"],
  money: ["Death of Someone Close", "Getting Married", "Retiring", "Starting a Business", "Buying a Home", "Moving House", "Losing Your Job", "Separating or Divorcing", "Going to University", "Starting a New Job"],
  health: ["Having a Baby", "Retiring", "Disability or Health Condition", "Becoming a Carer"],
  "work-pension": ["Retiring", "Starting a Business", "Losing Your Job", "Disability or Health Condition", "Becoming a Carer", "Arriving in the UK", "Going to University", "Starting a New Job"],
  "home-family": ["Having a Baby", "Death of Someone Close", "Getting Married", "Buying a Home", "Moving House", "Separating or Divorcing", "Child Starting School"],
  "travel-identity": ["Arriving in the UK"],
};

const QUICK_ACCESS: Array<{ key: ServiceType; label: string }> = [
  { key: "driving", label: "Driving" },
  { key: "benefits", label: "Benefits" },
  { key: "money", label: "Money" },
  { key: "health", label: "Health" },
  { key: "work-pension", label: "Work & Pension" },
  { key: "home-family", label: "Home & Family" },
  { key: "travel-identity", label: "Travel & Identity" },
];

export function Dashboard() {
  const personaData = useAppStore((s) => s.personaData);
  const persona = useAppStore((s) => s.persona);
  const enrichedData = useAppStore((s) => s.enrichedData);
  const navigateTo = useAppStore((s) => s.navigateTo);
  const startNewConversation = useAppStore((s) => s.startNewConversation);
  const startPlan = useAppStore((s) => s.startPlan);
  const loadPlan = useAppStore((s) => s.loadPlan);
  const openBottomSheet = useAppStore((s) => s.openBottomSheet);
  const [lifeEvents, setLifeEvents] = useState<LifeEventInfo[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([]);
  const [showBrowseTopics, setShowBrowseTopics] = useState(false);

  // Manually added topics (persisted per persona in localStorage)
  const [addedTopics, setAddedTopics] = useState<Set<string>>(() => {
    if (typeof window === "undefined" || !persona) return new Set();
    try {
      const stored = localStorage.getItem(`c02_topics_${persona}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  // Persist added topics
  const toggleTopic = (key: string) => {
    setAddedTopics(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (persona) localStorage.setItem(`c02_topics_${persona}`, JSON.stringify([...next]));
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/life-events")
      .then((r) => r.json())
      .then((resp) => {
        if (resp.lifeEvents) setLifeEvents(resp.lifeEvents);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (persona) setActivePlans(getActivePlans(persona));
  }, [persona]);

  if (!personaData) return null;

  const raw = personaData as unknown as Record<string, unknown>;
  const firstName = personaData.primaryContact?.firstName || (raw.name as string)?.split(" ")[0] || "there";
  const recentConversations = persona ? getConversations(persona).slice(0, 3) : [];

  return (
    <div className="max-w-lg mx-auto">
      {/* Greeting */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold">Hello, {firstName}</h2>
        <p className="text-govuk-dark-grey text-sm">Your government services at a glance</p>
      </div>

      {/* Unified Timeline */}
      <UnifiedTimeline
        personaData={personaData}
        persona={persona}
        onItemTap={(item) => openBottomSheet("task-detail", item)}
        onSeeAll={() => navigateTo("tasks")}
      />

      {/* Topic cards → detail view */}
      <h3 className="text-base font-extrabold text-govuk-black mb-3">Topics</h3>
      {(() => {
        const visibleTopics = QUICK_ACCESS.filter(
          ({ key }) => isServiceRelevant(key, personaData) || addedTopics.has(key)
        );
        const hiddenTopics = QUICK_ACCESS.filter(
          ({ key }) => !isServiceRelevant(key, personaData) && !addedTopics.has(key)
        );
        return (
          <>
            <div className="bg-white rounded-2xl shadow-sm mb-5 divide-y divide-gray-100">
              {visibleTopics.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => navigateTo("detail", key, label)}
                  className="flex items-center gap-4 w-full px-5 py-5 hover:bg-gray-50 transition-all text-left touch-feedback first:rounded-t-2xl last:rounded-b-2xl"
                >
                  {serviceIcons[key]}
                  <div className="flex-1 min-w-0">
                    <strong className="block text-lg font-bold text-govuk-black">{label}</strong>
                    <span className="text-sm text-govuk-dark-grey">
                      {getServiceDetail(key, personaData)}
                    </span>
                  </div>
                  <svg className="shrink-0 text-govuk-blue" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Browse topics button */}
            <div className="mb-5">
              <button
                onClick={() => setShowBrowseTopics(true)}
                className="w-full py-4 bg-white rounded-2xl shadow-sm text-govuk-blue font-bold text-base hover:bg-gray-50 transition-colors touch-feedback"
              >
                Browse topics
              </button>
            </div>

            {/* Browse topics overlay */}
            {showBrowseTopics && (
              <div className="fixed inset-0 z-50 flex flex-col bg-govuk-page-bg">
                <div className="bg-govuk-blue px-4 pt-3 pb-4" style={{ paddingTop: "var(--safe-area-top)" }}>
                  <div className="max-w-[960px] mx-auto">
                    <button
                      onClick={() => setShowBrowseTopics(false)}
                      className="text-white text-sm font-medium flex items-center gap-1 hover:underline touch-feedback mb-2"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                      Back
                    </button>
                    <h1 className="text-white font-bold text-2xl">Browse topics</h1>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-6">
                  <div className="max-w-lg mx-auto">
                    <p className="text-sm text-govuk-dark-grey mb-4">Add topics to your homepage. Topics with your data are shown automatically.</p>
                    <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
                      {QUICK_ACCESS.map(({ key, label }) => {
                        const autoRelevant = isServiceRelevant(key, personaData);
                        const manuallyAdded = addedTopics.has(key);
                        const isVisible = autoRelevant || manuallyAdded;
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-4 px-5 py-4 first:rounded-t-2xl last:rounded-b-2xl"
                          >
                            {serviceIcons[key]}
                            <div className="flex-1 min-w-0">
                              <strong className="block text-base font-bold text-govuk-black">{label}</strong>
                              <span className="text-xs text-govuk-dark-grey">
                                {autoRelevant ? "Based on your data" : SERVICE_LIFE_EVENTS[key]?.slice(0, 2).join(", ")}
                              </span>
                            </div>
                            {autoRelevant ? (
                              <span className="text-xs font-medium text-govuk-dark-grey bg-gray-100 px-2.5 py-1 rounded-full shrink-0">
                                Auto
                              </span>
                            ) : (
                              <button
                                onClick={() => toggleTopic(key)}
                                className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${
                                  isVisible ? "bg-govuk-blue" : "bg-gray-300"
                                }`}
                              >
                                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                  isVisible ? "left-[18px]" : "left-0.5"
                                }`} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {hiddenTopics.length === 0 && (
                      <p className="text-sm text-govuk-dark-grey text-center mt-4">All topics are visible on your homepage.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Active plans */}
      {activePlans.length > 0 && (
        <div className="mb-5">
          <h3 className="text-base font-extrabold text-govuk-black mb-3">Your plans</h3>
          <div className="flex flex-col gap-2">
            {activePlans.map((ap) => {
              const total = Object.keys(ap.serviceProgress).length;
              const done = Object.values(ap.serviceProgress).filter((s) => s === "completed" || s === "skipped").length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <button
                  key={ap.id}
                  onClick={() => { loadPlan(ap.id); navigateTo("plan"); }}
                  className="w-full text-left p-4 bg-white rounded-card shadow-sm hover:shadow-md transition-all touch-feedback"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{ap.lifeEventIcon}</span>
                    <div className="flex-1 min-w-0">
                      <strong className="block text-sm text-govuk-black">{ap.lifeEventName}</strong>
                      <span className="text-xs text-govuk-dark-grey">{done} of {total} services &middot; {pct}%</span>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 shrink-0">Continue</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-govuk-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Life events */}
      {lifeEvents.length > 0 && (
        <div className="mb-5">
          <h3 className="text-base font-extrabold text-govuk-black mb-3">Life events</h3>
          <div className="grid grid-cols-2 gap-2">
            {lifeEvents.map((le) => (
              <button
                key={le.id}
                onClick={() => setExpandedEvent(expandedEvent === le.id ? null : le.id)}
                className={`w-full text-left p-3 rounded-card transition-all touch-feedback ${
                  expandedEvent === le.id
                    ? "bg-blue-50 shadow-md ring-2 ring-govuk-blue"
                    : "bg-white shadow-sm hover:shadow-md"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none mt-0.5">{le.icon}</span>
                  <div className="min-w-0">
                    <strong className="block text-sm text-govuk-black leading-tight">{le.name}</strong>
                    <span className="text-xs text-govuk-dark-grey">{le.totalServiceCount} services</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Expanded life event detail */}
          {expandedEvent && (() => {
            const le = lifeEvents.find((e) => e.id === expandedEvent);
            if (!le) return null;
            const existingPlan = activePlans.find((p) => p.lifeEventId === le.id);
            return (
              <div className="mt-3 bg-white rounded-card shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-govuk-black">{le.icon} {le.name}</h4>
                    <p className="text-sm text-govuk-dark-grey">{le.desc}</p>
                  </div>
                  <button onClick={() => setExpandedEvent(null)} className="text-govuk-dark-grey hover:text-govuk-black">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                {le.plan && (
                  <button
                    onClick={() => {
                      if (existingPlan) { loadPlan(existingPlan.id); navigateTo("plan"); }
                      else { startPlan(le); }
                    }}
                    className="w-full mb-4 py-3 rounded-full font-bold text-sm text-white bg-govuk-blue hover:bg-blue-800 transition-colors"
                  >
                    {existingPlan ? "Continue this plan" : "Start this plan"}
                  </button>
                )}
                <div className="flex flex-col gap-2">
                  {le.services.slice(0, 5).map((svc) => (
                    <button
                      key={svc.id}
                      onClick={() => {
                        startNewConversation(svc.id as ServiceType, svc.name);
                        navigateTo("chat", svc.id as ServiceType, svc.name);
                      }}
                      className="w-full text-left p-3 rounded-lg border border-govuk-mid-grey hover:border-govuk-blue hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <strong className="block text-sm text-govuk-black">{svc.name}</strong>
                          <span className="text-xs text-govuk-dark-grey">{svc.dept}</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ml-2 shrink-0 ${
                          svc.serviceType === "benefit" ? "bg-green-100 text-green-800" :
                          svc.serviceType === "obligation" ? "bg-amber-100 text-amber-800" :
                          "bg-blue-100 text-blue-800"
                        }`}>{svc.serviceType}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Near You */}
      <NearYouSection
        enrichedData={enrichedData}
        postcode={personaData.address?.postcode}
      />

      {/* Recent conversations */}
      {recentConversations.length > 0 && (
        <div className="mb-5">
          <h3 className="text-base font-extrabold text-govuk-black mb-3">Recent conversations</h3>
          <div className="flex flex-col gap-2">
            {recentConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  useAppStore.getState().loadConversation(conv.id);
                  navigateTo("chat", conv.service as ServiceType);
                }}
                className="flex items-center gap-3 w-full p-3 bg-white rounded-card shadow-sm hover:shadow-md transition-all text-left touch-feedback"
              >
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{conv.title}</span>
                  <span className="text-xs text-govuk-dark-grey">
                    {new Date(conv.updatedAt).toLocaleDateString("en-GB")} — {conv.messages.length} messages
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
