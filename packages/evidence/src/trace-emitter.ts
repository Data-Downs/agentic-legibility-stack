/**
 * TraceEmitter — Structured trace event emitter
 *
 * Creates properly structured trace events and optionally persists
 * them to the TraceStore. Used throughout the system to record
 * everything that happens.
 */

import type { TraceEvent, TraceEventType } from "@als/schemas";
import { TraceStore } from "./trace-store";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  sessionId: string;
  userId?: string;
  capabilityId?: string;
}

export class TraceEmitter {
  private store: TraceStore | null;

  constructor(store?: TraceStore) {
    this.store = store || null;
  }

  /** Create a new span context for a trace */
  startSpan(opts: {
    traceId: string;
    sessionId: string;
    userId?: string;
    capabilityId?: string;
    parentSpanId?: string;
  }): SpanContext {
    return {
      traceId: opts.traceId,
      spanId: `span_${generateId()}`,
      sessionId: opts.sessionId,
      userId: opts.userId,
      capabilityId: opts.capabilityId,
    };
  }

  /** Emit a trace event */
  emit(
    type: TraceEventType,
    span: SpanContext,
    payload: Record<string, unknown>,
    parentSpanId?: string
  ): TraceEvent {
    const event: TraceEvent = {
      id: `evt_${generateId()}`,
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId,
      timestamp: new Date().toISOString(),
      type,
      payload,
      metadata: {
        userId: span.userId,
        sessionId: span.sessionId,
        capabilityId: span.capabilityId,
      },
    };

    // Persist if store is connected
    if (this.store) {
      try {
        this.store.append(event);
      } catch (err) {
        console.error("[TraceEmitter] Failed to persist event:", err);
      }
    }

    return event;
  }

  /** Emit a batch of events (from CapabilityInvoker results, for example) */
  emitBatch(events: TraceEvent[]): void {
    if (this.store && events.length > 0) {
      try {
        this.store.appendBatch(events);
      } catch (err) {
        console.error("[TraceEmitter] Failed to persist batch:", err);
      }
    }
  }

  /** End a span by emitting a terminal event */
  endSpan(
    span: SpanContext,
    type: TraceEventType,
    payload: Record<string, unknown>
  ): TraceEvent {
    return this.emit(type, span, payload);
  }
}
