"use client";

import { useState, useEffect } from "react";
import { useAppStore, getConversations, getActivePlans } from "@/lib/store";
import type { ServiceType, LifeEventInfo, ActivePlan } from "@/lib/types";
import { UnifiedTimeline } from "./dashboard/UnifiedTimeline";
import { NearYouSection } from "./dashboard/NearYouSection";

const serviceIcons: Record<string, React.ReactNode> = {
  driving: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  benefits: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  family: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

function getServiceDetail(service: string, data: import("@/lib/types").PersonaData): string {
  if (service === "driving") {
    const vehicles = data.vehicles;
    if (!vehicles || vehicles.length === 0) return "No vehicles registered";
    const v = vehicles[0];
    return `${v.make} ${v.model} (${v.registrationNumber})`;
  }
  if (service === "benefits") {
    const financials = data.financials as Record<string, unknown> | undefined;
    if (financials?.statePension) {
      const sp = financials.statePension as Record<string, unknown>;
      return `State Pension: ${sp.weeklyAmount ? `£${sp.weeklyAmount}/wk` : "Active"}`;
    }
    const current = data.benefits?.currentlyReceiving;
    if (current && current.length > 0) {
      return current.map((b) => b.type).join(", ");
    }
    return "Check what you may be entitled to";
  }
  if (service === "family") {
    if (data.pregnancy) {
      return `Baby due ${new Date(data.pregnancy.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    }
    if (data.children && data.children.length > 0) {
      return data.children.map((c) => c.firstName).join(" & ");
    }
    return "Family support and information";
  }
  return "";
}

const QUICK_ACCESS: Array<{ key: ServiceType; label: string }> = [
  { key: "driving", label: "Driving" },
  { key: "benefits", label: "Benefits & money" },
  { key: "family", label: "Family" },
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

      {/* Service cards → detail view */}
      <h3 className="text-base font-extrabold text-govuk-black mb-3">Services</h3>
      <div className="bg-white rounded-card shadow-sm mb-5 divide-y divide-gray-100">
        {QUICK_ACCESS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              navigateTo("detail", key, label);
            }}
            className="flex items-center gap-4 w-full p-4 hover:bg-gray-50 transition-all text-left touch-feedback first:rounded-t-card last:rounded-b-card"
          >
            <div className="w-10 h-10 rounded-lg bg-govuk-light-grey flex items-center justify-center text-govuk-dark-grey shrink-0">
              {serviceIcons[key]}
            </div>
            <div className="flex-1 min-w-0">
              <strong className="block text-govuk-black">{label}</strong>
              <span className="text-sm text-govuk-dark-grey">
                {getServiceDetail(key, personaData)}
              </span>
            </div>
            <svg className="shrink-0 text-govuk-blue" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

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
