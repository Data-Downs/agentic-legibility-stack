/**
 * D1Adapter — Wraps Cloudflare D1Database binding in the async
 * DatabaseAdapter interface. Used in production on Cloudflare Workers.
 */

import type { DatabaseAdapter } from "../db-adapter";

/**
 * Minimal D1 type definitions — avoids importing @cloudflare/workers-types
 * as a hard dependency. The actual runtime types come from Cloudflare.
 */
interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: { changes_in: number; changes_out: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1Result>;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

export class D1Adapter implements DatabaseAdapter {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async run(sql: string, ...params: unknown[]): Promise<{ changes: number }> {
    const result = await this.db.prepare(sql).bind(...params).run();
    return { changes: result.meta.changes_out ?? result.meta.changes_in ?? 0 };
  }

  async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    const row = await this.db.prepare(sql).bind(...params).first<T>();
    return row ?? undefined;
  }

  async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const result = await this.db.prepare(sql).bind(...params).all<T>();
    return result.results;
  }

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

  async batch(statements: Array<{ sql: string; params: unknown[] }>): Promise<void> {
    const prepared = statements.map(({ sql, params }) =>
      this.db.prepare(sql).bind(...params)
    );
    await this.db.batch(prepared);
  }

  close(): void {
    // D1 connections are managed by the Cloudflare runtime — no-op
  }
}
