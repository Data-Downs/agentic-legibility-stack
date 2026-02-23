"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { PersonaPicker } from "./PersonaPicker";
import { Dashboard } from "./Dashboard";
import { ChatView } from "./ChatView";
import { MessageInput } from "./MessageInput";
import { ReasoningFab } from "./ReasoningPanel";
import { AppHeader } from "./AppHeader";

const TERMINAL_STATES = new Set(["claim-active", "rejected", "handed-off"]);

export function AppShell() {
  const currentView = useAppStore((s) => s.currentView);
  const persona = useAppStore((s) => s.persona);
  const ucState = useAppStore((s) => s.ucState);
  const setPersona = useAppStore((s) => s.setPersona);
  const setAgent = useAppStore((s) => s.setAgent);

  const journeyComplete = !!(ucState && TERMINAL_STATES.has(ucState));

  // Restore session on mount
  useEffect(() => {
    const savedPersona = sessionStorage.getItem("persona");
    const savedAgent = sessionStorage.getItem("agent") as "dot" | "max" | null;

    if (savedAgent) {
      setAgent(savedAgent);
    }
    if (savedPersona) {
      setPersona(savedPersona);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <AppHeader />

      {/* Phase banner */}
      <div className="max-w-[960px] mx-auto w-full px-4 pt-3">
        <div className="flex items-center gap-2 text-sm border-b border-govuk-mid-grey pb-3">
          <strong className="bg-govuk-blue text-govuk-white px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
            Prototype
          </strong>
          <span className="text-govuk-dark-grey">
            This is a reference implementation — not a live government service.
          </span>
        </div>
      </div>

      {/* Main content */}
      <main
        className={`flex-1 ${currentView === "chat" ? "flex flex-col" : ""}`}
      >
        <div
          className={`${currentView === "chat" ? "flex-1 flex flex-col" : "max-w-[960px] mx-auto w-full px-4 py-6"}`}
        >
          {currentView === "persona-picker" && <PersonaPicker />}
          {currentView === "dashboard" && <Dashboard />}
          {currentView === "chat" && <ChatView />}
        </div>
      </main>

      {/* Input bar — hidden on persona-picker and when journey is complete */}
      {persona && currentView !== "persona-picker" && !journeyComplete && <MessageInput />}

      {/* Reasoning FAB */}
      <ReasoningFab />
    </div>
  );
}
