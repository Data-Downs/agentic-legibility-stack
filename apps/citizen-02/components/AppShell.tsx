"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { AppHeader } from "./AppHeader";
import { PersonaPicker } from "./PersonaPicker";
import { Dashboard } from "./Dashboard";
import { DetailView } from "./DetailView";
import { ChatView } from "./ChatView";
import { PlanView } from "./PlanView";
import { TasksView } from "./TasksView";
import { MessageInput } from "./MessageInput";
import { ReasoningFab } from "./ReasoningPanel";
import { PersonaSelectorOverlay } from "./PersonaSelectorOverlay";
import { PersonalDataDashboard } from "./personal-data/PersonalDataDashboard";
import { Toast } from "./ui/Toast";
import { BottomSheet } from "./ui/BottomSheet";
import { AgentSelectionSheet } from "./sheets/AgentSelectionSheet";
import { TaskDetailSheet } from "./sheets/TaskDetailSheet";
import { TopicQuestionsSheet } from "./sheets/TopicQuestionsSheet";
import { FilingPromptSheet } from "./sheets/FilingPromptSheet";
import { PaymentSheet } from "./sheets/PaymentSheet";
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
      className={`flex flex-col items-center gap-0.5 flex-1 py-2 text-[11px] font-medium transition-colors touch-feedback ${
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
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200"
      style={{ paddingBottom: "var(--safe-area-bottom)" }}
    >
      <div className="max-w-[960px] mx-auto flex">
        <TabButton
          label="Home"
          active={currentView === "dashboard" || currentView === "detail" || currentView === "plan"}
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
          label="Dot"
          active={currentView === "chat"}
          onClick={() => navigateTo("chat")}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          }
        />
        <TabButton
          label="To do"
          active={currentView === "tasks"}
          onClick={() => navigateTo("tasks")}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
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

function BottomSheetLayer() {
  const bottomSheet = useAppStore((s) => s.bottomSheet);
  const closeBottomSheet = useAppStore((s) => s.closeBottomSheet);

  if (!bottomSheet.type) return null;

  const sheetContent = (() => {
    switch (bottomSheet.type) {
      case "agent-selection":
        return <AgentSelectionSheet />;
      case "task-detail":
        return <TaskDetailSheet data={bottomSheet.data} />;
      case "topic-questions":
        return <TopicQuestionsSheet data={bottomSheet.data} />;
      case "filing-prompt":
        return <FilingPromptSheet />;
      case "payment":
        return <PaymentSheet />;
      default:
        return null;
    }
  })();

  const title = (() => {
    switch (bottomSheet.type) {
      case "agent-selection":
        return "Choose your agent";
      case "task-detail":
        return "Task details";
      case "topic-questions":
        return (bottomSheet.data as { topic?: string })?.topic || "Questions";
      case "filing-prompt":
        return "Save conversation";
      case "payment":
        return "Apple Pay";
      default:
        return undefined;
    }
  })();

  return (
    <BottomSheet open={true} onClose={closeBottomSheet} title={title}>
      {sheetContent}
    </BottomSheet>
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
    const savedPersona = sessionStorage.getItem("c02_persona");
    const savedAgent = sessionStorage.getItem("c02_agent") as "dot" | "max" | null;

    if (savedAgent) {
      setAgent(savedAgent);
    }
    if (savedPersona) {
      setPersona(savedPersona);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // iOS keyboard offset
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const offset = window.innerHeight - vv.height;
      document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
    };

    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, []);

  const showInput =
    persona &&
    currentView !== "persona-picker" &&
    currentView !== "plan" &&
    currentView !== "tasks" &&
    !journeyComplete;

  return (
    <div className="h-screen flex flex-col bg-govuk-page-bg overflow-hidden">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-[100] focus:bg-govuk-yellow focus:text-govuk-black focus:px-4 focus:py-2 focus:text-sm focus:font-bold"
      >
        Skip to main content
      </a>

      <AppHeader />

      {/* Main content — the only scrollable area */}
      <main
        id="main-content"
        role="main"
        className="flex-1 overflow-y-auto flex flex-col min-h-0 pb-14"
      >
        <div
          className={`grow shrink-0 ${currentView === "chat" ? "flex flex-col min-h-0" : "max-w-[960px] mx-auto w-full px-4 py-6 pb-4"}`}
        >
          {currentView === "persona-picker" && <PersonaPicker />}
          {currentView === "dashboard" && <Dashboard />}
          {currentView === "detail" && <DetailView />}
          {currentView === "chat" && <ChatView />}
          {currentView === "plan" && <PlanView />}
          {currentView === "tasks" && <TasksView />}
        </div>

        {/* Chat input — in document flow, pushed to bottom on short pages */}
        {showInput && <MessageInput />}
      </main>

      {/* Bottom tab navigation */}
      {currentView !== "persona-picker" && <BottomTabBar />}

      {/* Reasoning FAB */}
      <ReasoningFab />

      {/* Bottom sheets */}
      <BottomSheetLayer />

      {/* Overlays */}
      {personaSelectorOpen && <PersonaSelectorOverlay />}
      {settingsPaneOpen && <PersonalDataDashboard />}

      {/* Toast */}
      <Toast />
    </div>
  );
}
