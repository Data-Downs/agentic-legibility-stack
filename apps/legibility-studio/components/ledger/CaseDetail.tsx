"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import CaseTimelineView from "./CaseTimelineView";
import StateProgressFlow from "./StateProgressFlow";
import ReviewDialog from "./ReviewDialog";
import StatusBadge from "@/components/ui/StatusBadge";

interface LedgerCase {
  caseId: string;
  userId: string;
  serviceId: string;
  currentState: string;
  status: string;
  startedAt: string;
  lastActivityAt: string;
  statesCompleted: string[];
  progressPercent: number;
  identityVerified: boolean;
  eligibilityChecked: boolean;
  eligibilityResult: boolean | null;
  consentGranted: boolean;
  handedOff: boolean;
  handoffReason: string | null;
  agentActions: number;
  humanActions: number;
  reviewStatus: string | null;
  reviewReason: string | null;
  eventCount: number;
}

interface CaseTimelineEntry {
  caseId: string;
  traceEventId: string;
  traceId?: string;
  eventType: string;
  actor: "agent" | "citizen" | "system";
  summary: string;
  createdAt: string;
  tracePayload?: Record<string, unknown>;
}

interface StateDefinition {
  id: string;
  type?: string;
}

interface StateModel {
  states: StateDefinition[];
}

function CheckItem({ label, checked, detail }: { label: string; checked: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={checked ? "text-green-600" : "text-gray-400"}>
        {checked ? "\u2713" : "\u2717"}
      </span>
      <span className={checked ? "font-medium" : "text-gray-500"}>{label}</span>
      {detail && <span className="text-xs text-gray-500">({detail})</span>}
    </div>
  );
}

export default function CaseDetail({
  serviceId,
  userId,
}: {
  serviceId: string;
  userId: string;
}) {
  const router = useRouter();
  const [caseData, setCaseData] = useState<LedgerCase | null>(null);
  const [timeline, setTimeline] = useState<CaseTimelineEntry[]>([]);
  const [stateModel, setStateModel] = useState<StateModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [resetting, setResetting] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch(
      `${process.env.NEXT_PUBLIC_CITIZEN_API || "http://localhost:3100"}/api/ledger/services/${encodeURIComponent(serviceId)}/cases/${encodeURIComponent(userId)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setCaseData(data.case);
          setTimeline(data.timeline || []);
          setStateModel(data.stateModel || null);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to connect to citizen-experience API");
        setLoading(false);
      });
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset this case? This will delete the case and all associated traces. This cannot be undone.")) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_CITIZEN_API || "http://localhost:3100"}/api/ledger/services/${encodeURIComponent(serviceId)}/cases/${encodeURIComponent(userId)}/reset`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (data.success) {
        router.push(`/services/${encodeURIComponent(serviceId)}/ledger`);
      } else {
        alert("Failed to reset case: " + (data.error || "Unknown error"));
      }
    } catch {
      alert("Failed to connect to citizen-experience API");
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, userId]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading case...
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-xl p-4">
        <p className="text-red-600 font-bold">Error loading case</p>
        <p className="text-sm text-red-600 mt-1">{error || "Case not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Case Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">{caseData.userId}</h2>
            <StatusBadge status={caseData.status} />
            {caseData.reviewStatus && (
              <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full">
                Review: {caseData.reviewStatus}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Case <span className="font-mono">{caseData.caseId.slice(0, 12)}...</span>
            {" "}&middot;{" "}
            Started{" "}
            {new Date(caseData.startedAt).toLocaleDateString("en-GB", {
              dateStyle: "medium",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="bg-red-600 text-white font-bold px-4 py-2 text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset Case"}
          </button>
          <button
            onClick={() => setShowReview(true)}
            className="bg-govuk-green text-white font-bold px-4 py-2 text-sm rounded-lg hover:opacity-90"
          >
            Submit for review
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="border border-studio-border rounded-xl bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Journey Progress</h3>
          <span className="text-2xl font-light tracking-tight">{caseData.progressPercent}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-govuk-blue/70 rounded-full transition-all"
            style={{ width: `${caseData.progressPercent}%` }}
          />
        </div>
        {stateModel && (
          <StateProgressFlow
            states={stateModel.states}
            currentState={caseData.currentState}
            statesCompleted={caseData.statesCompleted}
          />
        )}
      </div>

      {/* Checklist + Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-studio-border rounded-xl bg-white p-4">
          <h3 className="text-sm font-bold mb-3">Checklist</h3>
          <div className="space-y-2">
            <CheckItem label="Identity verified" checked={caseData.identityVerified} />
            <CheckItem label="Eligibility checked" checked={caseData.eligibilityChecked}
              detail={caseData.eligibilityResult === null ? undefined : caseData.eligibilityResult ? "eligible" : "not eligible"} />
            <CheckItem label="Consent granted" checked={caseData.consentGranted} />
            <CheckItem label="Handed off" checked={caseData.handedOff}
              detail={caseData.handoffReason || undefined} />
          </div>
        </div>

        <div className="border border-studio-border rounded-xl bg-white p-4">
          <h3 className="text-sm font-bold mb-3">Activity</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Agent actions</span>
              <span className="font-bold">{caseData.agentActions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Human actions</span>
              <span className="font-bold">{caseData.humanActions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total events</span>
              <span className="font-bold">{caseData.eventCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Last activity</span>
              <span className="font-bold">
                {new Date(caseData.lastActivityAt).toLocaleDateString("en-GB", {
                  dateStyle: "medium",
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Review info */}
      {caseData.reviewStatus && caseData.reviewReason && (
        <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
          <h3 className="text-sm font-bold mb-1">Human Review</h3>
          <p className="text-sm">{caseData.reviewReason}</p>
          <p className="text-xs text-gray-500 mt-1">
            Status: {caseData.reviewStatus}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div>
        <h3 className="text-lg font-bold mb-3">Event Timeline</h3>
        <CaseTimelineView timeline={timeline} />
      </div>

      {/* Review Dialog */}
      {showReview && (
        <ReviewDialog
          caseId={caseData.caseId}
          serviceId={serviceId}
          userId={userId}
          onClose={() => setShowReview(false)}
          onSubmitted={() => {
            setShowReview(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
