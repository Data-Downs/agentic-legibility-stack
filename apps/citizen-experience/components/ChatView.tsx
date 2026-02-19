"use client";

import { useRef, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import HandoffNotice from "./handoff/HandoffNotice";
import { TaskCard } from "./TaskCard";
import { ConsentCard } from "./ConsentCard";
import { ConsentSummaryCard } from "./ConsentSummaryCard";
import { StateProgressTracker } from "./StateProgressTracker";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derived consent state
  const allConsentsActioned = pendingConsent.length > 0 &&
    pendingConsent.every((g) => consentDecisions[g.id] !== undefined);
  const hasRequiredDenials = pendingConsent
    .filter((g) => g.required)
    .some((g) => consentDecisions[g.id] === "denied");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, isLoading, activeHandoff, ucState]);

  // Scroll when summary card appears
  useEffect(() => {
    if (allConsentsActioned && !consentSubmitted) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [allConsentsActioned, consentSubmitted]);

  // Find the index of the last assistant message
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

        {conversationHistory.map((msg, idx) => {
          if (typeof msg.content !== "string") return null;

          const isUser = msg.role === "user";
          const isLastAssistant = idx === lastAssistantIdx;

          return (
            <div key={idx}>
              {/* Message bubble */}
              <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? "bg-govuk-blue text-white rounded-br-sm"
                      : "bg-govuk-light-grey text-govuk-black rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>

              {/* Task cards — shown after the last assistant message, gated by !isLoading */}
              {isLastAssistant && !isLoading && (
                <div className="max-w-[85%] mt-1">
                  {lastResponseTasks.length > 0 && lastResponseTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onAccept={() => {
                        const msg = task.type === "user"
                          ? `I've done it — ${task.description.toLowerCase()}`
                          : `Yes, please go ahead — ${task.description.toLowerCase()}`;
                        useAppStore.getState().sendMessage(msg);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Consent cards — SEPARATE block, NOT gated by !isLoading so they stay visible during submission */}
              {isLastAssistant && pendingConsent.length > 0 && !consentSubmitted && (
                <div className="max-w-[85%] mt-1">
                  {pendingConsent.map((grant) => (
                    <ConsentCard
                      key={grant.id}
                      grant={grant}
                      decision={consentDecisions[grant.id]}
                      onDecision={(id, decision) => {
                        useAppStore.getState().setConsentDecision(id, decision);
                      }}
                      onReset={(id) => {
                        useAppStore.getState().clearConsentDecision(id);
                      }}
                      disabled={isLoading}
                    />
                  ))}

                  {/* Summary card appears when all decisions are made */}
                  {allConsentsActioned && (
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
            </div>
          );
        })}

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

        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
