/**
 * Singleton Service Store instances for the Legibility Studio.
 * ServiceArtefactStore and ServiceGraphStore are initialized once
 * and shared across all API routes.
 *
 * Environment-aware: tries D1Adapter (Cloudflare) first, falls back to
 * SqliteAdapter (local dev).
 *
 * Auto-seeds from @als/service-graph + filesystem on first run if DB is empty.
 */

import {
  ServiceArtefactStore,
  ServiceGraphStore,
  seedServiceStore,
  D1Adapter,
} from "./service-store-imports";
import type { DatabaseAdapter } from "@als/evidence";

let adapter: DatabaseAdapter | null = null;
let artefactStore: ServiceArtefactStore | null = null;
let graphStore: ServiceGraphStore | null = null;
let initPromise: Promise<void> | null = null;

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
        const db = (env as any).SERVICE_STORE_DB;
        if (db) {
          adapter = new D1Adapter(db);
          console.log("[ServiceStore] D1Adapter initialized via getCloudflareContext()");
        }
      } catch {
        // Not on Cloudflare — fall through to SQLite
      }

      let isD1 = false;
      if (!adapter) {
        const path = await import("path");
        const { SqliteAdapter } = await import("@als/evidence/sqlite");
        const dbPath = path.join(process.cwd(), "..", "..", "data", "services.db");
        adapter = await SqliteAdapter.create(dbPath);
        console.log(`[ServiceStore] SqliteAdapter initialized at ${dbPath}`);
      } else {
        isD1 = true;
      }

      artefactStore = new ServiceArtefactStore(adapter);
      graphStore = new ServiceGraphStore(adapter);

      // On D1, tables are created by migrations — skip init().
      // On SQLite, init() creates tables if they don't exist.
      if (!isD1) {
        await artefactStore.init();
        await graphStore.init();
      }

      // Auto-seed if the store is empty
      const isEmpty = await artefactStore.isEmpty();
      if (isEmpty) {
        console.log("[ServiceStore] Empty DB detected — auto-seeding...");
        const result = await seedServiceStore(adapter, { clear: false });
        console.log(
          `[ServiceStore] Seeded: ${result.graphServices} graph + ${result.fullServices} full services, ${result.edges} edges, ${result.lifeEvents} life events`
        );
      }
    } catch (err) {
      initPromise = null;
      adapter = null;
      throw err;
    }
  })();

  return initPromise;
}

export async function getServiceArtefactStore(): Promise<ServiceArtefactStore> {
  await ensureInit();
  return artefactStore!;
}

export async function getServiceGraphStore(): Promise<ServiceGraphStore> {
  await ensureInit();
  return graphStore!;
}

/** Get the raw DatabaseAdapter (used by seed route) */
export async function getServiceStoreAdapter(): Promise<DatabaseAdapter> {
  await ensureInit();
  return adapter!;
}

/** Force re-initialization (used after manual seed) */
export function invalidateServiceStore(): void {
  adapter = null;
  artefactStore = null;
  graphStore = null;
  initPromise = null;
}
