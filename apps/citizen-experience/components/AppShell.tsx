"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { PersonaPicker } from "./PersonaPicker";
import { Dashboard } from "./Dashboard";
import { ChatView } from "./ChatView";
import { MessageInput } from "./MessageInput";
import { ReasoningFab } from "./ReasoningPanel";
import { AppHeader } from "./AppHeader";
import { PersonaSelectorOverlay } from "./PersonaSelectorOverlay";
import { PlanView } from "./PlanView";
import { PersonalDataDashboard } from "./personal-data/PersonalDataDashboard";
import { getAllTerminalStateIds } from "@als/schemas";

const TERMINAL_STATES = getAllTerminalStateIds();

function TabButton({ label, icon, active, onClick, disabled }: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 flex-1 py-2 text-[11px] font-medium transition-colors ${
        active
          ? "text-govuk-blue"
          : disabled
            ? "text-govuk-mid-grey"
            : "text-govuk-dark-grey"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function BottomTabBar() {
  const currentView = useAppStore((s) => s.currentView);
  const navigateTo = useAppStore((s) => s.navigateTo);
  const startNewConversation = useAppStore((s) => s.startNewConversation);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="max-w-[960px] mx-auto flex">
        <TabButton
          label="Home"
          active={currentView === "dashboard" || currentView === "plan"}
          onClick={() => {
            startNewConversation(null);
            navigateTo("dashboard");
          }}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          }
        />
        <TabButton
          label="Chat"
          active={currentView === "chat"}
          onClick={() => navigateTo("chat")}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          }
        />
        <TabButton
          label="Wallet"
          active={false}
          onClick={() => {}}
          disabled
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M16 12h.01" />
            </svg>
          }
        />
        <TabButton
          label="About"
          active={false}
          onClick={() => {}}
          disabled
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          }
        />
      </div>
    </nav>
  );
}

export function AppShell() {
  const currentView = useAppStore((s) => s.currentView);
  const persona = useAppStore((s) => s.persona);
  const ucState = useAppStore((s) => s.ucState);
  const setPersona = useAppStore((s) => s.setPersona);
  const setAgent = useAppStore((s) => s.setAgent);
  const settingsPaneOpen = useAppStore((s) => s.settingsPaneOpen);
  const personaSelectorOpen = useAppStore((s) => s.personaSelectorOpen);

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
    <div className="min-h-screen flex flex-col bg-govuk-page-bg">
      <AppHeader />

      {/* Phase banner */}
      <div className="max-w-[960px] mx-auto w-full px-4 pt-3">
        <div className="flex items-center gap-2 text-sm pb-3">
          <strong className="bg-govuk-blue text-govuk-white px-2 py-0.5 text-xs font-bold uppercase tracking-wide rounded">
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
          className={`${currentView === "chat" ? "flex-1 flex flex-col" : "max-w-[960px] mx-auto w-full px-4 py-6 pb-24"}`}
        >
          {currentView === "persona-picker" && <PersonaPicker />}
          {currentView === "dashboard" && <Dashboard />}
          {currentView === "chat" && <ChatView />}
          {currentView === "plan" && <PlanView />}
        </div>
      </main>

      {/* Input bar — hidden on persona-picker, plan view, and when journey is complete */}
      {persona && currentView !== "persona-picker" && currentView !== "plan" && !journeyComplete && <MessageInput />}

      {/* Bottom tab navigation — hidden on persona-picker */}
      {currentView !== "persona-picker" && <BottomTabBar />}

      {/* Reasoning FAB */}
      <ReasoningFab />

      {/* Persona selector overlay */}
      {personaSelectorOpen && <PersonaSelectorOverlay />}

      {/* Personal data dashboard slide-in */}
      {settingsPaneOpen && <PersonalDataDashboard />}
    </div>
  );
}
