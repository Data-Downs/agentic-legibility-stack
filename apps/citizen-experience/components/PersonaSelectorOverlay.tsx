"use client";

import { useAppStore } from "@/lib/store";
import { PERSONA_NAMES, PERSONA_COLORS, PERSONA_INITIALS } from "@/lib/types";

const personas = [
  { id: "emma-liam", desc: "Young couple, expecting first baby" },
  { id: "rajesh", desc: "Self-employed IT consultant" },
  { id: "margaret", desc: "Retired, managing health conditions" },
  { id: "priya", desc: "Recently redundant, applying for UC" },
];

export function PersonaSelectorOverlay() {
  const persona = useAppStore((s) => s.persona);
  const agent = useAppStore((s) => s.agent);
  const serviceMode = useAppStore((s) => s.serviceMode);
  const setPersona = useAppStore((s) => s.setPersona);
  const setAgent = useAppStore((s) => s.setAgent);
  const setServiceMode = useAppStore((s) => s.setServiceMode);
  const setOpen = useAppStore((s) => s.setPersonaSelectorOpen);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Switch persona</h2>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-govuk-dark-grey hover:text-govuk-black"
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Persona cards */}
          <div className="space-y-3 mb-6">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPersona(p.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-3 w-full p-4 border rounded-xl text-left transition-all ${
                  persona === p.id
                    ? "border-govuk-blue bg-blue-50"
                    : "border-govuk-mid-grey hover:border-govuk-blue"
                }`}
              >
                <span
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: PERSONA_COLORS[p.id] }}
                >
                  {PERSONA_INITIALS[p.id]}
                </span>
                <div className="min-w-0">
                  <strong className="block text-sm">{PERSONA_NAMES[p.id]}</strong>
                  <span className="text-xs text-govuk-dark-grey">{p.desc}</span>
                </div>
                {persona === p.id && (
                  <svg className="shrink-0 text-govuk-blue ml-auto" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Agent + mode selection */}
          <div className="border-t border-govuk-mid-grey pt-4">
            <h3 className="font-bold text-sm mb-3">AI Agent</h3>
            <div className="flex gap-2 mb-4">
              {(["dot", "max"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAgent(a)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium ${
                    agent === a
                      ? "border-govuk-blue bg-blue-50 text-govuk-blue"
                      : "border-govuk-mid-grey text-govuk-dark-grey"
                  }`}
                >
                  {a.toUpperCase()}
                  <span className="block text-xs font-normal mt-0.5">
                    {a === "dot" ? "Cautious" : "Confident"}
                  </span>
                </button>
              ))}
            </div>

            <h3 className="font-bold text-sm mb-3">Service mode</h3>
            <div className="flex gap-2">
              {(["json", "mcp"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setServiceMode(m)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium ${
                    serviceMode === m
                      ? "border-govuk-blue bg-blue-50 text-govuk-blue"
                      : "border-govuk-mid-grey text-govuk-dark-grey"
                  }`}
                >
                  {m.toUpperCase()}
                  <span className="block text-xs font-normal mt-0.5">
                    {m === "json" ? "Stable" : "Experimental"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
