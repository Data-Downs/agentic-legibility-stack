import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "./store";

describe("useAppStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      persona: null,
      agent: "dot",
      serviceMode: "mcp",
      personaData: null,
      enrichedData: null,
      currentView: "persona-picker",
      currentService: null,
      serviceName: null,
      viewHistory: [],
      conversationHistory: [],
      activeConversationId: null,
      activeConversation: null,
      currentReasoning: "",
      hasNewReasoning: false,
      isLoading: false,
      activeHandoff: null,
      ucState: null,
      ucStateHistory: [],
      lastUcStateInfo: null,
      pendingConsent: [],
      consentDecisions: {},
      consentSubmitted: false,
      lastResponseTasks: [],
      taskCompletions: {},
      tasksSubmitted: false,
      interactionType: null,
      pendingCards: [],
      cardsSubmitted: false,
      activePlanId: null,
      activePlan: null,
      settingsPaneOpen: false,
      personaSelectorOpen: false,
      bottomSheet: { type: null },
      toast: null,
    });
    localStorage.clear();
  });

  describe("navigateTo", () => {
    it("pushes current state to viewHistory and sets new view", () => {
      const store = useAppStore.getState();
      store.navigateTo("dashboard");

      const state = useAppStore.getState();
      expect(state.currentView).toBe("dashboard");
      expect(state.viewHistory).toHaveLength(1);
      expect(state.viewHistory[0].view).toBe("persona-picker");
    });

    it("sets service and serviceName when provided", () => {
      const store = useAppStore.getState();
      store.navigateTo("chat", "driving", "Renew Licence");

      const state = useAppStore.getState();
      expect(state.currentView).toBe("chat");
      expect(state.currentService).toBe("driving");
      expect(state.serviceName).toBe("Renew Licence");
    });

    it("does not push to history when navigating to same view", () => {
      useAppStore.setState({ currentView: "dashboard" });
      useAppStore.getState().navigateTo("dashboard");

      expect(useAppStore.getState().viewHistory).toHaveLength(0);
    });
  });

  describe("navigateBack", () => {
    it("pops history and restores previous state", () => {
      useAppStore.setState({
        currentView: "chat",
        currentService: "driving",
        serviceName: "Test",
        viewHistory: [
          { view: "dashboard", service: null, serviceName: null },
        ],
      });

      useAppStore.getState().navigateBack();

      const state = useAppStore.getState();
      expect(state.currentView).toBe("dashboard");
      expect(state.currentService).toBeNull();
      expect(state.serviceName).toBeNull();
      expect(state.viewHistory).toHaveLength(0);
    });

    it("does nothing when history is empty", () => {
      useAppStore.setState({ currentView: "chat", viewHistory: [] });
      useAppStore.getState().navigateBack();
      expect(useAppStore.getState().currentView).toBe("chat");
    });
  });

  describe("startNewConversation", () => {
    it("resets chat state", () => {
      useAppStore.setState({
        conversationHistory: [{ role: "user", content: "hi" }],
        activeConversationId: "conv_123",
        ucState: "some_state",
        ucStateHistory: ["prev"],
        pendingConsent: [{ id: "c1", description: "test", data_shared: [] }] as never[],
        consentDecisions: { c1: "granted" },
        consentSubmitted: true,
        lastResponseTasks: [{ id: "t1" }] as never[],
        taskCompletions: { t1: "done" },
        tasksSubmitted: true,
        pendingCards: [{ id: "card1" }] as never[],
        cardsSubmitted: true,
      });

      useAppStore.getState().startNewConversation();

      const state = useAppStore.getState();
      expect(state.conversationHistory).toEqual([]);
      expect(state.activeConversationId).toBeNull();
      expect(state.ucState).toBeNull();
      expect(state.ucStateHistory).toEqual([]);
      expect(state.pendingConsent).toEqual([]);
      expect(state.consentDecisions).toEqual({});
      expect(state.consentSubmitted).toBe(false);
      expect(state.lastResponseTasks).toEqual([]);
      expect(state.taskCompletions).toEqual({});
      expect(state.tasksSubmitted).toBe(false);
      expect(state.pendingCards).toEqual([]);
      expect(state.cardsSubmitted).toBe(false);
    });

    it("sets service when provided", () => {
      useAppStore.getState().startNewConversation("benefits", "Apply UC");
      const state = useAppStore.getState();
      expect(state.currentService).toBe("benefits");
      expect(state.serviceName).toBe("Apply UC");
    });
  });

  describe("setTaskCompletion / clearTaskCompletion", () => {
    it("sets a task completion", () => {
      useAppStore.getState().setTaskCompletion("task1", "Done with task 1");
      expect(useAppStore.getState().taskCompletions).toEqual({
        task1: "Done with task 1",
      });
    });

    it("clears a task completion", () => {
      useAppStore.setState({ taskCompletions: { task1: "done", task2: "done" } });
      useAppStore.getState().clearTaskCompletion("task1");
      expect(useAppStore.getState().taskCompletions).toEqual({ task2: "done" });
    });
  });

  describe("setConsentDecision / clearConsentDecision", () => {
    it("sets a consent decision", () => {
      useAppStore.getState().setConsentDecision("grant1", "granted");
      expect(useAppStore.getState().consentDecisions).toEqual({
        grant1: "granted",
      });
    });

    it("clears a consent decision", () => {
      useAppStore.setState({
        consentDecisions: { grant1: "granted", grant2: "denied" },
      });
      useAppStore.getState().clearConsentDecision("grant1");
      expect(useAppStore.getState().consentDecisions).toEqual({
        grant2: "denied",
      });
    });
  });

  describe("setPersona", () => {
    it("fetches persona data and navigates to dashboard", async () => {
      const mockPersonaData = {
        personaId: "emma",
        personaName: "Emma Parker",
        primaryContact: { firstName: "Emma", lastName: "Parker" },
      };

      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockPersonaData),
          })
          .mockResolvedValueOnce({
            json: () => Promise.resolve({}),
          })
      );

      await useAppStore.getState().setPersona("emma");

      const state = useAppStore.getState();
      expect(state.persona).toBe("emma");
      expect(state.personaData).toEqual(mockPersonaData);
      expect(state.currentView).toBe("dashboard");

      vi.unstubAllGlobals();
    });
  });

  describe("showToast", () => {
    it("sets toast message", () => {
      useAppStore.getState().showToast("Hello!");
      expect(useAppStore.getState().toast).toMatchObject({ text: "Hello!" });
    });
  });

  describe("UI toggles", () => {
    it("setSettingsPaneOpen", () => {
      useAppStore.getState().setSettingsPaneOpen(true);
      expect(useAppStore.getState().settingsPaneOpen).toBe(true);
    });

    it("setPersonaSelectorOpen", () => {
      useAppStore.getState().setPersonaSelectorOpen(true);
      expect(useAppStore.getState().personaSelectorOpen).toBe(true);
    });

    it("openBottomSheet / closeBottomSheet", () => {
      useAppStore.getState().openBottomSheet("task-detail", { id: "t1" });
      expect(useAppStore.getState().bottomSheet).toEqual({
        type: "task-detail",
        data: { id: "t1" },
      });
      useAppStore.getState().closeBottomSheet();
      expect(useAppStore.getState().bottomSheet).toEqual({ type: null });
    });
  });
});
