/**
 * IncidentalStore — In-memory Tier 2 data store
 *
 * Stores data collected incidentally during conversations.
 * Architecturally marked for on-device storage only —
 * this data never leaves the citizen's device in production.
 *
 * In this simulation it's kept in-memory per session.
 */

import type { IncidentalField, IncidentalData } from "./data-model";

export class IncidentalStore {
  private data = new Map<string, IncidentalData>();

  /** Get all incidental data for a user */
  getAll(userId: string): IncidentalData {
    return this.data.get(userId) || { fields: new Map() };
  }

  /** Store an incidental data point */
  store(userId: string, field: IncidentalField): void {
    let userData = this.data.get(userId);
    if (!userData) {
      userData = { fields: new Map() };
      this.data.set(userId, userData);
    }
    userData.fields.set(field.key, field);
  }

  /** Record data from a conversation */
  recordFromConversation(
    userId: string,
    key: string,
    value: unknown,
    sessionId: string,
    confidence: IncidentalField["confidence"] = "stated"
  ): IncidentalField {
    const field: IncidentalField = {
      key,
      value,
      source: "conversation",
      confidence,
      collectedAt: new Date().toISOString(),
      sessionId,
    };
    this.store(userId, field);
    return field;
  }

  /** Get a specific field */
  getField(userId: string, key: string): IncidentalField | undefined {
    return this.data.get(userId)?.fields.get(key);
  }

  /** Remove a field (citizen can delete their incidental data) */
  removeField(userId: string, key: string): boolean {
    const userData = this.data.get(userId);
    if (!userData) return false;
    return userData.fields.delete(key);
  }

  /** Clear all incidental data for a user */
  clearAll(userId: string): void {
    this.data.delete(userId);
  }

  /** Get field count for a user */
  fieldCount(userId: string): number {
    return this.data.get(userId)?.fields.size || 0;
  }
}
