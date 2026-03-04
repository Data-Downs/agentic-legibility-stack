"use client";

import { useState, useEffect } from "react";
import { useAppStore, getConversations, getActivePlans } from "@/lib/store";
import type { ServiceType, LifeEventInfo, ActivePlan } from "@/lib/types";
import { UnifiedTimeline } from "./dashboard/UnifiedTimeline";
import { NearYouSection } from "./dashboard/NearYouSection";

/** Blue-circle icon set — Material Design filled icons on blue circles */
function ServiceIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-14 h-14 rounded-full bg-govuk-blue flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

function MdIcon({ d }: { d: string }) {
  return (
    <ServiceIcon>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
        <path d={d} />
      </svg>
    </ServiceIcon>
  );
}

const serviceIcons: Record<string, React.ReactNode> = {
  benefits: <MdIcon d="M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-6v11c0 1.1-.9 2-2 2H4v-2h17V7h2z" />,
  business: <MdIcon d="M10 16v-1H3.01L3 19c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2v-4h-7v1h-4zm10-9h-4.01V5l-2-2h-4l-2 2v2H4c-1.1 0-2 .9-2 2v3c0 1.11.89 2 2 2h6v-2h4v2h6c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-6 0h-4V5h4v2z" />,
  care: <MdIcon d="M1 11h4v11H1zm15-7.75C16.65 2.49 17.66 2 18.7 2 20.55 2 22 3.45 22 5.3c0 2.27-2.91 4.9-6 7.7-3.09-2.81-6-5.44-6-7.7C10 3.45 11.45 2 13.3 2c1.04 0 2.05.49 2.7 1.25zM20 17h-7l-2.09-.73.33-.94L13 16h2.82c.65 0 1.18-.53 1.18-1.18 0-.49-.31-.93-.77-1.11L8.97 11H7v9.02L14 22l8.01-3c-.01-1.1-.9-2-2.01-2z" />,
  driving: <MdIcon d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />,
  employment: <MdIcon d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />,
  health: <MdIcon d="M10.5 13H8v-3h2.5V7.5h3V10H16v3h-2.5v2.5h-3V13zM12 2 4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />,
  money: <MdIcon d="M4 10h3v7H4zm6.5 0h3v7h-3zM2 19h20v3H2zm15-9h3v7h-3zm-5-9L2 6v2h20V6z" />,
  parenting: <MdIcon d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A2.01 2.01 0 0 0 18.06 7h-.12a2 2 0 0 0-1.9 1.37l-.86 2.58c1.08.6 1.82 1.73 1.82 3.05v8h3zm-7.5-10.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S11 9.17 11 10s.67 1.5 1.5 1.5zM5.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm2 16v-7H9V9c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v6h1.5v7h4zm6.5 0v-4h1v-4c0-.82-.68-1.5-1.5-1.5h-2c-.82 0-1.5.68-1.5 1.5v4h1v4h3z" />,
  retirement: <MdIcon d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6.5 7V23h-1V12.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5v1h-1v-.69a6.02 6.02 0 0 1-3.51-2.52c-.31.87-.49 1.78-.49 2.71 0 .23.02.46.03.69L15 16.5V23h-2v-5l-1.78-2.54L11 19l-3 4-1.6-1.2L9 18.33V13c0-1.15.18-2.29.5-3.39l-1.5.85V14H6V9.3l5.4-3.07v.01a2 2 0 0 1 1.94.03c.36.21.63.51.8.85l.79 1.67A3.987 3.987 0 0 0 18.5 11c.83 0 1.5.67 1.5 1.5z" />,
  studying: <MdIcon d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3 1 9l11 6 9-4.91V17h2V9L12 3z" />,
  travel: <MdIcon d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />,
};

function getServiceDetail(service: string, data: import("@/lib/types").PersonaData): string {
  const raw = data as unknown as Record<string, unknown>;
  switch (service) {
    case "driving": {
      const vehicles = data.vehicles;
      if (!vehicles || vehicles.length === 0) return "No vehicles registered";
      return `${vehicles.length} vehicle${vehicles.length > 1 ? "s" : ""}`;
    }
    case "benefits": {
      const current = data.benefits?.currentlyReceiving;
      if (current && current.length > 0) return current.map((b) => b.type).join(", ");
      return "Childcare, housing, disability";
    }
    case "money": {
      const fin = data.financials as Record<string, unknown> | undefined;
      if (fin?.statePension) return "State Pension, tax";
      return "Personal tax";
    }
    case "health": {
      const hi = data.healthInfo as Record<string, unknown> | undefined;
      const conditions = hi?.conditions as string[] | undefined;
      if (conditions && conditions.length > 0) return conditions.slice(0, 2).join(", ");
      return "NHS, prescriptions, GP";
    }
    case "employment": {
      const emp = data.employment as Record<string, unknown> | undefined;
      const status = emp?.status ?? emp?.employment_status ?? (raw.employment_status as string);
      if (status === "self-employed" || status === "Self-Employed") return "Self-employed";
      return "Employment rights, pay";
    }
    case "parenting": {
      if (data.pregnancy) {
        return `Baby due ${new Date(data.pregnancy.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      }
      if (data.children && data.children.length > 0) {
        return data.children.map((c) => c.firstName).join(" & ");
      }
      return "Childcare, child benefit";
    }
    case "travel":
      return "Passport, visa, travel";
    case "business": {
      const emp = data.employment as Record<string, unknown> | undefined;
      const status = emp?.status ?? emp?.employment_status ?? (raw.employment_status as string);
      if (status === "self-employed" || status === "Self-Employed") return "Self-employed, tax";
      return "Starting a business, tax";
    }
    case "care":
      return "Social care, carers, LPA";
    case "retirement": {
      const fin = data.financials as Record<string, unknown> | undefined;
      if (fin?.statePension) return "State Pension, pension credit";
      return "State Pension, retirement";
    }
    case "studying":
      return "Student finance, courses";
    default:
      return "";
  }
}

/** Determine whether a service category is relevant based on persona data */
function isServiceRelevant(service: string, data: import("@/lib/types").PersonaData): boolean {
  const raw = data as unknown as Record<string, unknown>;
  const emp = data.employment as Record<string, unknown> | undefined;
  const empStatus = emp?.status ?? emp?.employment_status ?? (raw.employment_status as string);
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
    case "employment":
      return !!(
        data.employment ||
        raw.employment_status
      );
    case "parenting":
      return !!(
        data.pregnancy ||
        (data.children && data.children.length > 0) ||
        data.partner
      );
    case "travel":
      return !!(raw.credentials || raw.visa || raw.immigration);
    case "business":
      return !!(
        empStatus === "self-employed" || empStatus === "Self-Employed" ||
        raw.business
      );
    case "care":
      return !!(
        raw.powerOfAttorney ||
        (data.family as Record<string, unknown> | undefined)?.dependents ||
        raw.carer
      );
    case "retirement": {
      const fin = data.financials as Record<string, unknown> | undefined;
      const dob = data.primaryContact?.dateOfBirth;
      const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
      return !!(
        empStatus === "retired" || empStatus === "Retired" ||
        age > 65 ||
        fin?.statePension
      );
    }
    case "studying":
      return !!(
        raw.education ||
        empStatus === "student" || empStatus === "Student"
      );
    default:
      return false;
  }
}

/** Category → life events mapping */
export const SERVICE_LIFE_EVENTS: Record<string, string[]> = {
  benefits: ["Having a Baby", "Death of Someone Close", "Losing Your Job", "Disability or Health Condition", "Becoming a Carer", "Separating or Divorcing", "Arriving in the UK"],
  business: ["Starting a Business", "Retiring"],
  care: ["Becoming a Carer", "Death of Someone Close", "Disability or Health Condition"],
  driving: ["Moving House", "Learning to Drive", "Starting a New Job"],
  employment: ["Losing Your Job", "Starting a New Job", "Arriving in the UK", "Disability or Health Condition"],
  health: ["Having a Baby", "Retiring", "Disability or Health Condition", "Becoming a Carer"],
  money: ["Death of Someone Close", "Getting Married", "Retiring", "Starting a Business", "Buying a Home", "Moving House", "Separating or Divorcing"],
  parenting: ["Having a Baby", "Getting Married", "Child Starting School", "Separating or Divorcing"],
  retirement: ["Retiring", "Death of Someone Close"],
  studying: ["Going to University", "Starting a New Job"],
  travel: ["Arriving in the UK"],
};

const QUICK_ACCESS: Array<{ key: ServiceType; label: string }> = [
  { key: "benefits", label: "Benefits" },
  { key: "business", label: "Business" },
  { key: "care", label: "Care" },
  { key: "driving", label: "Driving & Transport" },
  { key: "employment", label: "Employment" },
  { key: "health", label: "Health & Disability" },
  { key: "money", label: "Money & Tax" },
  { key: "parenting", label: "Parenting & Guardianship" },
  { key: "retirement", label: "Retirement" },
  { key: "studying", label: "Studying & Training" },
  { key: "travel", label: "Travel" },
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
      if (!stored) return new Set();
      const keys = JSON.parse(stored) as string[];
      // Migrate old keys to new keys
      const migrated = keys.map((k) => {
        if (k === "work-pension") return "employment";
        if (k === "home-family") return "parenting";
        if (k === "travel-identity") return "travel";
        return k;
      });
      const set = new Set(migrated);
      // Persist migrated keys if any changed
      if (keys.some((k) => k === "work-pension" || k === "home-family" || k === "travel-identity")) {
        localStorage.setItem(`c02_topics_${persona}`, JSON.stringify([...set]));
      }
      return set;
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
