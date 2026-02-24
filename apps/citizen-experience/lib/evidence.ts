/**
 * Singleton Evidence layer instances for the citizen-experience app.
 * TraceStore, TraceEmitter, and ReceiptGenerator are initialized once
 * and shared across all API routes.
 *
 * Environment-aware: tries D1Adapter (Cloudflare) first, falls back to
 * SqliteAdapter (local dev).
 *
 * IMPORTANT: SqliteAdapter (which depends on better-sqlite3, a native C++ module)
 * is imported dynamically only in the local dev fallback to prevent the bundler
 * from tracing it into the Cloudflare Workers bundle.
 */

import { TraceStore, TraceEmitter, ReceiptGenerator, CaseStore, D1Adapter } from "@als/evidence";
import type { DatabaseAdapter } from "@als/evidence";

let adapter: DatabaseAdapter | null = null;
let store: TraceStore | null = null;
let emitter: TraceEmitter | null = null;
let receiptGen: ReceiptGenerator | null = null;
let caseStore: CaseStore | null = null;
let initPromise: Promise<void> | null = null;

async function ensureInit(): Promise<void> {
  if (adapter) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Try Cloudflare D1 first — getCloudflareContext() will throw in non-CF envs
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { env } = getCloudflareContext();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = (env as any).DB;
      if (db) {
        adapter = new D1Adapter(db);
        console.log("[Evidence] D1Adapter initialized via getCloudflareContext()");
      }
    } catch {
      // Not on Cloudflare — fall through to SQLite
    }

    if (!adapter) {
      // Local dev: dynamically import SqliteAdapter from a separate entry point
      // to prevent the bundler from tracing better-sqlite3 (native C++ module)
      const path = await import("path");
      const { SqliteAdapter } = await import("@als/evidence/sqlite");
      const dbPath = path.join(process.cwd(), "data", "traces.db");
      adapter = await SqliteAdapter.create(dbPath);
      console.log(`[Evidence] SqliteAdapter initialized at ${dbPath}`);
    }

    store = new TraceStore(adapter);
    caseStore = new CaseStore(adapter);

    // On D1, tables are created by migrations — skip init().
    // On SQLite, init() creates tables if they don't exist.
    if (adapter instanceof D1Adapter) {
      console.log("[Evidence] Skipping init() — tables created by D1 migration");
    } else {
      await store.init();
      await caseStore.init();
    }

    emitter = new TraceEmitter(store, caseStore);
    receiptGen = new ReceiptGenerator(store);
  })();

  return initPromise;
}

export async function getTraceStore(): Promise<TraceStore> {
  await ensureInit();
  return store!;
}

export async function getTraceEmitter(): Promise<TraceEmitter> {
  await ensureInit();
  return emitter!;
}

export async function getReceiptGenerator(): Promise<ReceiptGenerator> {
  await ensureInit();
  return receiptGen!;
}

export async function getCaseStore(): Promise<CaseStore> {
  await ensureInit();
  return caseStore!;
}
