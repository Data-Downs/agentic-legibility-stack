/**
 * InferredStore — Persistent Tier 3 data store
 *
 * Stores facts extracted by the LLM from conversations.
 * Replaces the in-memory IncidentalStore with database-backed persistence.
 */

import type { DatabaseAdapter } from "@als/evidence";
import type { InferredFact } from "./data-model";

export class InferredStore {
  constructor(private db: DatabaseAdapter) {}

  async getAll(userId: string): Promise<InferredFact[]> {
    const rows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM inferred_data WHERE user_id = ? ORDER BY created_at DESC",
      userId
    );
    return rows.map(this.rowToFact);
  }

  async store(userId: string, fact: Omit<InferredFact, "id" | "createdAt" | "updatedAt">): Promise<InferredFact> {
    const id = `inf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO inferred_data (id, user_id, field_key, field_value, confidence, source, session_id, extracted_from, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, userId, fact.fieldKey, JSON.stringify(fact.fieldValue), fact.confidence, fact.source, fact.sessionId || null, fact.extractedFrom || null, now, now
    );
    return { id, ...fact, createdAt: now, updatedAt: now };
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.db.run("DELETE FROM inferred_data WHERE id = ?", id);
    return result.changes > 0;
  }

  async removeByKey(userId: string, fieldKey: string): Promise<boolean> {
    const result = await this.db.run(
      "DELETE FROM inferred_data WHERE user_id = ? AND field_key = ?",
      userId, fieldKey
    );
    return result.changes > 0;
  }

  async clearAll(userId: string): Promise<number> {
    const result = await this.db.run("DELETE FROM inferred_data WHERE user_id = ?", userId);
    return result.changes;
  }

  async count(userId: string): Promise<number> {
    const row = await this.db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM inferred_data WHERE user_id = ?",
      userId
    );
    return row?.cnt || 0;
  }

  private rowToFact(row: Record<string, unknown>): InferredFact {
    let value: unknown;
    try {
      value = JSON.parse(row.field_value as string);
    } catch {
      value = row.field_value;
    }
    return {
      id: row.id as string,
      fieldKey: row.field_key as string,
      fieldValue: value,
      confidence: row.confidence as string,
      source: row.source as string,
      sessionId: (row.session_id as string) || undefined,
      extractedFrom: (row.extracted_from as string) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
