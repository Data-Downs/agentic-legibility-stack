/**
 * StateMachine — Tracks the state of a service interaction
 *
 * Each service has a defined set of states and transitions.
 * The state machine enforces that only valid transitions occur
 * and records every transition as a trace event.
 */

import type { StateModelDefinition, TransitionResult } from "@als/schemas";

export class StateMachine {
  private definition: StateModelDefinition;
  private currentState: string;

  constructor(definition: StateModelDefinition) {
    this.definition = definition;
    // Find the initial state
    const initial = definition.states.find((s) => s.type === "initial");
    this.currentState = initial ? initial.id : definition.states[0]?.id || "unknown";
  }

  /** Get the current state ID */
  getState(): string {
    return this.currentState;
  }

  /** Get all allowed transitions from the current state */
  allowedTransitions(): Array<{ to: string; trigger?: string }> {
    return this.definition.transitions
      .filter((t) => t.from === this.currentState)
      .map((t) => ({ to: t.to, trigger: t.trigger }));
  }

  /** Attempt a state transition */
  transition(trigger: string): TransitionResult {
    const available = this.definition.transitions.find(
      (t) => t.from === this.currentState && t.trigger === trigger
    );

    if (!available) {
      return {
        success: false,
        fromState: this.currentState,
        toState: this.currentState,
        trigger,
        error: `No transition from '${this.currentState}' with trigger '${trigger}'`,
      };
    }

    const fromState = this.currentState;
    this.currentState = available.to;

    return {
      success: true,
      fromState,
      toState: this.currentState,
      trigger,
    };
  }

  /** Check if the current state is a terminal state */
  isTerminal(): boolean {
    const state = this.definition.states.find((s) => s.id === this.currentState);
    return state?.type === "terminal";
  }

  /** Check if the current state requires a receipt */
  requiresReceipt(): boolean {
    const state = this.definition.states.find((s) => s.id === this.currentState);
    return state?.receipt === true;
  }

  /** Set the current state directly (used to restore state from client) */
  setState(stateId: string): void {
    const exists = this.definition.states.find((s) => s.id === stateId);
    if (exists) {
      this.currentState = stateId;
    }
  }

  /** Reset to initial state */
  reset(): void {
    const initial = this.definition.states.find((s) => s.type === "initial");
    this.currentState = initial ? initial.id : this.definition.states[0]?.id || "unknown";
  }
}
