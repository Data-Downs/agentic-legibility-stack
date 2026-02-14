/**
 * ReceiptGenerator — Creates citizen-facing receipts from invocation results
 *
 * Every significant interaction with a government service produces a receipt.
 * Citizens can review these receipts to understand what happened, what data
 * was shared, and what the outcome was.
 */

import type { Receipt, InvocationResult } from "@als/schemas";
import { TraceStore } from "./trace-store";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class ReceiptGenerator {
  private store: TraceStore | null;

  constructor(store?: TraceStore) {
    this.store = store || null;
  }

  /** Create a receipt from an invocation result */
  fromInvocationResult(
    result: InvocationResult,
    citizen: { id: string; name?: string },
    traceId: string
  ): Receipt {
    const receipt: Receipt = {
      id: `rcpt_${generateId()}`,
      traceId,
      capabilityId: result.capabilityId,
      timestamp: new Date().toISOString(),
      citizen,
      action: `Invoked ${result.capabilityId}`,
      outcome: result.success ? "success" : "failure",
      details: {
        ...(result.error ? { error: result.error } : {}),
        eventCount: result.traceEvents.length,
      },
      stateTransition: result.stateTransition,
    };

    // Persist if store is connected
    if (this.store) {
      try {
        this.store.storeReceipt(receipt);
      } catch (err) {
        console.error("[ReceiptGenerator] Failed to persist receipt:", err);
      }
    }

    return receipt;
  }

  /** Create a receipt for a custom action (not from an invocation) */
  create(opts: {
    traceId: string;
    capabilityId: string;
    citizen: { id: string; name?: string };
    action: string;
    outcome: Receipt["outcome"];
    details?: Record<string, unknown>;
    dataShared?: string[];
  }): Receipt {
    const receipt: Receipt = {
      id: `rcpt_${generateId()}`,
      traceId: opts.traceId,
      capabilityId: opts.capabilityId,
      timestamp: new Date().toISOString(),
      citizen: opts.citizen,
      action: opts.action,
      outcome: opts.outcome,
      details: opts.details || {},
      dataShared: opts.dataShared,
    };

    if (this.store) {
      try {
        this.store.storeReceipt(receipt);
      } catch (err) {
        console.error("[ReceiptGenerator] Failed to persist receipt:", err);
      }
    }

    return receipt;
  }
}
