/**
 * Singleton Personal Data layer for the citizen-experience app.
 * Follows the same pattern as lib/evidence.ts: lazy init, D1 detection, SqliteAdapter fallback.
 */

import { D1Adapter } from "@als/evidence";
import type { DatabaseAdapter } from "@als/evidence";
import { SubmittedStore, InferredStore, ServiceAccessStore } from "@als/personal-data";

let adapter: DatabaseAdapter | null = null;
let submittedStore: SubmittedStore | null = null;
let inferredStore: InferredStore | null = null;
let serviceAccessStore: ServiceAccessStore | null = null;
let initPromise: Promise<void> | null = null;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS submitted_data (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_value TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'persona',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, field_key)
);
CREATE TABLE IF NOT EXISTS inferred_data (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_value TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'inferred',
  source TEXT NOT NULL DEFAULT 'conversation',
  session_id TEXT,
  extracted_from TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS service_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  data_tier TEXT NOT NULL DEFAULT 'tier2',
  purpose TEXT,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  consent_record_id TEXT
);
CREATE TABLE IF NOT EXISTS data_updates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  update_type TEXT NOT NULL DEFAULT 'edit',
  services_notified TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

async function ensureInit(): Promise<void> {
  if (adapter) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Try Cloudflare D1 first
      try {
        const { getCloudflareContext } = await import("@opennextjs/cloudflare");
        const { env } = getCloudflareContext();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = (env as any).PERSONAL_DATA_DB;
        if (db) {
          adapter = new D1Adapter(db);
          console.log("[PersonalData] D1Adapter initialized");
        }
      } catch {
        // Not on Cloudflare
      }

      if (!adapter) {
        const path = await import("path");
        const { SqliteAdapter } = await import("@als/evidence/sqlite");
        const dbPath = path.join(process.cwd(), "data", "personal-data.db");
        adapter = await SqliteAdapter.create(dbPath);
        console.log(`[PersonalData] SqliteAdapter initialized at ${dbPath}`);
      }

      // On D1, tables are created by migrations. On SQLite, create inline.
      if (!(adapter instanceof D1Adapter)) {
        await adapter.exec(INIT_SQL);
      }

      submittedStore = new SubmittedStore(adapter);
      inferredStore = new InferredStore(adapter);
      serviceAccessStore = new ServiceAccessStore(adapter);
    } catch (err) {
      initPromise = null;
      adapter = null;
      throw err;
    }
  })();

  return initPromise;
}

export async function getPersonalDataAdapter(): Promise<DatabaseAdapter> {
  await ensureInit();
  return adapter!;
}

export async function getSubmittedStore(): Promise<SubmittedStore> {
  await ensureInit();
  return submittedStore!;
}

export async function getInferredStore(): Promise<InferredStore> {
  await ensureInit();
  return inferredStore!;
}

export async function getServiceAccessStore(): Promise<ServiceAccessStore> {
  await ensureInit();
  return serviceAccessStore!;
}
