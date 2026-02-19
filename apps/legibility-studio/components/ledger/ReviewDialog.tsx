"use client";

import { useState } from "react";

export default function ReviewDialog({
  caseId,
  serviceId,
  userId,
  onSubmitted,
  onClose,
}: {
  caseId: string;
  serviceId: string;
  userId: string;
  onSubmitted: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"routine" | "priority" | "urgent">("routine");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for the review.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `http://localhost:3100/api/ledger/services/${encodeURIComponent(serviceId)}/cases/${encodeURIComponent(userId)}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason,
            priority,
            requestedBy: "studio-user",
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit review");
      }

      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
        <h3 className="text-xl font-bold mb-1">Submit for human review</h3>
        <p className="text-sm text-govuk-dark-grey mb-4">
          Case <span className="font-mono">{caseId.slice(0, 8)}...</span> will
          be flagged for review by a government agent.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1" htmlFor="review-reason">
              Reason for review
            </label>
            <textarea
              id="review-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-govuk-mid-grey rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-govuk-blue"
              placeholder="Describe why this case needs human attention..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-1">Priority</label>
            <div className="flex gap-2">
              {(["routine", "priority", "urgent"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1.5 text-sm rounded border capitalize ${
                    priority === p
                      ? p === "urgent"
                        ? "bg-red-600 text-white border-red-600"
                        : p === "priority"
                          ? "bg-yellow-500 text-white border-yellow-500"
                          : "bg-govuk-blue text-white border-govuk-blue"
                      : "bg-white text-govuk-dark-grey border-govuk-mid-grey hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-govuk-mid-grey rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm bg-govuk-green text-white font-bold rounded hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit for review"}
          </button>
        </div>
      </div>
    </div>
  );
}
