/**
 * TraceEmitter — Structured trace event emitter
 *
 * Creates properly structured trace events and optionally persists
 * them to the TraceStore. Used throughout the system to record
 * everything that happens.
 */

import type { TraceEvent, TraceEventType } from "@als/schemas";
import { TraceStore } from "./trace-store";
import { CaseStore } from "./case-store";

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

/** Event types that should update the ledger case */
const LEDGER_EVENT_TYPES: Set<string> = new Set([
  "state.transition",
  "consent.granted",
  "consent.denied",
  "policy.evaluated",
  "handoff.initiated",
  "capability.invoked",
  "llm.request",
  "llm.response",
  "credential.presented",
  "receipt.issued",
]);

export class TraceEmitter {
  private store: TraceStore | null;
  private caseStore: CaseStore | null;
  private totalStatesMap: Record<string, number>;

  constructor(store?: TraceStore, caseStore?: CaseStore) {
    this.store = store || null;
    this.caseStore = caseStore || null;
    this.totalStatesMap = {};
  }

  /** Register the total number of states for a service (used for progress calculation) */
  setTotalStates(serviceId: string, total: number): void {
    this.totalStatesMap[serviceId] = total;
  }

  /** Get or create the CaseStore (lazily from the TraceStore's DB) */
  getCaseStore(): CaseStore | null {
    if (this.caseStore) return this.caseStore;
    if (this.store) {
      this.caseStore = new CaseStore(this.store.getDatabase());
      return this.caseStore;
    }
    return null;
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

    // Update ledger case if this is a ledger-relevant event
    this.updateLedger(event);

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

    // Update ledger for each event in the batch
    for (const event of events) {
      this.updateLedger(event);
    }
  }

  /** Update ledger case if this is a relevant event */
  private updateLedger(event: TraceEvent): void {
    if (!LEDGER_EVENT_TYPES.has(event.type)) return;

    const cs = this.getCaseStore();
    if (!cs) return;

    try {
      const serviceId = event.metadata.capabilityId || (event.payload.serviceId as string);
      const totalStates = serviceId ? this.totalStatesMap[serviceId] : undefined;
      cs.upsertCase(event, totalStates);
    } catch (err) {
      console.error("[TraceEmitter] Failed to update ledger case:", err);
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
