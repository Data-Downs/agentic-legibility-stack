"use client";

import { useState, useCallback } from "react";

interface TraceEvent {
  id: string;
  traceId: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface ReplayViewProps {
  events: TraceEvent[];
}

export default function ReplayView({ events }: ReplayViewProps) {
  const [position, setPosition] = useState(-1);
  const total = events.length;

  const step = useCallback(() => {
    setPosition((p) => (p < total - 1 ? p + 1 : p));
  }, [total]);

  const stepBack = useCallback(() => {
    setPosition((p) => (p > 0 ? p - 1 : p));
  }, []);

  const jumpTo = useCallback((idx: number) => {
    if (idx >= 0 && idx < total) setPosition(idx);
  }, [total]);

  const reset = useCallback(() => setPosition(-1), []);

  const current = position >= 0 && position < total ? events[position] : null;
  const visibleEvents = position >= 0 ? events.slice(0, position + 1) : [];
  const progress = total > 0 ? Math.round(((position + 1) / total) * 100) : 0;

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 bg-gray-50 border border-govuk-mid-grey rounded p-3">
        <button
          onClick={reset}
          disabled={position < 0}
          className="text-xs px-3 py-1 rounded border border-govuk-mid-grey disabled:opacity-40 hover:bg-gray-100"
        >
          Reset
        </button>
        <button
          onClick={stepBack}
          disabled={position <= 0}
          className="text-xs px-3 py-1 rounded border border-govuk-mid-grey disabled:opacity-40 hover:bg-gray-100"
        >
          &larr; Back
        </button>
        <button
          onClick={step}
          disabled={position >= total - 1}
          className="text-xs px-3 py-1 rounded bg-govuk-blue text-white disabled:opacity-40 hover:bg-blue-800"
        >
          Step &rarr;
        </button>
        <span className="text-xs text-govuk-dark-grey ml-2">
          {position >= 0 ? `${position + 1} / ${total}` : `0 / ${total}`}
        </span>

        {/* Progress bar */}
        <div className="flex-1 bg-gray-200 rounded-full h-2 ml-2">
          <div
            className="bg-govuk-blue h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={-1}
        max={total - 1}
        value={position}
        onChange={(e) => jumpTo(parseInt(e.target.value))}
        className="w-full mb-4"
      />

      <div className="grid grid-cols-2 gap-4">
        {/* Event timeline (left) */}
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {events.map((event, idx) => {
            const isActive = idx === position;
            const isVisible = idx <= position;
            return (
              <button
                key={event.id}
                onClick={() => jumpTo(idx)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded flex items-center gap-2 transition-all ${
                  isActive
                    ? "bg-govuk-blue text-white"
                    : isVisible
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-gray-50 border border-gray-200 opacity-50"
                }`}
              >
                <span className="w-5 text-right opacity-60">{idx + 1}</span>
                <span className="font-mono">{event.type}</span>
              </button>
            );
          })}
        </div>

        {/* Current event detail (right) */}
        <div>
          {current ? (
            <div className="border border-govuk-blue rounded p-4">
              <div className="text-sm font-bold mb-1">{current.type}</div>
              <div className="text-xs text-govuk-dark-grey mb-3">
                {new Date(current.timestamp).toLocaleString("en-GB")}
              </div>
              <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                {JSON.stringify(current.payload, null, 2)}
              </pre>
              <div className="text-xs text-govuk-dark-grey mt-2 font-mono">
                ID: {current.id}
              </div>
            </div>
          ) : (
            <div className="border border-gray-200 rounded p-8 text-center">
              <p className="text-govuk-dark-grey text-sm">Click &ldquo;Step&rdquo; to begin replay</p>
              <p className="text-xs text-govuk-dark-grey mt-1">{total} events to replay</p>
            </div>
          )}

          {/* Summary of visible events */}
          {visibleEvents.length > 0 && (
            <div className="mt-3 text-xs text-govuk-dark-grey">
              <strong>Events so far:</strong>{" "}
              {Object.entries(
                visibleEvents.reduce<Record<string, number>>((acc, e) => {
                  acc[e.type] = (acc[e.type] || 0) + 1;
                  return acc;
                }, {})
              ).map(([type, count]) => `${type} (${count})`).join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
