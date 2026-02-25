/**
 * ServiceAccessStore — Tracks which services have access to which personal data fields.
 *
 * Created when consent is granted; revocable per-field or per-service.
 */

import type { DatabaseAdapter } from "@als/evidence";
import type { ServiceAccessGrant } from "./data-model";

export class ServiceAccessStore {
  constructor(private db: DatabaseAdapter) {}

  async grant(userId: string, grant: Omit<ServiceAccessGrant, "id" | "grantedAt" | "revokedAt">): Promise<ServiceAccessGrant> {
    const id = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO service_access (id, user_id, service_id, field_key, data_tier, purpose, granted_at, consent_record_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id, userId, grant.serviceId, grant.fieldKey, grant.dataTier, grant.purpose || null, now, grant.consentRecordId || null
    );
    return { id, ...grant, grantedAt: now };
  }

  async revoke(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const result = await this.db.run(
      "UPDATE service_access SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
      now, id
    );
    return result.changes > 0;
  }

  async revokeByService(userId: string, serviceId: string): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db.run(
      "UPDATE service_access SET revoked_at = ? WHERE user_id = ? AND service_id = ? AND revoked_at IS NULL",
      now, userId, serviceId
    );
    return result.changes;
  }

  async revokeByField(userId: string, fieldKey: string): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db.run(
      "UPDATE service_access SET revoked_at = ? WHERE user_id = ? AND field_key = ? AND revoked_at IS NULL",
      now, userId, fieldKey
    );
    return result.changes;
  }

  /** Get all active grants for a user, grouped by service */
  async getAccessMap(userId: string): Promise<Record<string, ServiceAccessGrant[]>> {
    const rows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM service_access WHERE user_id = ? AND revoked_at IS NULL ORDER BY service_id, field_key",
      userId
    );
    const map: Record<string, ServiceAccessGrant[]> = {};
    for (const row of rows) {
      const grant = this.rowToGrant(row);
      if (!map[grant.serviceId]) map[grant.serviceId] = [];
      map[grant.serviceId].push(grant);
    }
    return map;
  }

  /** Get all services that have access to a specific field */
  async getFieldAccess(userId: string, fieldKey: string): Promise<ServiceAccessGrant[]> {
    const rows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM service_access WHERE user_id = ? AND field_key = ? AND revoked_at IS NULL",
      userId, fieldKey
    );
    return rows.map(this.rowToGrant);
  }

  /** Get all fields a service has access to */
  async getServiceFields(userId: string, serviceId: string): Promise<ServiceAccessGrant[]> {
    const rows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM service_access WHERE user_id = ? AND service_id = ? AND revoked_at IS NULL",
      userId, serviceId
    );
    return rows.map(this.rowToGrant);
  }

  async hasAccess(userId: string, serviceId: string, fieldKey: string): Promise<boolean> {
    const row = await this.db.get<Record<string, unknown>>(
      "SELECT id FROM service_access WHERE user_id = ? AND service_id = ? AND field_key = ? AND revoked_at IS NULL LIMIT 1",
      userId, serviceId, fieldKey
    );
    return !!row;
  }

  /** Get all grants (including revoked) for consent history */
  async getAllGrants(userId: string): Promise<ServiceAccessGrant[]> {
    const rows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM service_access WHERE user_id = ? ORDER BY granted_at DESC",
      userId
    );
    return rows.map(this.rowToGrant);
  }

  private rowToGrant(row: Record<string, unknown>): ServiceAccessGrant {
    return {
      id: row.id as string,
      serviceId: row.service_id as string,
      fieldKey: row.field_key as string,
      dataTier: row.data_tier as string,
      purpose: (row.purpose as string) || undefined,
      grantedAt: row.granted_at as string,
      revokedAt: (row.revoked_at as string) || undefined,
      consentRecordId: (row.consent_record_id as string) || undefined,
    };
  }
}
