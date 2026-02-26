/**
 * @als/service-store — DB-backed storage for service artefacts, graph
 * relationships, and life events.
 *
 * Uses the DatabaseAdapter interface from @als/evidence for SQLite/D1 compatibility.
 *
 * NOTE: SqliteAdapter initialization is in a separate entry point
 * ("@als/service-store/sqlite") to prevent bundler tracing of better-sqlite3.
 */

export { ServiceArtefactStore } from "./service-store";
export { ServiceGraphStore } from "./graph-store";
export { seedServiceStore } from "./seed";
export type { SeedOptions, SeedResult } from "./seed";

export type {
  ServiceRow,
  EdgeRow,
  LifeEventRow,
  LifeEventServiceRow,
  ServiceFilter,
  ServiceWithArtefacts,
  ServiceSummary,
  LifeEventWithServices,
  DepartmentInfo,
} from "./types";
