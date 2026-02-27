/**
 * FieldCollector — Tracks required vs collected fields for a service journey.
 *
 * Initialized from a manifest's input_schema. Tracks which fields have been
 * collected (from persona data, conversation extraction, or task cards) and
 * computes what's still missing. The Orchestrator uses this to know what to
 * ask for next, without relying on the LLM.
 */

import type { JsonSchema } from "@als/schemas";

interface CollectedField {
  value: unknown;
  source: string;
}

export class FieldCollector {
  private readonly schema: JsonSchema;
  private readonly requiredFields: string[];
  private readonly allFields: string[];
  private readonly collected = new Map<string, CollectedField>();

  constructor(inputSchema: JsonSchema) {
    this.schema = inputSchema;
    this.allFields = inputSchema.properties
      ? Object.keys(inputSchema.properties)
      : [];
    this.requiredFields = inputSchema.required || [];
  }

  /** Seed known fields from persona/profile data */
  seedFromPersona(data: Record<string, unknown>): void {
    for (const key of this.allFields) {
      if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
        this.collected.set(key, { value: data[key], source: "persona" });
      }
    }
  }

  /** Record a single field value collected during the journey */
  recordField(key: string, value: unknown, source: string): void {
    this.collected.set(key, { value, source });
  }

  /** Record multiple fields at once */
  recordFields(fields: Record<string, unknown>, source: string): void {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        this.recordField(key, value, source);
      }
    }
  }

  /** Get all collected fields */
  getCollected(): Map<string, CollectedField> {
    return new Map(this.collected);
  }

  /** Get required fields that have not been collected yet */
  getMissing(): string[] {
    return this.requiredFields.filter((f) => !this.collected.has(f));
  }

  /** Get the next N required fields to collect, in schema order */
  nextRequiredFields(limit = 3): string[] {
    return this.getMissing().slice(0, limit);
  }

  /** Whether all required fields have been collected */
  isComplete(): boolean {
    return this.getMissing().length === 0;
  }

  /** Get the value of a collected field */
  getValue(key: string): unknown | undefined {
    return this.collected.get(key)?.value;
  }

  /** Check if a specific field has been collected */
  hasField(key: string): boolean {
    return this.collected.has(key);
  }

  /** Format collected/missing fields as a context string for the system prompt */
  toContext(): string {
    const lines: string[] = [];

    const collectedEntries = Array.from(this.collected.entries());
    if (collectedEntries.length > 0) {
      lines.push("FIELDS COLLECTED:");
      for (const [key, { value, source }] of collectedEntries) {
        const display = typeof value === "object" ? JSON.stringify(value) : String(value);
        lines.push(`  - ${key}: ${display} (source: ${source})`);
      }
    }

    const missing = this.getMissing();
    if (missing.length > 0) {
      lines.push("");
      lines.push("FIELDS STILL REQUIRED:");
      for (const key of missing) {
        const schemaProp = this.schema.properties?.[key] as Record<string, unknown> | undefined;
        const desc = schemaProp?.description ? ` — ${schemaProp.description}` : "";
        lines.push(`  - ${key}${desc}`);
      }
    }

    if (this.isComplete()) {
      lines.push("");
      lines.push("ALL REQUIRED FIELDS COLLECTED.");
    }

    return lines.join("\n");
  }

  /** Summary stats for trace metadata */
  toStats(): { collected: number; required: number; missing: number; complete: boolean } {
    return {
      collected: this.collected.size,
      required: this.requiredFields.length,
      missing: this.getMissing().length,
      complete: this.isComplete(),
    };
  }
}
