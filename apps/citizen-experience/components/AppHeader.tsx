"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import {
  PERSONA_COLORS,
  PERSONA_INITIALS,
  SERVICE_TITLES,
} from "@/lib/types";

export function AppHeader() {
  const [mcpConnected, setMcpConnected] = useState(false);
  const [localMcpConnected, setLocalMcpConnected] = useState(false);

  const persona = useAppStore((s) => s.persona);
  const serviceMode = useAppStore((s) => s.serviceMode);
  const currentView = useAppStore((s) => s.currentView);
  const currentService = useAppStore((s) => s.currentService);
  const navigateBack = useAppStore((s) => s.navigateBack);
  const setSettingsPaneOpen = useAppStore((s) => s.setSettingsPaneOpen);
  const setPersonaSelectorOpen = useAppStore((s) => s.setPersonaSelectorOpen);

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

        {/* Brand — tappable to open persona selector */}
        <button
          onClick={() => {
            if (persona && currentView !== "persona-picker") {
              setPersonaSelectorOpen(true);
            }
          }}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
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
        </button>

        {/* Persona avatar — tappable to open personal data dashboard */}
        {persona && currentView !== "persona-picker" && (
          <button
            onClick={() => setSettingsPaneOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/20 hover:ring-white/50 transition-all"
            style={{ backgroundColor: PERSONA_COLORS[persona] }}
            aria-label="Open personal data dashboard"
          >
            {PERSONA_INITIALS[persona]}
          </button>
        )}
      </div>
    </header>
  );
}
