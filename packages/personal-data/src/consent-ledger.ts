/**
 * ConsentLedger — Append-only store for consent records
 *
 * Every consent decision (grant or deny) is recorded permanently.
 * Citizens can review their full consent history.
 *
 * Supports both DatabaseAdapter (async, portable) and direct better-sqlite3 (legacy).
 */

import type { DatabaseAdapter } from "@als/evidence";
import type { ConsentRecord } from "./data-model";

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS consent_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    grant_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    granted INTEGER NOT NULL,
    data_fields TEXT NOT NULL,
    purpose TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    session_id TEXT NOT NULL,
    revoked_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id);
  CREATE INDEX IF NOT EXISTS idx_consent_service ON consent_records(service_id);
`;

export class ConsentLedger {
  private db: DatabaseAdapter;

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  async init(): Promise<void> {
    await this.db.exec(CREATE_SQL);
  }

  /** Record a consent decision */
  async record(consent: ConsentRecord): Promise<void> {
    await this.db.run(
      `INSERT INTO consent_records (id, user_id, grant_id, service_id, granted, data_fields, purpose, timestamp, session_id, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      consent.id,
      consent.userId,
      consent.grantId,
      consent.serviceId,
      consent.granted ? 1 : 0,
      JSON.stringify(consent.dataFields),
      consent.purpose,
      consent.timestamp,
      consent.sessionId,
      consent.revokedAt || null
    );
  }

  /** Revoke a consent grant */
  async revoke(consentId: string): Promise<void> {
    await this.db.run(
      "UPDATE consent_records SET revoked_at = ? WHERE id = ?",
      new Date().toISOString(), consentId
    );
  }

  /** Get all consent records for a user */
  async getByUser(userId: string): Promise<ConsentRecord[]> {
    const rows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM consent_records WHERE user_id = ? ORDER BY timestamp DESC",
      userId
    );
    return rows.map(this.rowToRecord);
  }

  /** Get consent records for a specific service */
  async getByService(userId: string, serviceId: string): Promise<ConsentRecord[]> {
    const rows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM consent_records WHERE user_id = ? AND service_id = ? ORDER BY timestamp DESC",
      userId, serviceId
    );
    return rows.map(this.rowToRecord);
  }

  /** Check if a specific consent is currently active (granted and not revoked) */
  async isActive(userId: string, grantId: string, serviceId: string): Promise<boolean> {
    const row = await this.db.get<Record<string, unknown>>(
      "SELECT * FROM consent_records WHERE user_id = ? AND grant_id = ? AND service_id = ? AND granted = 1 AND revoked_at IS NULL ORDER BY timestamp DESC LIMIT 1",
      userId, grantId, serviceId
    );
    return !!row;
  }

  close(): void {
    this.db.close();
  }

  private rowToRecord(row: Record<string, unknown>): ConsentRecord {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      grantId: row.grant_id as string,
      serviceId: row.service_id as string,
      granted: row.granted === 1,
      dataFields: JSON.parse(row.data_fields as string),
      purpose: row.purpose as string,
      timestamp: row.timestamp as string,
      sessionId: row.session_id as string,
      revokedAt: (row.revoked_at as string) || undefined,
    };
  }
}
