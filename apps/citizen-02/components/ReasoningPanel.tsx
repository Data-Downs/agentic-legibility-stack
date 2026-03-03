"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";

export function ReasoningFab() {
  const [isOpen, setIsOpen] = useState(false);
  const currentReasoning = useAppStore((s) => s.currentReasoning);
  const hasNewReasoning = useAppStore((s) => s.hasNewReasoning);
  const clearReasoningBadge = useAppStore((s) => s.clearReasoningBadge);
  const currentView = useAppStore((s) => s.currentView);

  if (!currentReasoning || currentView === "persona-picker") return null;

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => {
          setIsOpen(true);
          clearReasoningBadge();
        }}
        className="fixed z-30 w-12 h-12 rounded-full bg-govuk-dark-blue text-white shadow-lg flex items-center justify-center hover:bg-govuk-blue transition-colors touch-feedback"
        style={{
          bottom: "calc(80px + var(--safe-area-bottom, 0px))",
          right: "16px",
        }}
        aria-label="View agent reasoning"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 12 18.469c-.93 0-1.813.392-2.438 1.07l-.548-.547z" />
        </svg>
        {hasNewReasoning && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-govuk-red rounded-full animate-bounce-dot" />
        )}
      </button>

      {/* Reasoning overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-slide-up">
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-govuk-dark-blue text-white"
            style={{ paddingTop: "calc(12px + var(--safe-area-top, 0px))" }}
          >
            <h2 className="text-lg font-bold">Agent Reasoning</h2>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              aria-label="Close reasoning panel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <pre className="text-sm text-govuk-dark-grey whitespace-pre-wrap font-sans leading-relaxed">
              {currentReasoning}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
