"use client";

import { useAppStore, getConversations } from "@/lib/store";
import type { ServiceType } from "@/lib/types";
import { HeroCarousel } from "./dashboard/HeroCarousel";
import { UnifiedTimeline } from "./dashboard/UnifiedTimeline";
import { TopicList } from "./detail/TopicList";

export function DetailView() {
  const personaData = useAppStore((s) => s.personaData);
  const persona = useAppStore((s) => s.persona);
  const currentService = useAppStore((s) => s.currentService);
  const serviceName = useAppStore((s) => s.serviceName);
  const navigateTo = useAppStore((s) => s.navigateTo);
  const startNewConversation = useAppStore((s) => s.startNewConversation);
  const openBottomSheet = useAppStore((s) => s.openBottomSheet);

  if (!personaData || !currentService) return null;

  const conversations = persona
    ? getConversations(persona).filter((c) => c.service === currentService).slice(0, 5)
    : [];

  return (
    <div className="max-w-lg mx-auto">
      {/* Hero carousel filtered to this service */}
      <HeroCarousel
        personaData={personaData}
        filterService={currentService}
        onCardTap={() => {
          startNewConversation(currentService, serviceName);
          navigateTo("chat", currentService, serviceName);
        }}
      />

      {/* CTA block */}
      <div className="bg-white rounded-card shadow-sm p-4 mb-5">
        <button
          onClick={() => {
            startNewConversation(currentService, serviceName);
            navigateTo("chat", currentService, serviceName);
          }}
          className="w-full py-3 rounded-full font-bold text-sm text-white bg-govuk-blue hover:bg-blue-800 transition-colors touch-feedback"
        >
          Ask about {serviceName || currentService}
        </button>
      </div>

      {/* Topic list */}
      <TopicList service={currentService} />

      {/* Service-filtered timeline */}
      <UnifiedTimeline
        personaData={personaData}
        persona={persona}
        filterService={currentService}
        maxItems={4}
        onItemTap={(item) => openBottomSheet("task-detail", item)}
        onSeeAll={() => navigateTo("tasks")}
      />

      {/* Conversations for this service */}
      {conversations.length > 0 && (
        <div className="mb-5">
          <h3 className="text-base font-extrabold text-govuk-black mb-3">Conversations</h3>
          <div className="flex flex-col gap-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  useAppStore.getState().loadConversation(conv.id);
                  navigateTo("chat", conv.service as ServiceType);
                }}
                className="flex items-center gap-3 w-full p-3 bg-white rounded-card shadow-sm hover:shadow-md transition-all text-left touch-feedback"
              >
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{conv.title}</span>
                  <span className="text-xs text-govuk-dark-grey">
                    {new Date(conv.updatedAt).toLocaleDateString("en-GB")} — {conv.messages.length} messages
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
