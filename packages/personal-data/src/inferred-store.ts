/**
 * InferredStore — Persistent Tier 3 data store
 *
 * Stores facts extracted by the LLM from conversations.
 * Replaces the in-memory IncidentalStore with database-backed persistence.
 *
 * Deduplication: normalizeKey() collapses near-duplicate keys.
 * storeOrMerge() merges exact duplicates and flags contradictions.
 */

import type { DatabaseAdapter } from "@als/evidence";
import type { InferredFact } from "./data-model";

export type MergeOutcome = "created" | "merged" | "contradiction";

export interface MergeResult {
  outcome: MergeOutcome;
  fact: InferredFact;
  existing?: InferredFact;
}

/** Normalize a key to a canonical form: lowercase, spaces/hyphens → underscores, collapse runs, trim. */
export function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")  // spaces + hyphens → underscores
    .replace(/_+/g, "_")        // collapse multiple underscores
    .replace(/^_|_$/g, "");     // trim leading/trailing underscores
}

export class InferredStore {
  constructor(private db: DatabaseAdapter) {}

  async getAll(userId: string): Promise<InferredFact[]> {
    const rows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM inferred_data WHERE user_id = ? ORDER BY created_at DESC",
      userId
    );
    return rows.map(this.rowToFact);
  }

  async store(userId: string, fact: Omit<InferredFact, "id" | "createdAt" | "updatedAt" | "mentions" | "supersededBy">): Promise<InferredFact> {
    const id = `inf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO inferred_data (id, user_id, field_key, field_value, confidence, source, session_id, extracted_from, mentions, superseded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
      id, userId, fact.fieldKey, JSON.stringify(fact.fieldValue), fact.confidence, fact.source, fact.sessionId || null, fact.extractedFrom || null, now, now
    );
    return { id, ...fact, mentions: 1, createdAt: now, updatedAt: now };
  }

  /**
   * Store or merge a fact with deduplication and contradiction detection.
   *
   * 1. Normalize the key
   * 2. Look for an existing active fact (superseded_by IS NULL) with the same user_id + normalized key
   * 3. Same value → bump mentions, upgrade confidence if higher
   * 4. Different value → insert new, mark old as superseded
   * 5. No existing → insert new
   */
  async storeOrMerge(
    userId: string,
    fact: Omit<InferredFact, "id" | "createdAt" | "updatedAt" | "mentions" | "supersededBy">
  ): Promise<MergeResult> {
    const normalizedKey = normalizeKey(fact.fieldKey);
    const now = new Date().toISOString();

    // Look for an existing active fact with the same normalized key
    const existingRow = await this.db.get<Record<string, unknown>>(
      "SELECT * FROM inferred_data WHERE user_id = ? AND field_key = ? AND superseded_by IS NULL ORDER BY updated_at DESC LIMIT 1",
      userId, normalizedKey
    );

    if (existingRow) {
      const existing = this.rowToFact(existingRow);
      const existingValueStr = JSON.stringify(existing.fieldValue);
      const incomingValueStr = JSON.stringify(fact.fieldValue);

      if (existingValueStr === incomingValueStr) {
        // Same value → merge: bump mentions, upgrade confidence
        const CONFIDENCE_RANK: Record<string, number> = { low: 1, medium: 2, high: 3 };
        const newConfidence = (CONFIDENCE_RANK[fact.confidence] || 0) > (CONFIDENCE_RANK[existing.confidence] || 0)
          ? fact.confidence
          : existing.confidence;

        await this.db.run(
          "UPDATE inferred_data SET mentions = mentions + 1, confidence = ?, updated_at = ? WHERE id = ?",
          newConfidence, now, existing.id
        );

        const merged: InferredFact = {
          ...existing,
          mentions: existing.mentions + 1,
          confidence: newConfidence,
          updatedAt: now,
        };
        return { outcome: "merged", fact: merged };
      } else {
        // Different value → contradiction: insert new, mark old as superseded
        const id = `inf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await this.db.run(
          `INSERT INTO inferred_data (id, user_id, field_key, field_value, confidence, source, session_id, extracted_from, mentions, superseded_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
          id, userId, normalizedKey, JSON.stringify(fact.fieldValue), fact.confidence, fact.source, fact.sessionId || null, fact.extractedFrom || null, now, now
        );

        // Mark old fact as superseded by the new one
        await this.db.run(
          "UPDATE inferred_data SET superseded_by = ?, updated_at = ? WHERE id = ?",
          id, now, existing.id
        );

        const newFact: InferredFact = {
          id,
          fieldKey: normalizedKey,
          fieldValue: fact.fieldValue,
          confidence: fact.confidence,
          source: fact.source,
          sessionId: fact.sessionId,
          extractedFrom: fact.extractedFrom,
          mentions: 1,
          createdAt: now,
          updatedAt: now,
        };

        return {
          outcome: "contradiction",
          fact: newFact,
          existing: { ...existing, supersededBy: id, updatedAt: now },
        };
      }
    }

    // No existing fact → create new
    const id = `inf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await this.db.run(
      `INSERT INTO inferred_data (id, user_id, field_key, field_value, confidence, source, session_id, extracted_from, mentions, superseded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`,
      id, userId, normalizedKey, JSON.stringify(fact.fieldValue), fact.confidence, fact.source, fact.sessionId || null, fact.extractedFrom || null, now, now
    );

    const newFact: InferredFact = {
      id,
      fieldKey: normalizedKey,
      fieldValue: fact.fieldValue,
      confidence: fact.confidence,
      source: fact.source,
      sessionId: fact.sessionId,
      extractedFrom: fact.extractedFrom,
      mentions: 1,
      createdAt: now,
      updatedAt: now,
    };

    return { outcome: "created", fact: newFact };
  }

  /** Get contradiction pairs: old fact (superseded) + new fact that replaced it. */
  async getContradictions(userId: string): Promise<Array<{ old: InferredFact; new: InferredFact }>> {
    const supersededRows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM inferred_data WHERE user_id = ? AND superseded_by IS NOT NULL ORDER BY updated_at DESC",
      userId
    );

    const pairs: Array<{ old: InferredFact; new: InferredFact }> = [];

    for (const row of supersededRows) {
      const oldFact = this.rowToFact(row);
      if (!oldFact.supersededBy) continue;

      const newRow = await this.db.get<Record<string, unknown>>(
        "SELECT * FROM inferred_data WHERE id = ?",
        oldFact.supersededBy
      );
      if (newRow) {
        pairs.push({ old: oldFact, new: this.rowToFact(newRow) });
      }
    }

    return pairs;
  }

  /** Resolve a contradiction: keep one fact, delete the other. */
  async resolveContradiction(keepId: string, deleteId: string): Promise<boolean> {
    // Clear superseded_by on the kept fact (in case it was the old one)
    await this.db.run(
      "UPDATE inferred_data SET superseded_by = NULL, updated_at = ? WHERE id = ?",
      new Date().toISOString(), keepId
    );
    // Delete the rejected fact
    const result = await this.db.run("DELETE FROM inferred_data WHERE id = ?", deleteId);
    return result.changes > 0;
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
      mentions: (row.mentions as number) || 1,
      supersededBy: (row.superseded_by as string) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
