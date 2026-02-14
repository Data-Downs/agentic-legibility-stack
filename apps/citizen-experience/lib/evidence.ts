/**
 * Singleton Evidence layer instances for the citizen-experience app.
 * TraceStore, TraceEmitter, and ReceiptGenerator are initialized once
 * and shared across all API routes.
 */

import { TraceStore, TraceEmitter, ReceiptGenerator } from "@als/evidence";
import path from "path";

let store: TraceStore | null = null;
let emitter: TraceEmitter | null = null;
let receiptGen: ReceiptGenerator | null = null;

function initStore(): TraceStore {
  if (!store) {
    const dbPath = path.join(process.cwd(), "data", "traces.db");
    store = new TraceStore(dbPath);
    console.log(`[Evidence] TraceStore initialized at ${dbPath}`);
  }
  return store;
}

export function getTraceStore(): TraceStore {
  return initStore();
}

export function getTraceEmitter(): TraceEmitter {
  if (!emitter) {
    emitter = new TraceEmitter(initStore());
  }
  return emitter;
}

export function getReceiptGenerator(): ReceiptGenerator {
  if (!receiptGen) {
    receiptGen = new ReceiptGenerator(initStore());
  }
  return receiptGen;
}
