"use client";

import { useState } from "react";

interface InferredFact {
  id: string;
  fieldKey: string;
  fieldValue: unknown;
  confidence: string;
  source: string;
  sessionId?: string;
  extractedFrom?: string;
  createdAt: string;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-govuk-green text-white",
  medium: "bg-yellow-500 text-white",
  low: "bg-orange-500 text-white",
};

export function InferredSection({
  facts,
  personaId,
  onRefresh,
}: {
  facts: InferredFact[];
  personaId: string;
  onRefresh: () => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const deleteFact = async (factId: string) => {
    setDeleting(factId);
    try {
      const res = await fetch(`/api/personal-data/${personaId}/inferred/${factId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setDeleting(null);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      // Delete each fact individually (no bulk endpoint yet)
      for (const fact of facts) {
        await fetch(`/api/personal-data/${personaId}/inferred/${fact.id}`, {
          method: "DELETE",
        });
      }
      onRefresh();
    } catch (error) {
      console.error("Clear error:", error);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f47738" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <h3 className="font-bold text-sm">Things we learned from chat</h3>
        </div>
        {facts.length > 0 && (
          <button
            onClick={clearAll}
            disabled={clearing}
            className="text-xs text-govuk-red underline"
          >
            {clearing ? "Clearing..." : "Clear all"}
          </button>
        )}
      </div>

      {facts.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-govuk-dark-grey">
            No facts extracted yet. Start a conversation and we&apos;ll note relevant details here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {facts.map((fact) => (
            <div
              key={fact.id}
              className="border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">
                    {fact.fieldKey.replace(/_/g, " ")}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${CONFIDENCE_COLORS[fact.confidence] || "bg-gray-200"}`}>
                    {fact.confidence}
                  </span>
                </div>
                <p className="text-sm">
                  {typeof fact.fieldValue === "string"
                    ? fact.fieldValue
                    : JSON.stringify(fact.fieldValue)}
                </p>
                {fact.extractedFrom && (
                  <p className="text-xs text-govuk-dark-grey mt-1 italic truncate">
                    &ldquo;{fact.extractedFrom}&rdquo;
                  </p>
                )}
              </div>
              <button
                onClick={() => deleteFact(fact.id)}
                disabled={deleting === fact.id}
                className="text-govuk-dark-grey hover:text-govuk-red shrink-0 p-1"
                aria-label="Delete fact"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
