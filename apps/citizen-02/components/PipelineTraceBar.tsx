"use client";

import { useState } from "react";
import type { PipelineTrace } from "@als/schemas";

interface PipelineTraceBarProps {
  trace: PipelineTrace | null;
}

export function PipelineTraceBar({ trace }: PipelineTraceBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (!trace) return null;

  const aiSteps = trace.steps.filter((s) => s.type === "ai");
  const deterministicSteps = trace.steps.filter((s) => s.type === "deterministic");
  const totalSeconds = (trace.totalDurationMs / 1000).toFixed(1);
  const agentLabel = trace.agentUsed !== "unified" ? `${capitalize(trace.agentUsed)} Agent · ` : "";

  return (
    <div className="mx-4 mt-1 mb-2" data-testid="pipeline-trace-bar">
      {/* Collapsed summary */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-govuk-dark-grey hover:text-govuk-black transition-colors w-full text-left"
        aria-expanded={expanded}
        aria-label="Toggle pipeline trace details"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M4 2l4 4-4 4V2z" />
        </svg>
        <span>
          {agentLabel}{trace.steps.length} steps · {totalSeconds}s · {aiSteps.length} AI + {deterministicSteps.length} rule-based
        </span>
      </button>

      {/* Expanded step list */}
      {expanded && (
        <div className="mt-2 border border-gray-200 rounded-lg bg-white overflow-hidden" data-testid="pipeline-trace-expanded">
          {trace.steps.map((step) => (
            <div
              key={step.id}
              className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 text-xs"
            >
              {/* Status icon */}
              <span className="mt-0.5 flex-shrink-0" aria-label={step.status}>
                {step.status === "complete" && <span className="text-green-600">✓</span>}
                {step.status === "skipped" && <span className="text-gray-400">—</span>}
                {step.status === "error" && <span className="text-red-500">✗</span>}
              </span>

              {/* Name and label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-govuk-black">{step.name}</span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      step.type === "ai"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                    data-testid={`badge-${step.type}`}
                  >
                    {step.type === "ai" ? "AI" : "Rule-based"}
                  </span>
                </div>
                <div className="text-govuk-dark-grey">{step.label}</div>
                {step.detail && (
                  <div className="text-govuk-mid-grey mt-0.5">{step.detail}</div>
                )}
              </div>

              {/* Duration */}
              <span className="text-govuk-mid-grey flex-shrink-0">
                {step.durationMs}ms
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
