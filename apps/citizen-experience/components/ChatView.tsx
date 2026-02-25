"use client";

import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useAppStore } from "@/lib/store";
import HandoffNotice from "./handoff/HandoffNotice";
import { TaskCard } from "./TaskCard";
import { TaskSummaryCard } from "./TaskSummaryCard";
import { ConsentPanel } from "./ConsentCard";
import { ConsentSummaryCard } from "./ConsentSummaryCard";
import { StateProgressTracker } from "./StateProgressTracker";
import { JourneyCompleteCard } from "./JourneyCompleteCard";

const TERMINAL_STATES = new Set(["claim-active", "rejected", "handed-off"]);

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 bg-govuk-mid-grey rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ChatView() {
  const conversationHistory = useAppStore((s) => s.conversationHistory);
  const isLoading = useAppStore((s) => s.isLoading);
  const activeHandoff = useAppStore((s) => s.activeHandoff);
  const ucState = useAppStore((s) => s.ucState);
  const ucStateHistory = useAppStore((s) => s.ucStateHistory);
  const pendingConsent = useAppStore((s) => s.pendingConsent);
  const consentDecisions = useAppStore((s) => s.consentDecisions);
  const consentSubmitted = useAppStore((s) => s.consentSubmitted);
  const lastResponseTasks = useAppStore((s) => s.lastResponseTasks);
  const taskCompletions = useAppStore((s) => s.taskCompletions);
  const tasksSubmitted = useAppStore((s) => s.tasksSubmitted);
  const currentService = useAppStore((s) => s.currentService);
  const lastAssistantRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derived consent state
  const hasRequiredDenials = pendingConsent
    .filter((g) => g.required)
    .some((g) => consentDecisions[g.id] === "denied");

  // Derived task state
  const allTasksCompleted = lastResponseTasks.length > 0 &&
    lastResponseTasks.every((t) => taskCompletions[t.id] !== undefined);

  // Derived consent state — all grants have a decision
  const allConsentsDecided = pendingConsent.length > 0 &&
    pendingConsent.every((g) => consentDecisions[g.id] !== undefined);

  // Whether to show task cards (after the last assistant message)
  const showTasks = !isLoading && lastResponseTasks.length > 0 && !tasksSubmitted;
  // Whether to show consent cards (after tasks are done or when no tasks)
  const showConsent = !isLoading && pendingConsent.length > 0 && !consentSubmitted &&
    (lastResponseTasks.length === 0 || tasksSubmitted);

  // Scroll to the top of the last assistant message when new content arrives
  const scrollToLastAssistant = () => {
    lastAssistantRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Scroll to bottom to reveal cards (consent, task summary, etc.)
  const scrollToEnd = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isLoading && (showTasks || showConsent)) {
      scrollToEnd();
    } else {
      scrollToLastAssistant();
    }
  }, [conversationHistory, isLoading, activeHandoff, ucState, showTasks, showConsent]);

  useEffect(() => {
    if (allTasksCompleted && !tasksSubmitted) {
      scrollToEnd();
    }
  }, [allTasksCompleted, tasksSubmitted]);

  useEffect(() => {
    if (allConsentsDecided && !consentSubmitted) {
      scrollToEnd();
    }
  }, [allConsentsDecided, consentSubmitted]);

  // Find the index of the last assistant message (for scroll ref)
  const lastAssistantIdx = conversationHistory.reduce(
    (acc, msg, idx) => (msg.role === "assistant" ? idx : acc),
    -1,
  );

  return (
    <div className="flex flex-col h-full">
      {/* State Progress Tracker — shown when in a UC journey */}
      {ucState && (
        <StateProgressTracker
          currentState={ucState}
          stateHistory={ucStateHistory}
          service={currentService}
        />
      )}

      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        role="log"
        aria-live="polite"
      >
        {conversationHistory.length === 0 && !isLoading && (
          <div className="text-center text-govuk-dark-grey py-12">
            <svg
              className="mx-auto mb-3 opacity-40"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-sm">
              Type a message below to start a conversation.
            </p>
          </div>
        )}

        {/* Message bubbles */}
        {conversationHistory.map((msg, idx) => {
          if (typeof msg.content !== "string") return null;

          const isUser = msg.role === "user";
          const isLastAssistant = idx === lastAssistantIdx;

          return (
            <div key={idx} ref={isLastAssistant ? lastAssistantRef : undefined}>
              <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? "bg-govuk-blue text-white rounded-br-sm whitespace-pre-wrap"
                      : "bg-govuk-light-grey text-govuk-black rounded-bl-sm prose prose-sm prose-neutral max-w-none"
                  }`}
                >
                  {isUser ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                </div>
              </div>
            </div>
          );
        })}

        {/* Task cards — rendered outside the message loop for reliability */}
        {showTasks && (
          <div className="max-w-[85%] mt-1">
            {lastResponseTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                completion={taskCompletions[task.id]}
                onComplete={(id, message) => {
                  useAppStore.getState().setTaskCompletion(id, message);
                }}
                onReset={(id) => {
                  useAppStore.getState().clearTaskCompletion(id);
                }}
                disabled={isLoading}
              />
            ))}

            {/* Summary card appears when all tasks are completed */}
            {allTasksCompleted && (
              <TaskSummaryCard
                tasks={lastResponseTasks}
                completions={taskCompletions}
                onChangeTask={(id) => {
                  useAppStore.getState().clearTaskCompletion(id);
                }}
                onSubmit={() => useAppStore.getState().submitTasks()}
                isSubmitting={isLoading}
              />
            )}
          </div>
        )}

        {/* Consent panel — single grouped card for all grants */}
        {showConsent && (
          <div className="max-w-[85%] mt-1">
            <ConsentPanel
              grants={pendingConsent}
              decisions={consentDecisions}
              onDecision={(id, decision) => {
                useAppStore.getState().setConsentDecision(id, decision);
              }}
              disabled={isLoading}
            />

            {/* Summary card appears when all consents are decided */}
            {allConsentsDecided && (
              <ConsentSummaryCard
                grants={pendingConsent}
                decisions={consentDecisions}
                onSubmit={() => useAppStore.getState().submitConsent()}
                onChangeDecision={(id) => {
                  useAppStore.getState().clearConsentDecision(id);
                }}
                hasRequiredDenials={hasRequiredDenials}
                isSubmitting={isLoading}
              />
            )}
          </div>
        )}

        {/* Handoff notice */}
        {activeHandoff && activeHandoff.triggered && (
          <div className="max-w-[85%]">
            <HandoffNotice
              urgency={(activeHandoff.urgency as "routine" | "priority" | "urgent" | "safeguarding") || "routine"}
              reason={activeHandoff.description || "The agent has determined you should speak to a person."}
              department={(activeHandoff.routing?.department as string) || "Government service"}
              phone={(activeHandoff.routing?.suggestedQueue as string) || undefined}
              onDismiss={() => useAppStore.setState({ activeHandoff: null })}
            />
          </div>
        )}

        {/* Journey complete card — shown when state is terminal */}
        {!isLoading && ucState && TERMINAL_STATES.has(ucState) && (
          <div className="max-w-[85%] mt-1">
            <JourneyCompleteCard state={ucState as "claim-active" | "rejected" | "handed-off"} />
          </div>
        )}

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
