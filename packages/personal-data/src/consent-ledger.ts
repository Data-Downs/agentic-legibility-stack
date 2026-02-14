/**
 * ConsentLedger — Append-only SQLite store for consent records
 *
 * Every consent decision (grant or deny) is recorded permanently.
 * Citizens can review their full consent history.
 */

import Database from "better-sqlite3";
import type { ConsentRecord } from "./data-model";

export class ConsentLedger {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init(): void {
    this.db.exec(`
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
    `);
  }

  /** Record a consent decision */
  record(consent: ConsentRecord): void {
    this.db.prepare(`
      INSERT INTO consent_records (id, user_id, grant_id, service_id, granted, data_fields, purpose, timestamp, session_id, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
  revoke(consentId: string): void {
    this.db.prepare(
      "UPDATE consent_records SET revoked_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), consentId);
  }

  /** Get all consent records for a user */
  getByUser(userId: string): ConsentRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM consent_records WHERE user_id = ? ORDER BY timestamp DESC")
      .all(userId) as Array<Record<string, unknown>>;
    return rows.map(this.rowToRecord);
  }

  /** Get consent records for a specific service */
  getByService(userId: string, serviceId: string): ConsentRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM consent_records WHERE user_id = ? AND service_id = ? ORDER BY timestamp DESC")
      .all(userId, serviceId) as Array<Record<string, unknown>>;
    return rows.map(this.rowToRecord);
  }

  /** Check if a specific consent is currently active (granted and not revoked) */
  isActive(userId: string, grantId: string, serviceId: string): boolean {
    const row = this.db
      .prepare(
        "SELECT * FROM consent_records WHERE user_id = ? AND grant_id = ? AND service_id = ? AND granted = 1 AND revoked_at IS NULL ORDER BY timestamp DESC LIMIT 1"
      )
      .get(userId, grantId, serviceId) as Record<string, unknown> | undefined;
    return !!row;
  }

  /** Close the database */
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
