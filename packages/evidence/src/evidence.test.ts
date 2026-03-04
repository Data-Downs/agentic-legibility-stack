import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TraceStore } from "./trace-store";
import { ReceiptGenerator } from "./receipt-generator";
import { ReplayEngine } from "./replay-engine";
import type { DatabaseAdapter } from "./db-adapter";
import type { TraceEvent, Receipt, InvocationResult } from "@als/schemas";

/** In-memory DatabaseAdapter for testing (no native module needed) */
class InMemoryAdapter implements DatabaseAdapter {
  private tables: Record<string, Record<string, string>[]> = {};

  async exec(sql: string): Promise<void> {
    // Parse CREATE TABLE statements to initialize tables
    const createMatches = sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g);
    for (const match of createMatches) {
      if (!this.tables[match[1]]) {
        this.tables[match[1]] = [];
      }
    }
  }

  async run(sql: string, ...params: unknown[]): Promise<{ changes: number }> {
    const tableName = this.extractTableName(sql);
    if (!tableName) return { changes: 0 };

    if (sql.trim().toUpperCase().startsWith("INSERT")) {
      const row = this.buildRow(tableName, sql, params);
      this.tables[tableName] = this.tables[tableName] || [];
      this.tables[tableName].push(row);
      return { changes: 1 };
    }
    if (sql.trim().toUpperCase().startsWith("DELETE")) {
      const before = (this.tables[tableName] || []).length;
      // Simple WHERE clause matching
      const whereMatch = sql.match(/WHERE\s+(.+)/i);
      if (whereMatch && params.length > 0) {
        this.tables[tableName] = (this.tables[tableName] || []).filter((row) => {
          // Match first param against any column value
          return !Object.values(row).includes(String(params[0]));
        });
      }
      return { changes: before - (this.tables[tableName] || []).length };
    }
    return { changes: 0 };
  }

  async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    const results = await this.all<T>(sql, ...params);
    return results[0];
  }

  async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const tableName = this.extractTableName(sql);
    if (!tableName || !this.tables[tableName]) return [];

    let rows = [...this.tables[tableName]];
    let paramIdx = 0;

    // Only apply WHERE filtering if there's a WHERE clause
    const whereClause = sql.match(/WHERE\s+(.+?)(?:\s+GROUP\s+|\s+ORDER\s+|\s+LIMIT\s+|$)/i);
    if (whereClause) {
      if (sql.includes("json_extract")) {
        const jsonPathMatch = sql.match(/json_extract\((\w+),\s*'(\$\.\w+)'\)\s*=\s*\?/i);
        if (jsonPathMatch && params.length > 0) {
          const [, col, jsonPath] = jsonPathMatch;
          const key = jsonPath.replace("$.", "");
          rows = rows.filter((r) => {
            try {
              const parsed = JSON.parse(r[col]);
              return parsed[key] === String(params[paramIdx]);
            } catch {
              return false;
            }
          });
          paramIdx++;
        }
      } else {
        // Match column = ? patterns within the WHERE clause
        const whereText = whereClause[1];
        const colMatches = [...whereText.matchAll(/(\w+)\s*=\s*\?/gi)];
        for (const match of colMatches) {
          if (paramIdx < params.length) {
            const col = match[1];
            const val = String(params[paramIdx]);
            rows = rows.filter((r) => r[col] === val);
            paramIdx++;
          }
        }
      }
    }

    // COUNT support (only for simple COUNT queries without GROUP BY)
    if (sql.includes("COUNT(*)") && !sql.includes("GROUP BY")) {
      return [{ count: rows.length } as unknown as T];
    }

    // GROUP BY support for listTraces
    if (sql.includes("GROUP BY")) {
      const groupByMatch = sql.match(/GROUP BY\s+(\w+)/i);
      const groupCol = groupByMatch ? groupByMatch[1] : "trace_id";
      const grouped = new Map<string, typeof rows>();
      for (const row of rows) {
        const key = row[groupCol];
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(row);
      }

      // ORDER BY ASC within groups for MIN
      const result: unknown[] = [];
      for (const [traceId, group] of grouped) {
        const sorted = group.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        result.push({
          traceId,
          firstEvent: sorted[0].timestamp,
          eventCount: group.length,
        });
      }

      // LIMIT on grouped results
      const limitMatch = sql.match(/LIMIT\s+(\?|\d+)/i);
      if (limitMatch) {
        const limit = limitMatch[1] === "?" ? Number(params[paramIdx] ?? params[params.length - 1]) : Number(limitMatch[1]);
        return result.slice(0, limit) as T[];
      }
      return result as T[];
    }

    // ORDER BY DESC
    if (sql.includes("ORDER BY") && sql.includes("DESC")) {
      rows.reverse();
    }

    // LIMIT support
    const limitMatch = sql.match(/LIMIT\s+(\?|\d+)/i);
    if (limitMatch) {
      const limit = limitMatch[1] === "?" ? Number(params[paramIdx] ?? params[params.length - 1]) : Number(limitMatch[1]);
      rows = rows.slice(0, limit);
    }

    return rows as unknown as T[];
  }

  async batch(statements: Array<{ sql: string; params: unknown[] }>): Promise<void> {
    for (const { sql, params } of statements) {
      await this.run(sql, ...params);
    }
  }

  close(): void {}

  private extractTableName(sql: string): string | null {
    const match = sql.match(/(?:FROM|INTO|TABLE|UPDATE)\s+(\w+)/i);
    return match ? match[1] : null;
  }

  private buildRow(tableName: string, sql: string, params: unknown[]): Record<string, string> {
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (!colMatch) return {};
    const cols = colMatch[1].split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    cols.forEach((col, i) => {
      row[col] = params[i] != null ? String(params[i]) : "";
    });
    return row;
  }
}

function makeTraceEvent(overrides: Partial<TraceEvent> = {}): TraceEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    traceId: "trace-1",
    spanId: "span-1",
    timestamp: new Date().toISOString(),
    type: "capability.invoked",
    payload: { test: true },
    metadata: { sessionId: "sess-1", capabilityId: "test.service" },
    ...overrides,
  };
}

describe("TraceStore", () => {
  let store: TraceStore;
  let adapter: InMemoryAdapter;

  beforeEach(async () => {
    adapter = new InMemoryAdapter();
    store = new TraceStore(adapter);
    await store.init();
  });

  afterEach(() => {
    store.close();
  });

  it("can append and retrieve a trace event", async () => {
    const event = makeTraceEvent();
    await store.append(event);
    const results = await store.queryByTraceId("trace-1");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(event.id);
    expect(results[0].type).toBe("capability.invoked");
    expect(results[0].payload).toEqual({ test: true });
  });

  it("appendBatch writes multiple events atomically", async () => {
    const events = [
      makeTraceEvent({ id: "evt-1" }),
      makeTraceEvent({ id: "evt-2" }),
      makeTraceEvent({ id: "evt-3" }),
    ];
    await store.appendBatch(events);
    const results = await store.queryByTraceId("trace-1");
    expect(results).toHaveLength(3);
  });

  it("queryByType returns events of the given type", async () => {
    await store.append(makeTraceEvent({ type: "capability.invoked" }));
    await store.append(makeTraceEvent({ type: "receipt.issued" }));
    await store.append(makeTraceEvent({ type: "capability.invoked" }));

    const invoked = await store.queryByType("capability.invoked");
    expect(invoked.length).toBeGreaterThanOrEqual(2);
  });

  it("getEventCount returns total count", async () => {
    await store.append(makeTraceEvent());
    await store.append(makeTraceEvent());
    const count = await store.getEventCount();
    expect(count).toBe(2);
  });

  it("listTraces groups by trace ID", async () => {
    await store.append(makeTraceEvent({ id: "e1", traceId: "t1" }));
    await store.append(makeTraceEvent({ id: "e2", traceId: "t1" }));
    await store.append(makeTraceEvent({ id: "e3", traceId: "t2" }));
    // Verify raw data is correct
    const all = await adapter.all<Record<string, string>>("SELECT * FROM trace_events");
    expect(all).toHaveLength(3);
    const traces = await store.listTraces();
    expect(traces.length).toBe(2);
  });

  it("storeReceipt and getReceipt round-trip", async () => {
    const receipt: Receipt = {
      id: "rcpt-1",
      traceId: "trace-1",
      capabilityId: "test.service",
      timestamp: new Date().toISOString(),
      citizen: { id: "user-1", name: "Test" },
      action: "test action",
      outcome: "success",
      details: { key: "value" },
      dataShared: ["name", "dob"],
      stateTransition: { from: "start", to: "done" },
    };
    await store.storeReceipt(receipt);
    const retrieved = await store.getReceipt("rcpt-1");
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe("rcpt-1");
    expect(retrieved!.citizen.name).toBe("Test");
    expect(retrieved!.outcome).toBe("success");
  });

  it("getReceiptsByTrace returns receipts for a trace", async () => {
    await store.storeReceipt({
      id: "rcpt-a",
      traceId: "trace-1",
      capabilityId: "svc-1",
      timestamp: new Date().toISOString(),
      citizen: { id: "user-1" },
      action: "a",
      outcome: "success",
      details: {},
    });
    const receipts = await store.getReceiptsByTrace("trace-1");
    expect(receipts).toHaveLength(1);
  });

  it("traces are append-only — no SQL UPDATE on trace_events", () => {
    // Verify TraceStore has no update method
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(store));
    const updateMethods = methods.filter(
      (m) => m.includes("update") || m.includes("Update")
    );
    // Only deleteTracesByUser exists for GDPR compliance, not general update
    expect(updateMethods).toEqual([]);
  });
});

describe("ReceiptGenerator", () => {
  it("creates receipt from invocation result", async () => {
    const gen = new ReceiptGenerator();
    const invResult: InvocationResult = {
      success: true,
      capabilityId: "test.service",
      output: { data: "ok" },
      traceEvents: [makeTraceEvent()],
    };
    const receipt = await gen.fromInvocationResult(
      invResult,
      { id: "user-1", name: "Alice" },
      "trace-1",
    );
    expect(receipt.id).toMatch(/^rcpt_/);
    expect(receipt.traceId).toBe("trace-1");
    expect(receipt.capabilityId).toBe("test.service");
    expect(receipt.citizen.id).toBe("user-1");
    expect(receipt.citizen.name).toBe("Alice");
    expect(receipt.outcome).toBe("success");
    expect(receipt.timestamp).toBeTruthy();
  });

  it("creates failure receipt for failed invocation", async () => {
    const gen = new ReceiptGenerator();
    const invResult: InvocationResult = {
      success: false,
      capabilityId: "test.service",
      error: "Something went wrong",
      traceEvents: [],
    };
    const receipt = await gen.fromInvocationResult(
      invResult,
      { id: "user-1" },
      "trace-1",
    );
    expect(receipt.outcome).toBe("failure");
    expect(receipt.details).toHaveProperty("error", "Something went wrong");
  });

  it("create() produces receipt with required fields", async () => {
    const gen = new ReceiptGenerator();
    const receipt = await gen.create({
      traceId: "trace-2",
      capabilityId: "svc.custom",
      citizen: { id: "user-2", name: "Bob" },
      action: "Custom action",
      outcome: "partial",
      details: { note: "half done" },
      dataShared: ["email"],
    });
    expect(receipt.id).toMatch(/^rcpt_/);
    expect(receipt.action).toBe("Custom action");
    expect(receipt.outcome).toBe("partial");
    expect(receipt.dataShared).toEqual(["email"]);
  });
});

describe("ReplayEngine", () => {
  let engine: ReplayEngine;
  const events: TraceEvent[] = [
    makeTraceEvent({ id: "e1", timestamp: "2024-01-01T00:00:01Z" }),
    makeTraceEvent({ id: "e2", timestamp: "2024-01-01T00:00:02Z" }),
    makeTraceEvent({ id: "e3", timestamp: "2024-01-01T00:00:03Z" }),
  ];

  beforeEach(() => {
    engine = new ReplayEngine();
    engine.load(events);
  });

  it("loads events sorted by timestamp", () => {
    expect(engine.length).toBe(3);
    expect(engine.position).toBe(-1);
  });

  it("step() advances through events in order", () => {
    const s1 = engine.step();
    expect(s1?.event.id).toBe("e1");
    expect(s1?.index).toBe(0);
    expect(s1?.total).toBe(3);

    const s2 = engine.step();
    expect(s2?.event.id).toBe("e2");

    const s3 = engine.step();
    expect(s3?.event.id).toBe("e3");

    const s4 = engine.step();
    expect(s4).toBeNull(); // past end
  });

  it("stepBack() goes backward", () => {
    engine.step(); // e1
    engine.step(); // e2
    const back = engine.stepBack();
    expect(back?.event.id).toBe("e1");
  });

  it("stepBack() returns null at start", () => {
    engine.step(); // e1 (index 0)
    expect(engine.stepBack()).toBeNull(); // can't go before 0
  });

  it("jumpTo() sets position directly", () => {
    const result = engine.jumpTo(2);
    expect(result?.event.id).toBe("e3");
    expect(result?.index).toBe(2);
  });

  it("jumpTo() returns null for out-of-range", () => {
    expect(engine.jumpTo(-1)).toBeNull();
    expect(engine.jumpTo(5)).toBeNull();
  });

  it("current() returns current event", () => {
    expect(engine.current()).toBeNull(); // before any step
    engine.step();
    expect(engine.current()?.id).toBe("e1");
  });

  it("eventsToHere() returns events up to current position", () => {
    expect(engine.eventsToHere()).toEqual([]);
    engine.step();
    engine.step();
    expect(engine.eventsToHere()).toHaveLength(2);
  });

  it("reset() goes back to beginning", () => {
    engine.step();
    engine.step();
    engine.reset();
    expect(engine.position).toBe(-1);
    expect(engine.current()).toBeNull();
  });

  it("handles out-of-order input by sorting", () => {
    const unordered = [
      makeTraceEvent({ id: "late", timestamp: "2024-12-31T23:59:59Z" }),
      makeTraceEvent({ id: "early", timestamp: "2024-01-01T00:00:00Z" }),
    ];
    engine.load(unordered);
    const first = engine.step();
    expect(first?.event.id).toBe("early");
    const second = engine.step();
    expect(second?.event.id).toBe("late");
  });
});
