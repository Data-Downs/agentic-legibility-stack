/**
 * TraceStore — Append-only SQLite store for trace events and receipts.
 *
 * All evidence is immutable once written. This is the foundation of
 * the Evidence Plane — every action taken by the system is recorded here.
 */

import Database from "better-sqlite3";
import type { TraceEvent, Receipt } from "@als/schemas";

export class TraceStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trace_events (
        id TEXT PRIMARY KEY,
        trace_id TEXT NOT NULL,
        span_id TEXT NOT NULL,
        parent_span_id TEXT,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_trace_events_trace_id ON trace_events(trace_id);
      CREATE INDEX IF NOT EXISTS idx_trace_events_type ON trace_events(type);
      CREATE INDEX IF NOT EXISTS idx_trace_events_timestamp ON trace_events(timestamp);

      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        trace_id TEXT NOT NULL,
        capability_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        citizen_id TEXT NOT NULL,
        citizen_name TEXT,
        action TEXT NOT NULL,
        outcome TEXT NOT NULL,
        details TEXT NOT NULL,
        data_shared TEXT,
        state_from TEXT,
        state_to TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_receipts_trace_id ON receipts(trace_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_capability_id ON receipts(capability_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_citizen_id ON receipts(citizen_id);
    `);
  }

  /** Append a trace event (immutable — never updated) */
  append(event: TraceEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO trace_events (id, trace_id, span_id, parent_span_id, timestamp, type, payload, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      event.id,
      event.traceId,
      event.spanId,
      event.parentSpanId || null,
      event.timestamp,
      event.type,
      JSON.stringify(event.payload),
      JSON.stringify(event.metadata)
    );
  }

  /** Append multiple trace events in a transaction */
  appendBatch(events: TraceEvent[]): void {
    const insert = this.db.prepare(`
      INSERT INTO trace_events (id, trace_id, span_id, parent_span_id, timestamp, type, payload, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((evts: TraceEvent[]) => {
      for (const event of evts) {
        insert.run(
          event.id,
          event.traceId,
          event.spanId,
          event.parentSpanId || null,
          event.timestamp,
          event.type,
          JSON.stringify(event.payload),
          JSON.stringify(event.metadata)
        );
      }
    });
    tx(events);
  }

  /** Store a receipt */
  storeReceipt(receipt: Receipt): void {
    const stmt = this.db.prepare(`
      INSERT INTO receipts (id, trace_id, capability_id, timestamp, citizen_id, citizen_name, action, outcome, details, data_shared, state_from, state_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      receipt.id,
      receipt.traceId,
      receipt.capabilityId,
      receipt.timestamp,
      receipt.citizen.id,
      receipt.citizen.name || null,
      receipt.action,
      receipt.outcome,
      JSON.stringify(receipt.details),
      receipt.dataShared ? JSON.stringify(receipt.dataShared) : null,
      receipt.stateTransition?.from || null,
      receipt.stateTransition?.to || null
    );
  }

  /** Delete traces for a specific user+service combination */
  deleteTracesByUser(userId: string, serviceId: string): void {
    this.db.prepare(
      "DELETE FROM trace_events WHERE json_extract(metadata, '$.userId') = ? AND (json_extract(metadata, '$.capabilityId') = ? OR json_extract(payload, '$.serviceId') = ?)"
    ).run(userId, serviceId, serviceId);
  }

  /** Query events by trace ID */
  queryByTraceId(traceId: string): TraceEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM trace_events WHERE trace_id = ? ORDER BY timestamp ASC")
      .all(traceId) as Array<Record<string, string>>;
    return rows.map(this.rowToTraceEvent);
  }

  /** Query events by session ID (from metadata) */
  queryBySession(sessionId: string): TraceEvent[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM trace_events WHERE json_extract(metadata, '$.sessionId') = ? ORDER BY timestamp ASC"
      )
      .all(sessionId) as Array<Record<string, string>>;
    return rows.map(this.rowToTraceEvent);
  }

  /** Query events by type */
  queryByType(type: string, limit = 100): TraceEvent[] {
    const rows = this.db
      .prepare("SELECT * FROM trace_events WHERE type = ? ORDER BY timestamp DESC LIMIT ?")
      .all(type, limit) as Array<Record<string, string>>;
    return rows.map(this.rowToTraceEvent);
  }

  /** Get all unique trace IDs, most recent first */
  listTraces(limit = 50): Array<{ traceId: string; firstEvent: string; eventCount: number }> {
    return this.db
      .prepare(
        `SELECT trace_id as traceId, MIN(timestamp) as firstEvent, COUNT(*) as eventCount
         FROM trace_events
         GROUP BY trace_id
         ORDER BY firstEvent DESC
         LIMIT ?`
      )
      .all(limit) as Array<{ traceId: string; firstEvent: string; eventCount: number }>;
  }

  /** Get receipt by ID */
  getReceipt(receiptId: string): Receipt | undefined {
    const row = this.db
      .prepare("SELECT * FROM receipts WHERE id = ?")
      .get(receiptId) as Record<string, string> | undefined;
    if (!row) return undefined;
    return this.rowToReceipt(row);
  }

  /** Get receipts for a trace */
  getReceiptsByTrace(traceId: string): Receipt[] {
    const rows = this.db
      .prepare("SELECT * FROM receipts WHERE trace_id = ? ORDER BY timestamp ASC")
      .all(traceId) as Array<Record<string, string>>;
    return rows.map(this.rowToReceipt);
  }

  /** Get total event count */
  get eventCount(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM trace_events")
      .get() as { count: number };
    return row.count;
  }

  /** Get the underlying database instance (for sharing with CaseStore) */
  getDatabase(): Database.Database {
    return this.db;
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }

  private rowToTraceEvent(row: Record<string, string>): TraceEvent {
    return {
      id: row.id,
      traceId: row.trace_id,
      spanId: row.span_id,
      parentSpanId: row.parent_span_id || undefined,
      timestamp: row.timestamp,
      type: row.type as TraceEvent["type"],
      payload: JSON.parse(row.payload),
      metadata: JSON.parse(row.metadata),
    };
  }

  private rowToReceipt(row: Record<string, string>): Receipt {
    return {
      id: row.id,
      traceId: row.trace_id,
      capabilityId: row.capability_id,
      timestamp: row.timestamp,
      citizen: {
        id: row.citizen_id,
        name: row.citizen_name || undefined,
      },
      action: row.action,
      outcome: row.outcome as Receipt["outcome"],
      details: JSON.parse(row.details),
      dataShared: row.data_shared ? JSON.parse(row.data_shared) : undefined,
      stateTransition:
        row.state_from && row.state_to
          ? { from: row.state_from, to: row.state_to }
          : undefined,
    };
  }
}
