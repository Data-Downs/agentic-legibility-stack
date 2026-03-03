"use client";

import { useState, useEffect } from "react";
import { useAppStore, getConversations, getActivePlans } from "@/lib/store";
import { DEMO_TODAY } from "@/lib/types";
import type { ServiceType, PersonaData, LifeEventInfo, LifeEventService, ActivePlan } from "@/lib/types";

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

function maskNI(ni: string): string {
  if (!ni || ni.length < 4) return ni;
  return "****" + ni.slice(-4);
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const diff = target.getTime() - DEMO_TODAY.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getUpcomingDates(data: PersonaData): Array<{ label: string; date: string; days: number; urgent: boolean }> {
  const dates: Array<{ label: string; date: string; days: number; urgent: boolean }> = [];

  // Vehicle dates
  if (data.vehicles) {
    for (const v of data.vehicles) {
      if (v.motExpiry) {
        const days = daysUntil(v.motExpiry);
        if (days > -30 && days < 180) {
          dates.push({ label: `MOT — ${v.make} ${v.model}`, date: v.motExpiry, days, urgent: days < 30 });
        }
      }
      if (v.taxExpiry) {
        const days = daysUntil(v.taxExpiry);
        if (days > -30 && days < 180) {
          dates.push({ label: `Road tax — ${v.make} ${v.model}`, date: v.taxExpiry, days, urgent: days < 30 });
        }
      }
      if (v.insuranceExpiry) {
        const days = daysUntil(v.insuranceExpiry);
        if (days > -30 && days < 180) {
          dates.push({ label: `Insurance — ${v.make} ${v.model}`, date: v.insuranceExpiry, days, urgent: days < 30 });
        }
      }
    }
  }

  // Pregnancy due date
  if (data.pregnancy?.dueDate) {
    const days = daysUntil(data.pregnancy.dueDate);
    if (days > 0) {
      dates.push({ label: "Baby due date", date: data.pregnancy.dueDate, days, urgent: days < 60 });
    }
  }

  dates.sort((a, b) => a.days - b.days);
  return dates.slice(0, 4);
}


function getServiceDetail(service: string, data: PersonaData): string {
  if (service === "driving") {
    const vehicles = data.vehicles;
    if (!vehicles || vehicles.length === 0) return "No vehicles registered";
    const v = vehicles[0];
    const motDays = v.motExpiry ? daysUntil(v.motExpiry) : null;
    if (motDays !== null && motDays < 0) return `MOT expired — ${v.make} ${v.model}`;
    if (motDays !== null && motDays < 30) return `MOT expires in ${motDays} days — ${v.make} ${v.model}`;
    return `${v.make} ${v.model} (${v.registrationNumber})`;
  }
  if (service === "benefits") {
    const benefits = data.benefits;
    const current = benefits?.currentlyReceiving;
    const financials = data.financials as Record<string, unknown> | undefined;
    if (financials?.statePension) {
      const sp = financials.statePension as Record<string, unknown>;
      return `State Pension: ${sp.weeklyAmount ? `£${sp.weeklyAmount}/wk` : "Active"}`;
    }
    if (current && current.length > 0) {
      return current.map((b) => b.type).join(", ");
    }
    return "Check what you may be entitled to";
  }
  if (service === "family") {
    if (data.pregnancy) return `Baby due ${formatDate(data.pregnancy.dueDate)}`;
    if (data.children && data.children.length > 0) {
      return data.children.map((c) => c.firstName).join(" & ");
    }
    const familyInfo = data.family as Record<string, unknown> | undefined;
    if (familyInfo?.notes) return familyInfo.notes as string;
    return "Family support and information";
  }
  return "";
}

export function Dashboard() {
  const personaData = useAppStore((s) => s.personaData);
  const persona = useAppStore((s) => s.persona);
  const navigateTo = useAppStore((s) => s.navigateTo);
  const startNewConversation = useAppStore((s) => s.startNewConversation);
  const startPlan = useAppStore((s) => s.startPlan);
  const loadPlan = useAppStore((s) => s.loadPlan);
  const [lifeEvents, setLifeEvents] = useState<LifeEventInfo[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([]);

  useEffect(() => {
    fetch("/api/life-events")
      .then((r) => r.json())
      .then((resp) => {
        if (resp.lifeEvents) {
          setLifeEvents(resp.lifeEvents);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (persona) {
      setActivePlans(getActivePlans(persona));
    }
  }, [persona]);

  if (!personaData) return null;

  // Support both nested (old persona) and flat (test-user) data formats
  const raw = personaData as unknown as Record<string, unknown>;
  const firstName = personaData.primaryContact?.firstName || (raw.name as string)?.split(" ")[0] || "there";
  const lastName = personaData.primaryContact?.lastName || (raw.name as string)?.split(" ").slice(1).join(" ") || "";
  const niNumber = personaData.primaryContact?.nationalInsuranceNumber || (raw.national_insurance_number as string) || "";
  const dob = personaData.primaryContact?.dateOfBirth || (raw.date_of_birth as string) || "";
  const QUICK_ACCESS: Array<{ key: ServiceType; label: string }> = [
    { key: "driving", label: "Driving" },
    { key: "benefits", label: "Benefits & money" },
    { key: "family", label: "Family" },
  ];
  const upcomingDates = getUpcomingDates(personaData);
  const recentConversations = persona ? getConversations(persona).slice(0, 3) : [];

  function handleStartGraphService(svc: LifeEventService) {
    startNewConversation(svc.id as ServiceType, svc.name);
    navigateTo("chat", svc.id as ServiceType, svc.name);
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Hello, {firstName}</h2>
        <p className="text-govuk-dark-grey">
          Your government services at a glance
        </p>
      </div>

      {/* Your details card */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
        <h3 className="text-base text-govuk-black font-extrabold mb-3">Your details</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-govuk-dark-grey">Name</span>
            <p className="font-medium">{firstName} {lastName}</p>
          </div>
          <div>
            <span className="text-govuk-dark-grey">NI Number</span>
            <p className="font-medium font-mono">{maskNI(niNumber)}</p>
          </div>
          <div>
            <span className="text-govuk-dark-grey">Address</span>
            <p className="font-medium">{personaData.address?.city}, {personaData.address?.postcode}</p>
          </div>
          <div>
            <span className="text-govuk-dark-grey">DOB</span>
            <p className="font-medium">{dob ? formatDate(dob) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Upcoming dates */}
      {upcomingDates.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <h3 className="text-base text-govuk-black font-extrabold mb-3">Upcoming dates</h3>
          <div className="flex flex-col gap-2">
            {upcomingDates.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{item.label}</span>
                <span className={`text-xs font-bold ${item.urgent ? "text-red-600" : item.days < 0 ? "text-red-600" : "text-govuk-dark-grey"}`}>
                  {item.days < 0
                    ? `Expired ${Math.abs(item.days)} days ago`
                    : item.days === 0
                      ? "Today"
                      : `${item.days} days — ${formatDate(item.date)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick-access service cards (backward compatible) */}
      <h3 className="text-base text-govuk-black font-extrabold mb-3">Services</h3>
      <div className="bg-white rounded-2xl shadow-sm mb-6 divide-y divide-gray-100">
        {QUICK_ACCESS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              startNewConversation(key, label);
              navigateTo("chat", key, label);
            }}
            className="flex items-center gap-4 w-full p-4 hover:bg-gray-50 transition-all text-left first:rounded-t-2xl last:rounded-b-2xl"
          >
            <div className="w-10 h-10 rounded-lg bg-govuk-light-grey flex items-center justify-center text-govuk-dark-grey shrink-0">
              {serviceIcons[key]}
            </div>
            <div className="flex-1 min-w-0">
              <strong className="block text-govuk-black">
                {label}
              </strong>
              <span className="text-sm text-govuk-dark-grey">
                {getServiceDetail(key, personaData)}
              </span>
            </div>
            <svg
              className="shrink-0 text-govuk-blue"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

      {/* Active plans */}
      {activePlans.length > 0 && (
        <div className="mb-6">
          <h3 className="text-base text-govuk-black font-extrabold mb-3">Your plans</h3>
          <div className="flex flex-col gap-2">
            {activePlans.map((ap) => {
              const total = Object.keys(ap.serviceProgress).length;
              const done = Object.values(ap.serviceProgress).filter(
                (s) => s === "completed" || s === "skipped"
              ).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <button
                  key={ap.id}
                  onClick={() => {
                    loadPlan(ap.id);
                    navigateTo("plan");
                  }}
                  className="w-full text-left p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{ap.lifeEventIcon}</span>
                    <div className="flex-1 min-w-0">
                      <strong className="block text-sm text-govuk-black">{ap.lifeEventName}</strong>
                      <span className="text-xs text-govuk-dark-grey">
                        {done} of {total} services &middot; {pct}%
                      </span>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 shrink-0">
                      Continue
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-govuk-green rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Life events discovery */}
      {lifeEvents.length > 0 && (
        <div className="mb-6">
          <h3 className="text-base text-govuk-black font-extrabold mb-3">Life events</h3>
          <div className="grid grid-cols-2 gap-2">
            {lifeEvents.map((le) => (
              <div key={le.id}>
                <button
                  onClick={() => setExpandedEvent(expandedEvent === le.id ? null : le.id)}
                  className={`w-full text-left p-3 rounded-2xl transition-all ${
                    expandedEvent === le.id
                      ? "bg-blue-50 shadow-md ring-2 ring-govuk-blue"
                      : "bg-white shadow-sm hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">{le.icon}</span>
                    <div className="min-w-0">
                      <strong className="block text-sm text-govuk-black leading-tight">{le.name}</strong>
                      <span className="text-xs text-govuk-dark-grey">
                        {le.totalServiceCount} service{le.totalServiceCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>

          {/* Expanded life event detail */}
          {expandedEvent && (() => {
            const le = lifeEvents.find((e) => e.id === expandedEvent);
            if (!le) return null;
            const plan = le.plan;
            const svcLookup = new Map(le.services.map((s) => [s.id, s]));
            return (
              <div className="mt-3 bg-white rounded-2xl shadow-sm p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-govuk-black">{le.icon} {le.name}</h4>
                    <p className="text-sm text-govuk-dark-grey">{le.desc}</p>
                  </div>
                  <button
                    onClick={() => setExpandedEvent(null)}
                    className="text-govuk-dark-grey hover:text-govuk-black"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {plan && plan.groups.length > 0 ? (
                  <>
                    {/* Start / Continue plan button */}
                    {(() => {
                      const existingPlan = activePlans.find((p) => p.lifeEventId === le.id);
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (existingPlan) {
                              loadPlan(existingPlan.id);
                              navigateTo("plan");
                            } else {
                              startPlan(le);
                            }
                          }}
                          className="w-full mb-4 py-3 rounded-full font-bold text-sm text-white bg-govuk-blue hover:bg-blue-800 transition-colors"
                        >
                          {existingPlan ? "Continue this plan" : "Start this plan"}
                        </button>
                      );
                    })()}

                    {/* Plan summary */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <p className="text-xs font-bold text-govuk-dark-grey uppercase tracking-wide mb-2">Your plan</p>
                      <ol className="list-decimal list-inside text-sm text-govuk-black space-y-0.5">
                        {plan.groups.map((g, i) => (
                          <li key={i} className="text-govuk-dark-grey">
                            <span className="text-govuk-black font-medium">{g.label}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Grouped services */}
                    <div className="flex flex-col">
                      {plan.groups.map((group, gi) => (
                        <div key={gi}>
                          {/* Connector arrow between groups */}
                          {gi > 0 && (
                            <div className="flex justify-center py-1">
                              <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="text-govuk-mid-grey">
                                <path d="M8 0v16M4 12l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}

                          {/* Group label */}
                          <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${
                            group.depth === 0 ? "text-green-700" : "text-govuk-dark-grey"
                          }`}>
                            {group.label}
                          </p>

                          {/* Service buttons */}
                          <div className="flex flex-col gap-2">
                            {group.serviceIds.map((svcId) => {
                              const svc = svcLookup.get(svcId);
                              if (!svc) return null;
                              const isEntry = group.depth === 0;
                              return (
                                <button
                                  key={svc.id}
                                  onClick={() => handleStartGraphService(svc)}
                                  className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm ${
                                    isEntry
                                      ? "border-green-300 bg-green-50 hover:border-green-500"
                                      : "border-govuk-mid-grey bg-white hover:border-govuk-blue"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                      <strong className="block text-sm text-govuk-black">{svc.name}</strong>
                                      <span className="text-xs text-govuk-dark-grey">{svc.dept}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ml-2 shrink-0 ${
                                      svc.serviceType === "benefit" ? "bg-green-100 text-green-800" :
                                      svc.serviceType === "obligation" ? "bg-amber-100 text-amber-800" :
                                      svc.serviceType === "grant" ? "bg-purple-100 text-purple-800" :
                                      svc.serviceType === "legal_process" ? "bg-red-100 text-red-800" :
                                      "bg-blue-100 text-blue-800"
                                    }`}>
                                      {svc.serviceType}
                                    </span>
                                  </div>
                                  <p className="text-xs text-govuk-dark-grey mt-1 line-clamp-2">{svc.desc}</p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  /* Fallback: flat list (backward compat) */
                  <div className="flex flex-col gap-2">
                    {le.services.map((svc) => (
                      <button
                        key={svc.id}
                        onClick={() => handleStartGraphService(svc)}
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
                            svc.serviceType === "grant" ? "bg-purple-100 text-purple-800" :
                            "bg-blue-100 text-blue-800"
                          }`}>
                            {svc.serviceType}
                          </span>
                        </div>
                        <p className="text-xs text-govuk-dark-grey mt-1 line-clamp-2">{svc.desc}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Recent conversations */}
      {recentConversations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-base text-govuk-black font-extrabold mb-3">Recent conversations</h3>
          <div className="flex flex-col gap-2">
            {recentConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  useAppStore.getState().loadConversation(conv.id);
                  navigateTo("chat", conv.service as ServiceType);
                }}
                className="flex items-center gap-3 w-full p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all text-left"
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

      {/* Quick start */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="font-bold text-sm mb-2">Quick start</h3>
        <p className="text-sm text-govuk-dark-grey mb-3">
          Tap a service card above to start chatting about that topic, or explore
          life events to discover relevant government services.
        </p>
      </div>
    </div>
  );
}
