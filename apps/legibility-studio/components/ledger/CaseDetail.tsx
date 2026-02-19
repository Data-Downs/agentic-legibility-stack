"use client";

import { useState, useEffect } from "react";
import CaseTimelineView from "./CaseTimelineView";
import StateProgressFlow from "./StateProgressFlow";
import ReviewDialog from "./ReviewDialog";

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

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  "in-progress": { label: "In progress", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
  "handed-off": { label: "Handed off", color: "bg-yellow-100 text-yellow-800" },
  abandoned: { label: "Abandoned", color: "bg-gray-100 text-gray-600" },
};

function CheckItem({ label, checked, detail }: { label: string; checked: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={checked ? "text-green-600" : "text-gray-400"}>
        {checked ? "\u2713" : "\u2717"}
      </span>
      <span className={checked ? "font-medium" : "text-govuk-dark-grey"}>{label}</span>
      {detail && <span className="text-xs text-govuk-dark-grey">({detail})</span>}
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
  const [caseData, setCaseData] = useState<LedgerCase | null>(null);
  const [timeline, setTimeline] = useState<CaseTimelineEntry[]>([]);
  const [stateModel, setStateModel] = useState<StateModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch(
      `http://localhost:3100/api/ledger/services/${encodeURIComponent(serviceId)}/cases/${encodeURIComponent(userId)}`,
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

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, userId]);

  if (loading) {
    return (
      <div className="text-center py-12 text-govuk-dark-grey">
        Loading case...
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="border border-red-200 bg-red-50 rounded p-4">
        <p className="text-red-600 font-bold">Error loading case</p>
        <p className="text-sm text-red-600 mt-1">{error || "Case not found"}</p>
      </div>
    );
  }

  const badge = STATUS_BADGES[caseData.status] || STATUS_BADGES.abandoned;

  return (
    <div className="space-y-6">
      {/* Case Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">{caseData.userId}</h2>
            <span className={`px-2 py-0.5 text-xs rounded ${badge.color}`}>
              {badge.label}
            </span>
            {caseData.reviewStatus && (
              <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded">
                Review: {caseData.reviewStatus}
              </span>
            )}
          </div>
          <p className="text-sm text-govuk-dark-grey">
            Case <span className="font-mono">{caseData.caseId.slice(0, 12)}...</span>
            {" "}&middot;{" "}
            Started{" "}
            {new Date(caseData.startedAt).toLocaleDateString("en-GB", {
              dateStyle: "medium",
            })}
          </p>
        </div>
        <button
          onClick={() => setShowReview(true)}
          className="bg-govuk-green text-white font-bold px-4 py-2 text-sm rounded hover:opacity-90"
        >
          Submit for review
        </button>
      </div>

      {/* Progress */}
      <div className="border border-govuk-mid-grey rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Journey Progress</h3>
          <span className="text-lg font-bold">{caseData.progressPercent}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded overflow-hidden mb-4">
          <div
            className="h-full bg-govuk-green rounded transition-all"
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
        <div className="border border-govuk-mid-grey rounded p-4">
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

        <div className="border border-govuk-mid-grey rounded p-4">
          <h3 className="text-sm font-bold mb-3">Activity</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-govuk-dark-grey">Agent actions</span>
              <span className="font-bold">{caseData.agentActions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-govuk-dark-grey">Human actions</span>
              <span className="font-bold">{caseData.humanActions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-govuk-dark-grey">Total events</span>
              <span className="font-bold">{caseData.eventCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-govuk-dark-grey">Last activity</span>
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
        <div className="border border-orange-200 bg-orange-50 rounded p-4">
          <h3 className="text-sm font-bold mb-1">Human Review</h3>
          <p className="text-sm">{caseData.reviewReason}</p>
          <p className="text-xs text-govuk-dark-grey mt-1">
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
