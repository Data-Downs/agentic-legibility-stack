"use client";

import { useState, useEffect, useCallback } from "react";
import StatusBadge from "@/components/ui/StatusBadge";

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

  const filterLabels: Record<string, string> = {
    "": "All",
    "in-progress": "In progress",
    completed: "Completed",
    rejected: "Rejected",
    "handed-off": "Handed off",
  };

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
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                statusFilter === s
                  ? "bg-studio-accent text-white border-studio-accent"
                  : "bg-white border-studio-border hover:bg-gray-50"
              }`}
            >
              {filterLabels[s]}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-4">Loading cases...</p>
      ) : cases.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 italic">No cases found.</p>
      ) : (
        <>
          <div className="border border-studio-border rounded-xl bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-3 px-4 font-semibold sticky top-0 bg-gray-50 z-10 border-b border-studio-border">User</th>
                  <th className="py-3 px-4 font-semibold sticky top-0 bg-gray-50 z-10 border-b border-studio-border">Status</th>
                  <th className="py-3 px-4 font-semibold sticky top-0 bg-gray-50 z-10 border-b border-studio-border">Current State</th>
                  <th className="py-3 px-4 font-semibold sticky top-0 bg-gray-50 z-10 border-b border-studio-border text-right">Progress</th>
                  <th className="py-3 px-4 font-semibold sticky top-0 bg-gray-50 z-10 border-b border-studio-border text-right">Events</th>
                  <th className="py-3 px-4 font-semibold sticky top-0 bg-gray-50 z-10 border-b border-studio-border">Last Activity</th>
                  <th className="py-3 px-4 sticky top-0 bg-gray-50 z-10 border-b border-studio-border"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-studio-border">
                {cases.map((c) => (
                  <tr
                    key={c.caseId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs">{c.userId}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={c.status} />
                      {c.reviewStatus && (
                        <span className="ml-1 inline-block px-1.5 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full">
                          Review: {c.reviewStatus}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{c.currentState}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-govuk-blue rounded-full"
                            style={{ width: `${c.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs w-8 text-right">
                          {c.progressPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right text-xs">{c.eventCount}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {new Date(c.lastActivityAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`/services/${encodeURIComponent(serviceId)}/ledger/cases/${encodeURIComponent(c.userId)}`}
                        className="text-studio-accent text-xs hover:underline font-medium"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-500">
                Showing {(page - 1) * limit + 1}&ndash;
                {Math.min(page * limit, total)} of {total}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs border border-studio-border rounded-lg disabled:opacity-30 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-xs border border-studio-border rounded-lg disabled:opacity-30 hover:bg-gray-50"
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
