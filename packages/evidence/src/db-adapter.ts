/**
 * DatabaseAdapter — Abstract interface for SQL storage backends.
 *
 * Implementations:
 *   - SqliteAdapter  (local dev, wraps better-sqlite3)
 *   - D1Adapter      (Cloudflare Workers, wraps D1Database binding)
 */

export interface DatabaseAdapter {
  run(sql: string, ...params: unknown[]): Promise<{ changes: number }>;
  get<T>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  batch(statements: Array<{ sql: string; params: unknown[] }>): Promise<void>;
  close(): void;
}
