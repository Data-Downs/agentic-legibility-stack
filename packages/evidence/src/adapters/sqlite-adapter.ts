/**
 * SqliteAdapter — Wraps better-sqlite3 synchronous calls in the async
 * DatabaseAdapter interface. Used for local development.
 *
 * Uses dynamic import to avoid bundling the native module on Cloudflare.
 */

import type { DatabaseAdapter } from "../db-adapter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BetterSqlite3Database = any;

export class SqliteAdapter implements DatabaseAdapter {
  private db: BetterSqlite3Database;

  private constructor(db: BetterSqlite3Database) {
    this.db = db;
  }

  static async create(dbPath: string): Promise<SqliteAdapter> {
    // Dynamic import so better-sqlite3 is never traced by the bundler
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return new SqliteAdapter(db);
  }

  async run(sql: string, ...params: unknown[]): Promise<{ changes: number }> {
    const result = this.db.prepare(sql).run(...params);
    return { changes: result.changes };
  }

  async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async batch(statements: Array<{ sql: string; params: unknown[] }>): Promise<void> {
    const tx = this.db.transaction((stmts: Array<{ sql: string; params: unknown[] }>) => {
      for (const { sql, params } of stmts) {
        this.db.prepare(sql).run(...params);
      }
    });
    tx(statements);
  }

  close(): void {
    this.db.close();
  }
}
