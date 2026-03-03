"use client";

import { useAppStore } from "@/lib/store";
import type { ServiceType } from "@/lib/types";

interface TopicQuestionsData {
  topic: string;
  questions: string[];
  service: string;
}

interface TopicQuestionsSheetProps {
  data: unknown;
}

export function TopicQuestionsSheet({ data }: TopicQuestionsSheetProps) {
  const closeBottomSheet = useAppStore((s) => s.closeBottomSheet);
  const navigateTo = useAppStore((s) => s.navigateTo);
  const startNewConversation = useAppStore((s) => s.startNewConversation);

  const topicData = data as TopicQuestionsData | null;
  if (!topicData) return null;

  const handleQuestionTap = (question: string) => {
    const service = topicData.service as ServiceType;
    startNewConversation(service);
    navigateTo("chat", service);
    closeBottomSheet();
    // Send the question after navigation
    setTimeout(() => {
      useAppStore.getState().sendMessage(question);
    }, 100);
  };

  return (
    <div className="space-y-1">
      <p className="text-sm text-govuk-dark-grey mb-3">
        Tap a question to start a conversation.
      </p>

      <div className="flex flex-col gap-2">
        {topicData.questions.map((question, i) => (
          <button
            key={i}
            onClick={() => handleQuestionTap(question)}
            className="flex items-center gap-3 w-full p-3.5 bg-gray-50 rounded-card text-left hover:bg-gray-100 transition-colors touch-feedback"
          >
            <svg
              className="shrink-0 text-govuk-blue"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="flex-1 text-sm text-govuk-black leading-snug">
              {question}
            </span>
            <svg className="shrink-0 text-govuk-mid-grey" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
