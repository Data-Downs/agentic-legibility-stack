/**
 * ReplayEngine — Steps through a recorded trace for inspection
 *
 * Used in the Legibility Studio to replay agent interactions
 * step by step, forward and backward.
 */

import type { TraceEvent } from "@als/schemas";

export class ReplayEngine {
  private events: TraceEvent[] = [];
  private currentIndex = -1;

  /** Load events for replay (must be sorted by timestamp) */
  load(events: TraceEvent[]): void {
    this.events = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    this.currentIndex = -1;
  }

  /** Step forward to the next event */
  step(): { event: TraceEvent; index: number; total: number } | null {
    if (this.currentIndex >= this.events.length - 1) return null;
    this.currentIndex++;
    return {
      event: this.events[this.currentIndex],
      index: this.currentIndex,
      total: this.events.length,
    };
  }

  /** Step backward to the previous event */
  stepBack(): { event: TraceEvent; index: number; total: number } | null {
    if (this.currentIndex <= 0) return null;
    this.currentIndex--;
    return {
      event: this.events[this.currentIndex],
      index: this.currentIndex,
      total: this.events.length,
    };
  }

  /** Jump to a specific event index */
  jumpTo(index: number): { event: TraceEvent; index: number; total: number } | null {
    if (index < 0 || index >= this.events.length) return null;
    this.currentIndex = index;
    return {
      event: this.events[this.currentIndex],
      index: this.currentIndex,
      total: this.events.length,
    };
  }

  /** Get the current event */
  current(): TraceEvent | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.events.length) return null;
    return this.events[this.currentIndex];
  }

  /** Get all events up to and including the current position */
  eventsToHere(): TraceEvent[] {
    if (this.currentIndex < 0) return [];
    return this.events.slice(0, this.currentIndex + 1);
  }

  /** Get the total number of events */
  get length(): number {
    return this.events.length;
  }

  /** Get the current position */
  get position(): number {
    return this.currentIndex;
  }

  /** Reset to the beginning */
  reset(): void {
    this.currentIndex = -1;
  }
}
