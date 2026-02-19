"use client";

import { useState, useEffect, useCallback } from "react";

interface LedgerCase {
  caseId: string;
  userId: string;
  serviceId: string;
  currentState: string;
  status: string;
  startedAt: string;
  lastActivityAt: string;
  progressPercent: number;
  agentActions: number;
  humanActions: number;
  eventCount: number;
  reviewStatus: string | null;
}

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  "in-progress": { label: "In progress", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
  "handed-off": { label: "Handed off", color: "bg-yellow-100 text-yellow-800" },
  abandoned: { label: "Abandoned", color: "bg-gray-100 text-gray-600" },
};

export default function CasesList({ serviceId }: { serviceId: string }) {
  const [cases, setCases] = useState<LedgerCase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const limit = 20;

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(
        `http://localhost:3100/api/ledger/services/${encodeURIComponent(serviceId)}/cases?${params}`,
      );
      const data = await res.json();
      setCases(data.cases || []);
      setTotal(data.total || 0);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [serviceId, page, statusFilter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-bold">Filter:</span>
        {["", "in-progress", "completed", "rejected", "handed-off"].map(
          (s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1 text-xs rounded border ${
                statusFilter === s
                  ? "bg-govuk-blue text-white border-govuk-blue"
                  : "bg-white border-govuk-mid-grey hover:bg-gray-50"
              }`}
            >
              {s === "" ? "All" : STATUS_BADGES[s]?.label || s}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <p className="text-sm text-govuk-dark-grey py-4">Loading cases...</p>
      ) : cases.length === 0 ? (
        <p className="text-sm text-govuk-dark-grey py-4 italic">No cases found.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-govuk-dark-grey text-left">
                <th className="py-2 font-bold">User</th>
                <th className="py-2 font-bold">Status</th>
                <th className="py-2 font-bold">Current State</th>
                <th className="py-2 font-bold text-right">Progress</th>
                <th className="py-2 font-bold text-right">Events</th>
                <th className="py-2 font-bold">Last Activity</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const badge = STATUS_BADGES[c.status] || STATUS_BADGES.abandoned;
                return (
                  <tr
                    key={c.caseId}
                    className="border-b border-govuk-mid-grey hover:bg-gray-50"
                  >
                    <td className="py-2 font-mono text-xs">{c.userId}</td>
                    <td className="py-2">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                      {c.reviewStatus && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 text-xs bg-orange-100 text-orange-800 rounded">
                          Review: {c.reviewStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-2 font-mono text-xs">{c.currentState}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-govuk-green rounded"
                            style={{ width: `${c.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs w-8 text-right">
                          {c.progressPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-xs">{c.eventCount}</td>
                    <td className="py-2 text-xs text-govuk-dark-grey">
                      {new Date(c.lastActivityAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="py-2 text-right">
                      <a
                        href={`/services/${encodeURIComponent(serviceId)}/ledger/cases/${encodeURIComponent(c.userId)}`}
                        className="text-govuk-blue text-xs hover:underline"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-govuk-dark-grey">
                Showing {(page - 1) * limit + 1}&ndash;
                {Math.min(page * limit, total)} of {total}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs border rounded disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-xs border rounded disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
