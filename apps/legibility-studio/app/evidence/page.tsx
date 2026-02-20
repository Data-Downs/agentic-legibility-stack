"use client";

import { useState, useEffect } from "react";
import TraceExplorer from "../../components/evidence/TraceExplorer";
import ReplayView from "../../components/evidence/ReplayView";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import PageHeader from "@/components/ui/PageHeader";

interface TraceEntry {
  traceId: string;
  firstEvent: string;
  eventCount: number;
}

interface TraceEvent {
  id: string;
  traceId: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface Receipt {
  id: string;
  capabilityId: string;
  timestamp: string;
  action: string;
  outcome: string;
  details: Record<string, unknown>;
}

type Tab = "explorer" | "replay";

export default function EvidencePage() {
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected trace detail
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [traceReceipts, setTraceReceipts] = useState<Receipt[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [tab, setTab] = useState<Tab>("explorer");

  useEffect(() => {
    fetch("http://localhost:3100/api/traces")
      .then((r) => r.json())
      .then((data) => {
        setTraces(data.traces || []);
        setTotalEvents(data.totalEvents || 0);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not connect to citizen-experience (port 3100). Is it running?");
        setLoading(false);
      });
  }, []);

  const loadTrace = async (traceId: string) => {
    setSelectedTraceId(traceId);
    setDetailLoading(true);
    try {
      const resp = await fetch(`http://localhost:3100/api/traces/${traceId}`);
      const data = await resp.json();
      setTraceEvents(data.events || []);
      setTraceReceipts(data.receipts || []);
    } catch {
      setTraceEvents([]);
      setTraceReceipts([]);
    }
    setDetailLoading(false);
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading evidence...</div>;
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Evidence" }]} />
      <PageHeader
        title="Evidence Plane"
        subtitle={`Browse traces and receipts from agent interactions.${totalEvents > 0 ? ` ${totalEvents} total events recorded.` : ""}`}
      />

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Two-column layout: trace list | detail */}
      <div className="grid grid-cols-3 gap-6">
        {/* Trace list (left column) */}
        <div className="col-span-1">
          <h2 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-3">
            Sessions ({traces.length})
          </h2>
          {traces.length === 0 && !error && (
            <div className="bg-white border border-studio-border rounded-xl p-6 text-center">
              <p className="text-gray-500 text-sm">No traces recorded yet.</p>
              <p className="text-xs text-gray-400 mt-2">
                Chat with the agent to generate traces.
              </p>
            </div>
          )}
          <div className="space-y-2">
            {traces.map((trace) => (
              <button
                key={trace.traceId}
                onClick={() => loadTrace(trace.traceId)}
                className={`w-full text-left border rounded-xl p-3 transition-colors ${
                  selectedTraceId === trace.traceId
                    ? "border-studio-accent bg-blue-50"
                    : "border-studio-border bg-white hover:border-studio-accent"
                }`}
              >
                <div className="font-mono text-xs font-bold truncate">{trace.traceId}</div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">
                    {new Date(trace.firstEvent).toLocaleString("en-GB")}
                  </span>
                  <span className="text-xs font-bold">{trace.eventCount} events</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel (right columns) */}
        <div className="col-span-2">
          {!selectedTraceId && (
            <div className="bg-white border border-studio-border rounded-xl p-12 text-center">
              <p className="text-gray-500">Select a session to explore its trace events.</p>
            </div>
          )}

          {selectedTraceId && detailLoading && (
            <div className="text-center py-8 text-gray-500">Loading trace...</div>
          )}

          {selectedTraceId && !detailLoading && (
            <div>
              {/* Tabs */}
              <div className="flex gap-1 border-b border-studio-border mb-4">
                <button
                  onClick={() => setTab("explorer")}
                  className={`text-sm px-4 py-2 border-b-2 transition-colors ${
                    tab === "explorer"
                      ? "border-studio-accent text-studio-accent font-bold"
                      : "border-transparent text-gray-500 hover:text-black"
                  }`}
                >
                  Explorer
                </button>
                <button
                  onClick={() => setTab("replay")}
                  className={`text-sm px-4 py-2 border-b-2 transition-colors ${
                    tab === "replay"
                      ? "border-studio-accent text-studio-accent font-bold"
                      : "border-transparent text-gray-500 hover:text-black"
                  }`}
                >
                  Replay
                </button>
              </div>

              {tab === "explorer" && (
                <TraceExplorer events={traceEvents} receipts={traceReceipts} />
              )}

              {tab === "replay" && <ReplayView events={traceEvents} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
