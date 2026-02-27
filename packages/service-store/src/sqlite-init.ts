/**
 * SQLite-specific initialization for the service store.
 * Separate entry point to prevent bundler from tracing better-sqlite3.
 *
 * Import as: import { createSqliteServiceStore } from "@als/service-store/sqlite"
 */

import type { DatabaseAdapter } from "@als/evidence";
import { ServiceArtefactStore } from "./service-store";
import { ServiceGraphStore } from "./graph-store";

export async function createSqliteServiceStore(dbPath: string): Promise<{
  db: DatabaseAdapter;
  artefactStore: ServiceArtefactStore;
  graphStore: ServiceGraphStore;
}> {
  const { SqliteAdapter } = await import("@als/evidence/sqlite");
  const db = await SqliteAdapter.create(dbPath);

  const artefactStore = new ServiceArtefactStore(db);
  const graphStore = new ServiceGraphStore(db);

  await artefactStore.init();
  await graphStore.init();

  return { db, artefactStore, graphStore };
}
