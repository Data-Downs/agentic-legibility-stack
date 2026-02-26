"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { useAppStore } from "@/lib/store";

export function MessageInput() {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useAppStore((s) => s.sendMessage);
  const isLoading = useAppStore((s) => s.isLoading);
  const currentView = useAppStore((s) => s.currentView);
  const currentService = useAppStore((s) => s.currentService);
  const serviceName = useAppStore((s) => s.serviceName);
  const navigateTo = useAppStore((s) => s.navigateTo);
  const startNewConversation = useAppStore((s) => s.startNewConversation);

  const placeholder =
    currentView === "chat"
      ? "Message..."
      : currentView === "detail"
        ? `Ask about ${(serviceName || "this service").toLowerCase()}...`
        : "Ask a question about your services...";

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // If not in chat view, navigate to chat first
    if (currentView !== "chat") {
      startNewConversation(currentService);
      navigateTo("chat", currentService);
    }

    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage(trimmed);
  }, [text, isLoading, currentView, currentService, sendMessage, navigateTo, startNewConversation]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="border-t border-govuk-mid-grey bg-white px-4 py-3 safe-area-bottom">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none border border-govuk-mid-grey rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-govuk-yellow focus:border-govuk-black"
          aria-label="Message input"
        />
        <button
          type="submit"
          disabled={!text.trim() || isLoading}
          className="w-10 h-10 rounded-full bg-govuk-blue text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-govuk-dark-blue transition-colors shrink-0"
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
