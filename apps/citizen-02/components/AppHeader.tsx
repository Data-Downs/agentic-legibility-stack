"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import {
  PERSONA_COLORS,
  PERSONA_INITIALS,
} from "@/lib/types";

export function AppHeader() {
  const [mcpConnected, setMcpConnected] = useState(false);
  const [localMcpConnected, setLocalMcpConnected] = useState(false);

  const persona = useAppStore((s) => s.persona);
  const serviceMode = useAppStore((s) => s.serviceMode);
  const currentView = useAppStore((s) => s.currentView);
  const serviceName = useAppStore((s) => s.serviceName);
  const navigateBack = useAppStore((s) => s.navigateBack);
  const setSettingsPaneOpen = useAppStore((s) => s.setSettingsPaneOpen);
  const setPersonaSelectorOpen = useAppStore((s) => s.setPersonaSelectorOpen);
  const activePlan = useAppStore((s) => s.activePlan);

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

  const showBack =
    currentView === "detail" ||
    currentView === "chat" ||
    currentView === "tasks" ||
    currentView === "plan";

  const title = (() => {
    switch (currentView) {
      case "persona-picker":
        return "AI Agent Simulator";
      case "dashboard":
        return "Your services";
      case "detail":
        return serviceName || "Details";
      case "chat":
        return serviceName || "Dot";
      case "tasks":
        return "To do";
      case "plan":
        return activePlan?.lifeEventName || "Your plan";
      default:
        return "AI Agent Simulator";
    }
  })();

  return (
    <header
      className="bg-govuk-blue sticky top-0 z-40"
      role="banner"
      style={{ paddingTop: "var(--safe-area-top)" }}
    >
      <div className="max-w-[960px] mx-auto px-4 pt-3 pb-4">
        {/* Top row: back link / brand + avatar */}
        <div className="flex items-center gap-2">
          {showBack ? (
            <button
              onClick={navigateBack}
              className="text-white text-sm font-medium flex items-center gap-1 hover:underline touch-feedback"
              aria-label="Go back"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Home
            </button>
          ) : (
            <button
              onClick={() => {
                if (persona && currentView !== "persona-picker") {
                  setPersonaSelectorOpen(true);
                }
              }}
              className="flex items-center gap-2 text-left"
            >
              <span className="text-white font-bold text-lg font-govuk">
                GOV.UK
              </span>
              <span className="flex items-center gap-1 shrink-0">
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
            </button>
          )}

          <div className="flex-1" />

          {/* Persona avatar */}
          {persona && currentView !== "persona-picker" && (
            <button
              onClick={() => setSettingsPaneOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/20 hover:ring-white/50 transition-all touch-feedback"
              style={{ backgroundColor: PERSONA_COLORS[persona] }}
              aria-label="Open personal data dashboard"
            >
              {PERSONA_INITIALS[persona]}
            </button>
          )}
        </div>

        {/* Title row */}
        <h1 className="text-white font-bold text-2xl mt-2">
          {title}
        </h1>
      </div>
    </header>
  );
}
