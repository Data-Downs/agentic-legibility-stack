"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { PERSONA_NAMES, PERSONA_COLORS, PERSONA_INITIALS } from "@/lib/types";
import { VerifiedSection } from "./VerifiedSection";
import { SubmittedSection } from "./SubmittedSection";
import { InferredSection } from "./InferredSection";
import { AccessControlSection } from "./AccessControlSection";

interface PersonalData {
  userId: string;
  tier1: Record<string, unknown>;
  tier2: { fields: Array<Record<string, unknown>> };
  tier3: { facts: Array<Record<string, unknown>> };
  accessMap: Record<string, Array<Record<string, unknown>>>;
}

export function PersonalDataDashboard() {
  const persona = useAppStore((s) => s.persona);
  const setOpen = useAppStore((s) => s.setSettingsPaneOpen);
  const [data, setData] = useState<PersonalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"data" | "access">("data");

  const fetchData = useCallback(async () => {
    if (!persona) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/personal-data/${persona}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error("Failed to load personal data:", error);
    } finally {
      setLoading(false);
    }
  }, [persona]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!persona) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => setOpen(false)}
      />

      {/* Slide-in panel */}
      <div className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-govuk-mid-grey z-10">
          <div className="flex items-center gap-3 p-4">
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: PERSONA_COLORS[persona] }}
            >
              {PERSONA_INITIALS[persona]}
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-base">{PERSONA_NAMES[persona]}</h2>
              <p className="text-xs text-govuk-dark-grey">Personal data dashboard</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 text-govuk-dark-grey hover:text-govuk-black"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-gray-100">
            <button
              onClick={() => setActiveTab("data")}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 ${
                activeTab === "data"
                  ? "border-govuk-blue text-govuk-blue"
                  : "border-transparent text-govuk-dark-grey"
              }`}
            >
              Your data
            </button>
            <button
              onClick={() => setActiveTab("access")}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 ${
                activeTab === "access"
                  ? "border-govuk-blue text-govuk-blue"
                  : "border-transparent text-govuk-dark-grey"
              }`}
            >
              Access control
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-govuk-blue border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !data ? (
            <p className="text-sm text-govuk-dark-grey text-center py-8">
              Failed to load personal data.
            </p>
          ) : activeTab === "data" ? (
            <div className="space-y-6">
              {/* Tier 1: Verified */}
              <VerifiedSection
                data={data.tier1 as unknown as Parameters<typeof VerifiedSection>[0]["data"]}
              />

              <div className="border-t border-govuk-mid-grey" />

              {/* Tier 2: Submitted */}
              <SubmittedSection
                fields={data.tier2.fields as unknown as Parameters<typeof SubmittedSection>[0]["fields"]}
                personaId={persona}
                onRefresh={fetchData}
              />

              <div className="border-t border-govuk-mid-grey" />

              {/* Tier 3: Inferred */}
              <InferredSection
                facts={data.tier3.facts as unknown as Parameters<typeof InferredSection>[0]["facts"]}
                personaId={persona}
                onRefresh={fetchData}
              />
            </div>
          ) : (
            <AccessControlSection
              accessMap={data.accessMap as unknown as Parameters<typeof AccessControlSection>[0]["accessMap"]}
              personaId={persona}
              onRefresh={fetchData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
