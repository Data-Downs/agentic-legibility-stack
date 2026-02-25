export type { DatabaseAdapter } from "./db-adapter";
// NOTE: SqliteAdapter is NOT exported here to prevent the bundler from tracing
// better-sqlite3 (a native C++ module) into Cloudflare Workers builds.
// Import it directly: import { SqliteAdapter } from "@als/evidence/sqlite"
// or dynamically: const { SqliteAdapter } = await import("@als/evidence/sqlite")
export { D1Adapter } from "./adapters/d1-adapter";
export { TraceStore } from "./trace-store";
export { TraceEmitter } from "./trace-emitter";
export type { SpanContext } from "./trace-emitter";
export { ReceiptGenerator } from "./receipt-generator";
export { ReplayEngine } from "./replay-engine";
export { CaseStore } from "./case-store";
