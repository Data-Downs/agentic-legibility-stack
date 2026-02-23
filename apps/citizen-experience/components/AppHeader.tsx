"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import {
  PERSONA_NAMES,
  PERSONA_COLORS,
  PERSONA_INITIALS,
  SERVICE_TITLES,
} from "@/lib/types";

const personas = [
  { id: "emma-liam", desc: "Young couple, expecting first baby" },
  { id: "rajesh", desc: "Self-employed IT consultant" },
  { id: "margaret", desc: "Retired, 74, limited tech" },
  { id: "priya", desc: "Recently redundant, applying for UC" },
];

export function AppHeader() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mcpConnected, setMcpConnected] = useState(false);
  const [localMcpConnected, setLocalMcpConnected] = useState(false);
  const [agentSheetOpen, setAgentSheetOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const persona = useAppStore((s) => s.persona);
  const agent = useAppStore((s) => s.agent);
  const serviceMode = useAppStore((s) => s.serviceMode);
  const setAgent = useAppStore((s) => s.setAgent);
  const setServiceMode = useAppStore((s) => s.setServiceMode);
  const setPersona = useAppStore((s) => s.setPersona);
  const currentView = useAppStore((s) => s.currentView);
  const currentService = useAppStore((s) => s.currentService);
  const navigateBack = useAppStore((s) => s.navigateBack);

  // Check MCP status
  useEffect(() => {
    const check = () => {
      fetch("/api/mcp-status")
        .then((r) => r.json())
        .then((d) => {
          setMcpConnected(d.connected);
          setLocalMcpConnected(d.localMcpConnected ?? false);
        })
        .catch(() => {
          setMcpConnected(false);
          setLocalMcpConnected(false);
        });
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const showBack =
    currentView === "detail" ||
    currentView === "chat" ||
    currentView === "tasks";

  const title = (() => {
    switch (currentView) {
      case "persona-picker":
        return "AI Agent Simulator";
      case "dashboard":
        return "Your services";
      case "detail":
        return SERVICE_TITLES[currentService || ""] || "Details";
      case "chat":
        return SERVICE_TITLES[currentService || ""] || "Chat";
      case "tasks":
        return "To do";
      default:
        return "AI Agent Simulator";
    }
  })();

  return (
    <>
      <header className="bg-govuk-black sticky top-0 z-40" role="banner">
        <div className="max-w-[960px] mx-auto px-4 py-2 flex items-center gap-2">
          {/* Back button */}
          {showBack && (
            <button
              onClick={navigateBack}
              className="text-white p-1 -ml-1"
              aria-label="Go back"
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
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Brand */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-white font-bold text-lg font-govuk">
              GOV.UK
            </span>
            <span className="flex items-center gap-0.5 shrink-0">
              <span
                className={`w-2 h-2 rounded-full ${
                  mcpConnected ? "bg-govuk-green" : "bg-govuk-red"
                }`}
                title={
                  mcpConnected
                    ? "GOV.UK MCP connected"
                    : "GOV.UK MCP disconnected"
                }
              />
              {serviceMode === "mcp" && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    localMcpConnected ? "bg-blue-400" : "bg-gray-400"
                  }`}
                  title={
                    localMcpConnected
                      ? "Local MCP connected"
                      : "Local MCP not connected"
                  }
                />
              )}
            </span>
            <span className="text-white text-sm truncate opacity-80">
              {title}
            </span>
          </div>

          {/* Persona button */}
          {persona && currentView !== "persona-picker" && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen(!dropdownOpen);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: PERSONA_COLORS[persona] }}
                aria-label="Switch persona"
              >
                {PERSONA_INITIALS[persona]}
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 top-10 w-64 bg-white rounded-lg shadow-lg border border-govuk-mid-grey z-50">
                  {personas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setDropdownOpen(false);
                        setPersona(p.id);
                      }}
                      className={`flex items-center gap-3 w-full p-3 hover:bg-govuk-light-grey text-left first:rounded-t-lg ${
                        persona === p.id
                          ? "bg-govuk-light-grey"
                          : ""
                      }`}
                    >
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: PERSONA_COLORS[p.id] }}
                      >
                        {PERSONA_INITIALS[p.id]}
                      </span>
                      <div className="min-w-0">
                        <strong className="block text-sm">
                          {PERSONA_NAMES[p.id]}
                        </strong>
                        <span className="text-xs text-govuk-dark-grey">
                          {p.desc}
                        </span>
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-govuk-mid-grey" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(false);
                      setAgentSheetOpen(true);
                    }}
                    className="flex items-center justify-between w-full p-3 hover:bg-govuk-light-grey rounded-b-lg"
                  >
                    <span className="text-sm">
                      <strong>{agent.toUpperCase()}</strong>
                      <span className="text-govuk-dark-grey ml-1">
                        / {serviceMode.toUpperCase()}
                      </span>
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Agent selection sheet */}
      {agentSheetOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setAgentSheetOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-6 max-w-lg mx-auto">
            <div className="w-10 h-1 bg-govuk-mid-grey rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-4">Choose your AI agent</h2>
            <div className="space-y-3 mb-6">
              {(["dot", "max"] as const).map((a) => (
                <label
                  key={a}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                    agent === a
                      ? "border-govuk-blue bg-blue-50"
                      : "border-govuk-mid-grey"
                  }`}
                >
                  <input
                    type="radio"
                    name="agent"
                    value={a}
                    checked={agent === a}
                    onChange={() => setAgent(a)}
                    className="mt-1"
                  />
                  <div>
                    <strong>
                      {a.toUpperCase()}
                      {a === "dot"
                        ? " — Cautious & Fair"
                        : " — Confident & User-First"}
                    </strong>
                    <p className="text-sm text-govuk-dark-grey mt-0.5">
                      {a === "dot"
                        ? "Always asks permission, explains reasoning, prioritises compliance"
                        : "Auto-fills data, moves fast, pushes boundaries to help you"}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {/* Service mode toggle */}
            <div className="border-t border-govuk-mid-grey pt-4 mb-6">
              <h2 className="text-lg font-bold mb-4">Service mode</h2>
              <div className="space-y-3">
                {(["json", "mcp"] as const).map((m) => (
                  <label
                    key={m}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${
                      serviceMode === m
                        ? "border-govuk-blue bg-blue-50"
                        : "border-govuk-mid-grey"
                    }`}
                  >
                    <input
                      type="radio"
                      name="serviceMode"
                      value={m}
                      checked={serviceMode === m}
                      onChange={() => setServiceMode(m)}
                      className="mt-1"
                    />
                    <div>
                      <strong>
                        {m === "json" ? "JSON" : "MCP"}
                        <span className="font-normal text-govuk-dark-grey ml-1">
                          {m === "json" ? "(stable)" : "(experimental)"}
                        </span>
                      </strong>
                      <p className="text-sm text-govuk-dark-grey mt-0.5">
                        {m === "json"
                          ? "Service data loaded directly from JSON files — deterministic orchestration"
                          : "Service data accessed via MCP tool calls — agent-driven autonomy"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={() => setAgentSheetOpen(false)}
              className="w-full bg-govuk-green text-white font-bold py-3 rounded-lg hover:bg-[#005a30]"
            >
              Apply
            </button>
          </div>
        </>
      )}
    </>
  );
}
