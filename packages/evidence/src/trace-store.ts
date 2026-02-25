/**
 * TraceStore — Append-only store for trace events and receipts.
 *
 * All evidence is immutable once written. This is the foundation of
 * the Evidence Plane — every action taken by the system is recorded here.
 *
 * Backend-agnostic: works with SqliteAdapter (local) or D1Adapter (Cloudflare).
 */

import type { TraceEvent, Receipt } from "@als/schemas";
import type { DatabaseAdapter } from "./db-adapter";

export class TraceStore {
  private db: DatabaseAdapter;

  constructor(adapter: DatabaseAdapter) {
    this.db = adapter;
  }

  async init(): Promise<void> {
    await this.db.exec(`
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
  async append(event: TraceEvent): Promise<void> {
    await this.db.run(
      `INSERT INTO trace_events (id, trace_id, span_id, parent_span_id, timestamp, type, payload, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      event.id,
      event.traceId,
      event.spanId,
      event.parentSpanId || null,
      event.timestamp,
      event.type,
      JSON.stringify(event.payload),
      JSON.stringify(event.metadata),
    );
  }

  /** Append multiple trace events atomically */
  async appendBatch(events: TraceEvent[]): Promise<void> {
    await this.db.batch(
      events.map((event) => ({
        sql: `INSERT INTO trace_events (id, trace_id, span_id, parent_span_id, timestamp, type, payload, metadata)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          event.id,
          event.traceId,
          event.spanId,
          event.parentSpanId || null,
          event.timestamp,
          event.type,
          JSON.stringify(event.payload),
          JSON.stringify(event.metadata),
        ],
      })),
    );
  }

  /** Store a receipt */
  async storeReceipt(receipt: Receipt): Promise<void> {
    await this.db.run(
      `INSERT INTO receipts (id, trace_id, capability_id, timestamp, citizen_id, citizen_name, action, outcome, details, data_shared, state_from, state_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      receipt.stateTransition?.to || null,
    );
  }

  /** Delete traces for a specific user+service combination */
  async deleteTracesByUser(userId: string, serviceId: string): Promise<void> {
    await this.db.run(
      "DELETE FROM trace_events WHERE json_extract(metadata, '$.userId') = ? AND (json_extract(metadata, '$.capabilityId') = ? OR json_extract(payload, '$.serviceId') = ?)",
      userId,
      serviceId,
      serviceId,
    );
  }

  /** Query events by trace ID */
  async queryByTraceId(traceId: string): Promise<TraceEvent[]> {
    const rows = await this.db.all<Record<string, string>>(
      "SELECT * FROM trace_events WHERE trace_id = ? ORDER BY timestamp ASC",
      traceId,
    );
    return rows.map(this.rowToTraceEvent);
  }

  /** Query events by session ID (from metadata) */
  async queryBySession(sessionId: string): Promise<TraceEvent[]> {
    const rows = await this.db.all<Record<string, string>>(
      "SELECT * FROM trace_events WHERE json_extract(metadata, '$.sessionId') = ? ORDER BY timestamp ASC",
      sessionId,
    );
    return rows.map(this.rowToTraceEvent);
  }

  /** Query events by type */
  async queryByType(type: string, limit = 100): Promise<TraceEvent[]> {
    const rows = await this.db.all<Record<string, string>>(
      "SELECT * FROM trace_events WHERE type = ? ORDER BY timestamp DESC LIMIT ?",
      type,
      limit,
    );
    return rows.map(this.rowToTraceEvent);
  }

  /** Get all unique trace IDs, most recent first */
  async listTraces(limit = 50): Promise<Array<{ traceId: string; firstEvent: string; eventCount: number }>> {
    return this.db.all<{ traceId: string; firstEvent: string; eventCount: number }>(
      `SELECT trace_id as traceId, MIN(timestamp) as firstEvent, COUNT(*) as eventCount
       FROM trace_events
       GROUP BY trace_id
       ORDER BY firstEvent DESC
       LIMIT ?`,
      limit,
    );
  }

  /** Get receipt by ID */
  async getReceipt(receiptId: string): Promise<Receipt | undefined> {
    const row = await this.db.get<Record<string, string>>(
      "SELECT * FROM receipts WHERE id = ?",
      receiptId,
    );
    if (!row) return undefined;
    return this.rowToReceipt(row);
  }

  /** Get receipts for a trace */
  async getReceiptsByTrace(traceId: string): Promise<Receipt[]> {
    const rows = await this.db.all<Record<string, string>>(
      "SELECT * FROM receipts WHERE trace_id = ? ORDER BY timestamp ASC",
      traceId,
    );
    return rows.map(this.rowToReceipt);
  }

  /** Get total event count */
  async getEventCount(): Promise<number> {
    const row = await this.db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM trace_events",
    );
    return row?.count ?? 0;
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
