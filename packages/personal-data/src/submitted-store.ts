/**
 * SubmittedStore — Persistent Tier 2 data store
 *
 * Stores citizen-submitted data (address, financial, employment, contact).
 * Uses DatabaseAdapter for portability across SQLite and D1.
 *
 * Seed v2: Each top-level persona property stored as a single JSON value
 * keyed by its original property name. This allows reconstructPersonaData()
 * to reassemble the exact same shape as the persona JSON files.
 */

import type { DatabaseAdapter } from "@als/evidence";
import type { SubmittedField } from "./data-model";

const SEED_VERSION = 2;

/** Map of persona property names → category for grouping in UI */
const PROPERTY_CATEGORY: Record<string, string> = {
  personaId: "identity",
  personaName: "identity",
  description: "identity",
  primaryContact: "contact",
  partner: "contact",
  spouse: "contact",
  address: "address",
  employment: "employment",
  spouseEmployment: "employment",
  financials: "financial",
  vehicles: "vehicles",
  healthInfo: "health",
  children: "family",
  pregnancy: "family",
  family: "family",
  deceased: "family",
  benefits: "benefits",
  businessAssets: "business",
  communicationStyle: "communication",
};

export class SubmittedStore {
  constructor(private db: DatabaseAdapter) {}

  async getAll(userId: string): Promise<SubmittedField[]> {
    const rows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM submitted_data WHERE user_id = ? ORDER BY category, field_key",
      userId
    );
    return rows.map(this.rowToField);
  }

  async getByCategory(userId: string, category: string): Promise<SubmittedField[]> {
    const rows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM submitted_data WHERE user_id = ? AND category = ? ORDER BY field_key",
      userId, category
    );
    return rows.map(this.rowToField);
  }

  async get(userId: string, fieldKey: string): Promise<SubmittedField | undefined> {
    const row = await this.db.get<Record<string, unknown>>(
      "SELECT * FROM submitted_data WHERE user_id = ? AND field_key = ?",
      userId, fieldKey
    );
    return row ? this.rowToField(row) : undefined;
  }

  async upsert(userId: string, field: Omit<SubmittedField, "id" | "createdAt" | "updatedAt">): Promise<SubmittedField> {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO submitted_data (id, user_id, field_key, field_value, category, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, field_key) DO UPDATE SET
         field_value = excluded.field_value,
         category = excluded.category,
         source = excluded.source,
         updated_at = excluded.updated_at`,
      id, userId, field.fieldKey, JSON.stringify(field.fieldValue), field.category, field.source, now, now
    );
    return { id, ...field, createdAt: now, updatedAt: now };
  }

  async remove(userId: string, fieldKey: string): Promise<boolean> {
    const result = await this.db.run(
      "DELETE FROM submitted_data WHERE user_id = ? AND field_key = ?",
      userId, fieldKey
    );
    return result.changes > 0;
  }

  /**
   * Seed Tier 2 data from persona JSON. Stores every top-level persona property
   * as a single JSON object keyed by its original property name.
   *
   * Seed versioning: if old flat-field format exists (v1), clears persona-sourced
   * rows and re-seeds in the new format with _seed_version=2.
   */
  async seedFromPersona(userId: string, personaData: Record<string, unknown>): Promise<void> {
    // Check seed version marker
    const versionRow = await this.get(userId, "_seed_version");
    if (versionRow) {
      const ver = typeof versionRow.fieldValue === "number"
        ? versionRow.fieldValue
        : Number(versionRow.fieldValue);
      if (ver >= SEED_VERSION) return; // Already seeded at current version
    }

    // Check if old v1 data exists (flat fields like address_line1)
    const existing = await this.getAll(userId);
    const hasOldFormat = existing.some(
      (f) => f.source === "persona" && f.fieldKey !== "_seed_version"
    );

    if (hasOldFormat) {
      // Clear old persona-sourced rows to re-seed
      await this.db.run(
        "DELETE FROM submitted_data WHERE user_id = ? AND source = 'persona'",
        userId
      );
    } else if (existing.length > 0 && !versionRow) {
      // Has non-persona data but no version marker — skip seeding, just set marker
      await this.upsert(userId, {
        fieldKey: "_seed_version",
        fieldValue: SEED_VERSION,
        category: "system",
        source: "persona",
      });
      return;
    }

    // Seed each top-level persona property as a JSON object
    for (const [key, value] of Object.entries(personaData)) {
      if (value === undefined || value === null) continue;
      const category = PROPERTY_CATEGORY[key] || "other";
      await this.upsert(userId, {
        fieldKey: key,
        fieldValue: value,
        category,
        source: "persona",
      });
    }

    // Set seed version marker
    await this.upsert(userId, {
      fieldKey: "_seed_version",
      fieldValue: SEED_VERSION,
      category: "system",
      source: "persona",
    });
  }

  /**
   * Reconstruct a PersonaData-shaped object from DB rows.
   * Since field keys match the original JSON property names,
   * the result has the same shape as the persona JSON files.
   */
  async reconstructPersonaData(userId: string): Promise<Record<string, unknown> | null> {
    const fields = await this.getAll(userId);
    if (fields.length === 0) return null;

    const result: Record<string, unknown> = {};
    for (const f of fields) {
      // Skip internal fields
      if (f.fieldKey.startsWith("_")) continue;
      result[f.fieldKey] = f.fieldValue;
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  private rowToField(row: Record<string, unknown>): SubmittedField {
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
      category: row.category as string,
      source: row.source as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
