"use client";

import { useState, useEffect } from "react";
import { useAppStore, getConversations } from "@/lib/store";
import { SERVICE_TITLES, DEMO_TODAY, getServiceTitle } from "@/lib/types";
import type { ServiceType, PersonaData, LifeEventInfo, LifeEventService } from "@/lib/types";

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

function getCredentials(data: PersonaData): Array<{ type: string; status: string; valid: boolean }> {
  const creds: Array<{ type: string; status: string; valid: boolean }> = [];

  if (data.primaryContact.nationalInsuranceNumber) {
    creds.push({ type: "National Insurance", status: "Verified", valid: true });
  }

  if (data.vehicles && data.vehicles.length > 0) {
    // Check if any vehicle has a future MOT (proxy for having a licence)
    const hasValidVehicle = data.vehicles.some((v) => v.motExpiry && daysUntil(v.motExpiry) > 0);
    creds.push({
      type: "Driving Licence",
      status: hasValidVehicle ? "Valid" : "Needs renewal",
      valid: hasValidVehicle,
    });
  }

  creds.push({ type: "Proof of Address", status: data.address.postcode, valid: true });

  return creds;
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
  const [lifeEvents, setLifeEvents] = useState<LifeEventInfo[]>([]);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

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

  if (!personaData) return null;

  const firstName = personaData.primaryContact.firstName;
  const services: ServiceType[] = ["driving", "benefits", "family"];
  const upcomingDates = getUpcomingDates(personaData);
  const credentials = getCredentials(personaData);
  const recentConversations = persona ? getConversations(persona).slice(0, 3) : [];

  function handleStartGraphService(svc: LifeEventService) {
    startNewConversation(svc.id as ServiceType);
    navigateTo("chat", svc.id as ServiceType);
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
      <div className="bg-white border border-govuk-mid-grey rounded-xl p-4 mb-4">
        <h3 className="font-bold text-sm text-govuk-dark-grey uppercase tracking-wide mb-3">Your details</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-govuk-dark-grey">Name</span>
            <p className="font-medium">{personaData.primaryContact.firstName} {personaData.primaryContact.lastName}</p>
          </div>
          <div>
            <span className="text-govuk-dark-grey">NI Number</span>
            <p className="font-medium font-mono">{maskNI(personaData.primaryContact.nationalInsuranceNumber || "")}</p>
          </div>
          <div>
            <span className="text-govuk-dark-grey">Address</span>
            <p className="font-medium">{personaData.address.city}, {personaData.address.postcode}</p>
          </div>
          <div>
            <span className="text-govuk-dark-grey">DOB</span>
            <p className="font-medium">{formatDate(personaData.primaryContact.dateOfBirth)}</p>
          </div>
        </div>
      </div>

      {/* Credentials */}
      <div className="bg-white border border-govuk-mid-grey rounded-xl p-4 mb-4">
        <h3 className="font-bold text-sm text-govuk-dark-grey uppercase tracking-wide mb-3">Digital credentials</h3>
        <div className="flex flex-col gap-2">
          {credentials.map((cred) => (
            <div key={cred.type} className="flex items-center justify-between text-sm">
              <span>{cred.type}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cred.valid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {cred.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming dates */}
      {upcomingDates.length > 0 && (
        <div className="bg-white border border-govuk-mid-grey rounded-xl p-4 mb-4">
          <h3 className="font-bold text-sm text-govuk-dark-grey uppercase tracking-wide mb-3">Upcoming dates</h3>
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
      <h3 className="font-bold text-sm text-govuk-dark-grey uppercase tracking-wide mb-3">Services</h3>
      <div className="flex flex-col gap-3 mb-6">
        {services.map((service) => (
          <button
            key={service}
            onClick={() => {
              startNewConversation(service);
              navigateTo("chat", service);
            }}
            className="flex items-center gap-4 w-full p-4 bg-white border border-govuk-mid-grey rounded-xl hover:border-govuk-blue hover:shadow-sm transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-govuk-light-grey flex items-center justify-center text-govuk-dark-grey shrink-0">
              {serviceIcons[service]}
            </div>
            <div className="flex-1 min-w-0">
              <strong className="block text-govuk-black">
                {SERVICE_TITLES[service]}
              </strong>
              <span className="text-sm text-govuk-dark-grey">
                {getServiceDetail(service, personaData)}
              </span>
            </div>
            <svg
              className="shrink-0 text-govuk-mid-grey"
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

      {/* Life events discovery */}
      {lifeEvents.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-sm text-govuk-dark-grey uppercase tracking-wide mb-3">Life events</h3>
          <div className="grid grid-cols-2 gap-2">
            {lifeEvents.map((le) => (
              <div key={le.id}>
                <button
                  onClick={() => setExpandedEvent(expandedEvent === le.id ? null : le.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    expandedEvent === le.id
                      ? "border-govuk-blue bg-blue-50 shadow-sm"
                      : "border-govuk-mid-grey bg-white hover:border-govuk-blue hover:shadow-sm"
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
            return (
              <div className="mt-3 bg-white border border-govuk-blue rounded-xl p-4">
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
                <div className="flex flex-col gap-2">
                  {le.services
                    .filter((s) => !s.gated)
                    .map((svc) => (
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
                  {le.services.filter((s) => s.gated).length > 0 && (
                    <p className="text-xs text-govuk-dark-grey mt-1">
                      + {le.services.filter((s) => s.gated).length} more service{le.services.filter((s) => s.gated).length !== 1 ? "s" : ""} unlocked after prerequisites
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Recent conversations */}
      {recentConversations.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-sm text-govuk-dark-grey uppercase tracking-wide mb-3">Recent conversations</h3>
          <div className="flex flex-col gap-2">
            {recentConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  useAppStore.getState().loadConversation(conv.id);
                  navigateTo("chat", conv.service as ServiceType);
                }}
                className="flex items-center gap-3 w-full p-3 bg-white border border-govuk-mid-grey rounded-lg hover:border-govuk-blue transition-colors text-left"
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
      <div className="bg-govuk-light-grey rounded-xl p-4">
        <h3 className="font-bold text-sm mb-2">Quick start</h3>
        <p className="text-sm text-govuk-dark-grey mb-3">
          Tap a service card above to start chatting about that topic, or explore
          life events to discover relevant government services.
        </p>
      </div>
    </div>
  );
}
