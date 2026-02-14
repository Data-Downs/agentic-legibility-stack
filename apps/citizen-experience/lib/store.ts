import { create } from "zustand";
import type {
  PersonaData,
  AgentType,
  ServiceType,
  ViewType,
  Conversation,
  StoredTask,
  ChatMessage,
  ChatApiResponse,
} from "./types";
import { SERVICE_TO_SCENARIO } from "./types";

interface AppStore {
  // Identity
  persona: string | null;
  agent: AgentType;
  personaData: PersonaData | null;
  enrichedData: Record<string, unknown> | null;

  // Navigation
  currentView: ViewType;
  currentService: ServiceType | null;
  viewHistory: Array<{ view: ViewType; service: ServiceType | null }>;

  // Chat
  conversationHistory: ChatMessage[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  currentReasoning: string;
  hasNewReasoning: boolean;
  isLoading: boolean;

  // Handoff
  activeHandoff: {
    triggered: boolean;
    reason?: string;
    description?: string;
    urgency?: string;
    routing?: Record<string, unknown>;
  } | null;

  // Actions
  setPersona: (id: string) => Promise<void>;
  setAgent: (agent: AgentType) => void;
  navigateTo: (view: ViewType, service?: ServiceType | null) => void;
  navigateBack: () => void;
  sendMessage: (text: string) => Promise<void>;
  startNewConversation: (service?: ServiceType | null) => void;
  loadConversation: (conversationId: string) => void;
  setReasoning: (reasoning: string) => void;
  clearReasoningBadge: () => void;
}

// localStorage-backed conversation store
function getConversations(personaId: string): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`conversations_${personaId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversation(personaId: string, conversation: Conversation) {
  if (typeof window === "undefined") return;
  const all = getConversations(personaId);
  const index = all.findIndex((c) => c.id === conversation.id);
  if (index >= 0) {
    all[index] = conversation;
  } else {
    all.unshift(conversation);
  }
  while (all.length > 20) all.pop();
  try {
    localStorage.setItem(`conversations_${personaId}`, JSON.stringify(all));
  } catch {
    all.pop();
    try {
      localStorage.setItem(`conversations_${personaId}`, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }
}

// localStorage-backed task store
function saveTasks(personaId: string, tasks: StoredTask[]) {
  if (typeof window === "undefined") return;
  while (tasks.length > 50) tasks.pop();
  try {
    localStorage.setItem(`tasks_${personaId}`, JSON.stringify(tasks));
  } catch {
    /* ignore */
  }
}

function getTasks(personaId: string): StoredTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`tasks_${personaId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export { getConversations, getTasks, saveTasks };

export const useAppStore = create<AppStore>((set, get) => ({
  persona: null,
  agent: "dot",
  personaData: null,
  enrichedData: null,
  currentView: "persona-picker",
  currentService: null,
  viewHistory: [],
  conversationHistory: [],
  activeConversationId: null,
  activeConversation: null,
  currentReasoning: "",
  hasNewReasoning: false,
  isLoading: false,
  activeHandoff: null,

  setPersona: async (id: string) => {
    set({
      persona: id,
      conversationHistory: [],
      currentReasoning: "",
      hasNewReasoning: false,
      currentService: null,
      viewHistory: [],
      activeConversationId: null,
      activeConversation: null,
      enrichedData: null,
    });

    if (typeof window !== "undefined") {
      sessionStorage.setItem("persona", id);
    }

    try {
      const response = await fetch(`/api/persona/${id}`);
      if (response.ok) {
        const data = await response.json();
        set({ personaData: data });
      }
    } catch (error) {
      console.error("Error loading persona:", error);
    }

    set({ currentView: "dashboard" });

    // Fetch enrichment in background
    fetch(`/api/enrich/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.enriched) {
          set({ enrichedData: data });
        }
      })
      .catch(() => {});
  },

  setAgent: (agent: AgentType) => {
    set({ agent });
    if (typeof window !== "undefined") {
      sessionStorage.setItem("agent", agent);
    }
  },

  navigateTo: (view: ViewType, service?: ServiceType | null) => {
    const state = get();
    if (state.currentView !== view) {
      set((s) => ({
        viewHistory: [
          ...s.viewHistory,
          { view: s.currentView, service: s.currentService },
        ],
      }));
    }
    set({
      currentView: view,
      currentService: service !== undefined ? service : get().currentService,
    });
  },

  navigateBack: () => {
    const state = get();
    if (state.viewHistory.length > 0) {
      const prev = state.viewHistory[state.viewHistory.length - 1];
      set({
        viewHistory: state.viewHistory.slice(0, -1),
        currentView: prev.view,
        currentService: prev.view === "dashboard" ? null : prev.service,
      });
    }
  },

  startNewConversation: (service?: ServiceType | null) => {
    set({
      conversationHistory: [],
      activeConversationId: null,
      activeConversation: null,
      currentReasoning: "",
      hasNewReasoning: false,
    });
    if (service !== undefined) {
      set({ currentService: service });
    }
  },

  loadConversation: (conversationId: string) => {
    const state = get();
    if (!state.persona) return;
    const conversations = getConversations(state.persona);
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) {
      set({
        activeConversationId: conv.id,
        activeConversation: conv,
        conversationHistory: conv.messages,
      });
    }
  },

  sendMessage: async (text: string) => {
    const state = get();
    if (!state.persona || !state.personaData || state.isLoading) return;

    const service = state.currentService || "driving";
    const scenario = SERVICE_TO_SCENARIO[service] || "driving";
    const isNewConversation = state.conversationHistory.length === 0;

    // Add user message to history
    const updatedHistory: ChatMessage[] = [
      ...state.conversationHistory,
      { role: "user", content: text },
    ];
    set({ conversationHistory: updatedHistory, isLoading: true });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: state.persona,
          agent: state.agent,
          scenario,
          messages: updatedHistory,
          generateTitle: isNewConversation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, string>;
        const detail = errorData.details || errorData.error || `HTTP ${response.status}`;
        throw new Error(`Chat request failed: ${detail}`);
      }

      const data: ChatApiResponse = await response.json();

      // Add assistant response
      const newHistory: ChatMessage[] = [
        ...updatedHistory,
        { role: "assistant", content: data.response },
      ];

      // Create or update conversation
      const conversationId =
        state.activeConversationId || `conv_${Date.now()}`;
      const conversation: Conversation = state.activeConversation
        ? {
            ...state.activeConversation,
            messages: newHistory,
            updatedAt: new Date().toISOString(),
          }
        : {
            id: conversationId,
            title: data.conversationTitle || "New conversation",
            service,
            agent: state.agent,
            scenario,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: newHistory,
          };

      if (data.conversationTitle && !state.activeConversation) {
        conversation.title = data.conversationTitle;
      }

      saveConversation(state.persona, conversation);

      // Save tasks
      if (data.tasks && data.tasks.length > 0) {
        const existingTasks = getTasks(state.persona);
        for (const task of data.tasks) {
          existingTasks.unshift({
            id: task.id,
            conversationId,
            service,
            description: task.description,
            detail: task.detail,
            type: task.type as "agent" | "user",
            status: "suggested",
            dueDate: task.dueDate,
            dataNeeded: task.dataNeeded,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        saveTasks(state.persona, existingTasks);
      }

      set({
        conversationHistory: newHistory,
        activeConversationId: conversationId,
        activeConversation: conversation,
        currentReasoning: data.reasoning,
        hasNewReasoning: true,
        isLoading: false,
        activeHandoff: data.handoff?.triggered ? data.handoff : null,
      });
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Something went wrong";
      const errorHistory: ChatMessage[] = [
        ...updatedHistory,
        { role: "assistant", content: `Something went wrong.\n\n${errorMessage}\n\nCheck that ANTHROPIC_API_KEY is set correctly in apps/citizen-experience/.env.local` },
      ];
      set({
        conversationHistory: errorHistory,
        isLoading: false,
      });
    }
  },

  setReasoning: (reasoning: string) => {
    set({ currentReasoning: reasoning, hasNewReasoning: true });
  },

  clearReasoningBadge: () => {
    set({ hasNewReasoning: false });
  },
}));
