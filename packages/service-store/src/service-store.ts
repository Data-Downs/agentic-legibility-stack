/**
 * ServiceArtefactStore — DB-backed CRUD for service artefacts.
 *
 * Uses the DatabaseAdapter interface from @als/evidence so it works
 * with both SQLite (local dev) and Cloudflare D1 (production).
 */

import type { DatabaseAdapter } from "@als/evidence";
import type { CapabilityManifest } from "@als/schemas";
import type {
  ServiceRow,
  ServiceFilter,
  ServiceWithArtefacts,
  ServiceSummary,
} from "./types";

export class ServiceArtefactStore {
  constructor(private db: DatabaseAdapter) {}

  /** Create tables if they don't exist (SQLite local dev). D1 uses migrations. */
  async init(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        department_key TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'graph',
        service_type TEXT,
        govuk_url TEXT,
        eligibility_summary TEXT,
        promoted INTEGER NOT NULL DEFAULT 0,
        proactive INTEGER NOT NULL DEFAULT 0,
        gated INTEGER NOT NULL DEFAULT 0,
        manifest_json TEXT NOT NULL,
        policy_json TEXT,
        state_model_json TEXT,
        consent_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_services_department_key ON services(department_key);
      CREATE INDEX IF NOT EXISTS idx_services_source ON services(source);
      CREATE INDEX IF NOT EXISTS idx_services_promoted ON services(promoted);
    `);

    // Add columns if missing (safe for existing DBs)
    try {
      await this.db.exec(`ALTER TABLE services ADD COLUMN generated_at TEXT`);
    } catch { /* column already exists */ }
    try {
      await this.db.exec(`ALTER TABLE services ADD COLUMN interaction_type TEXT`);
    } catch { /* column already exists */ }
    try {
      await this.db.exec(`ALTER TABLE services ADD COLUMN card_definitions_json TEXT`);
    } catch { /* column already exists */ }
  }

  /** Get a single service with full artefacts */
  async getService(id: string): Promise<ServiceWithArtefacts | undefined> {
    const row = await this.db.get<ServiceRow>(
      "SELECT * FROM services WHERE id = ?",
      id
    );
    if (!row) return undefined;
    return this.rowToService(row);
  }

  /** List services with optional filtering (returns summaries, no full JSON) */
  async listServices(filter?: ServiceFilter): Promise<ServiceSummary[]> {
    let sql = "SELECT id, name, department, department_key, description, source, service_type, govuk_url, promoted, proactive, gated, generated_at, interaction_type, policy_json IS NOT NULL as has_policy, state_model_json IS NOT NULL as has_state_model, consent_json IS NOT NULL as has_consent, card_definitions_json IS NOT NULL as has_card_definitions FROM services WHERE 1=1";
    const params: unknown[] = [];

    if (filter?.department) {
      sql += " AND department_key = ?";
      params.push(filter.department);
    }
    if (filter?.source) {
      sql += " AND source = ?";
      params.push(filter.source);
    }
    if (filter?.promoted !== undefined) {
      sql += " AND promoted = ?";
      params.push(filter.promoted ? 1 : 0);
    }
    if (filter?.serviceType) {
      sql += " AND service_type = ?";
      params.push(filter.serviceType);
    }
    if (filter?.search) {
      sql += " AND (name LIKE ? OR description LIKE ? OR id LIKE ?)";
      const term = `%${filter.search}%`;
      params.push(term, term, term);
    }

    sql += " ORDER BY name ASC";

    const rows = await this.db.all<ServiceRow & { has_policy: number; has_state_model: number; has_consent: number; has_card_definitions: number; generated_at: string | null; interaction_type: string | null }>(
      sql,
      ...params
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      department: row.department,
      departmentKey: row.department_key,
      description: row.description,
      source: row.source as "full" | "graph",
      serviceType: row.service_type,
      govukUrl: row.govuk_url,
      promoted: !!row.promoted,
      hasPolicy: !!row.has_policy,
      hasStateModel: !!row.has_state_model,
      hasConsent: !!row.has_consent,
      hasCardDefinitions: !!row.has_card_definitions,
      generatedAt: row.generated_at || null,
      interactionType: row.interaction_type || null,
    }));
  }

  /** Insert a new service */
  async createService(data: {
    id: string;
    manifest: CapabilityManifest;
    policy?: Record<string, unknown> | null;
    stateModel?: Record<string, unknown> | null;
    consent?: Record<string, unknown> | null;
    cardDefinitions?: Array<Record<string, unknown>> | null;
    source?: "full" | "graph";
    departmentKey?: string;
  }): Promise<void> {
    const m = data.manifest;
    const deptKey = data.departmentKey || this.slugify(m.department || "");

    await this.db.run(
      `INSERT INTO services (id, name, department, department_key, description, source, service_type, govuk_url, eligibility_summary, promoted, proactive, gated, manifest_json, policy_json, state_model_json, consent_json, card_definitions_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data.id,
      m.name,
      m.department,
      deptKey,
      m.description || "",
      data.source || (data.policy ? "full" : "graph"),
      m.serviceType || null,
      m.govuk_url || null,
      m.eligibility_summary || null,
      m.promoted ? 1 : 0,
      m.proactive ? 1 : 0,
      m.gated ? 1 : 0,
      JSON.stringify(m),
      data.policy ? JSON.stringify(data.policy) : null,
      data.stateModel ? JSON.stringify(data.stateModel) : null,
      data.consent ? JSON.stringify(data.consent) : null,
      data.cardDefinitions ? JSON.stringify(data.cardDefinitions) : null
    );
  }

  /** Update an existing service */
  async updateService(
    id: string,
    data: {
      manifest?: CapabilityManifest;
      policy?: Record<string, unknown> | null;
      stateModel?: Record<string, unknown> | null;
      consent?: Record<string, unknown> | null;
      cardDefinitions?: Array<Record<string, unknown>> | null;
      source?: "full" | "graph";
      generatedAt?: string;
      interactionType?: string;
    }
  ): Promise<boolean> {
    const existing = await this.getService(id);
    if (!existing) return false;

    const m = data.manifest || existing.manifest;

    await this.db.run(
      `UPDATE services SET
        name = ?, department = ?, department_key = ?, description = ?,
        source = ?,
        service_type = ?, govuk_url = ?, eligibility_summary = ?,
        promoted = ?, proactive = ?, gated = ?,
        manifest_json = ?, policy_json = ?, state_model_json = ?, consent_json = ?,
        card_definitions_json = ?,
        generated_at = ?, interaction_type = ?,
        updated_at = datetime('now')
       WHERE id = ?`,
      m.name,
      m.department,
      this.slugify(m.department || ""),
      m.description || "",
      data.source || existing.source,
      m.serviceType || null,
      m.govuk_url || null,
      m.eligibility_summary || null,
      m.promoted ? 1 : 0,
      m.proactive ? 1 : 0,
      m.gated ? 1 : 0,
      JSON.stringify(m),
      data.policy !== undefined
        ? data.policy
          ? JSON.stringify(data.policy)
          : null
        : existing.policy
          ? JSON.stringify(existing.policy)
          : null,
      data.stateModel !== undefined
        ? data.stateModel
          ? JSON.stringify(data.stateModel)
          : null
        : existing.stateModel
          ? JSON.stringify(existing.stateModel)
          : null,
      data.consent !== undefined
        ? data.consent
          ? JSON.stringify(data.consent)
          : null
        : existing.consent
          ? JSON.stringify(existing.consent)
          : null,
      data.cardDefinitions !== undefined
        ? data.cardDefinitions
          ? JSON.stringify(data.cardDefinitions)
          : null
        : existing.cardDefinitions
          ? JSON.stringify(existing.cardDefinitions)
          : null,
      data.generatedAt !== undefined ? data.generatedAt : existing.generatedAt,
      data.interactionType !== undefined ? data.interactionType : existing.interactionType,
      id
    );

    return true;
  }

  /** Delete a service */
  async deleteService(id: string): Promise<boolean> {
    const result = await this.db.run("DELETE FROM services WHERE id = ?", id);
    return result.changes > 0;
  }

  /** Toggle the promoted flag */
  async togglePromoted(id: string): Promise<boolean | undefined> {
    const row = await this.db.get<{ promoted: number }>(
      "SELECT promoted FROM services WHERE id = ?",
      id
    );
    if (!row) return undefined;

    const newVal = row.promoted ? 0 : 1;
    await this.db.run(
      "UPDATE services SET promoted = ?, updated_at = datetime('now') WHERE id = ?",
      newVal,
      id
    );
    return !!newVal;
  }

  /** Get the count of services in the store */
  async count(): Promise<number> {
    const row = await this.db.get<{ cnt: number }>("SELECT COUNT(*) as cnt FROM services");
    return row?.cnt || 0;
  }

  /** Check if the store is empty (used for auto-seed detection) */
  async isEmpty(): Promise<boolean> {
    return (await this.count()) === 0;
  }

  /** Gap analysis for a service */
  analyzeGaps(service: ServiceWithArtefacts): Array<{
    field: string;
    status: "present" | "missing" | "incomplete";
    artefact: "manifest" | "policy" | "state-model" | "consent";
  }> {
    const gaps: Array<{
      field: string;
      status: "present" | "missing" | "incomplete";
      artefact: "manifest" | "policy" | "state-model" | "consent";
    }> = [];

    const m = service.manifest;
    gaps.push({ field: "id", status: m.id ? "present" : "missing", artefact: "manifest" });
    gaps.push({ field: "name", status: m.name ? "present" : "missing", artefact: "manifest" });
    gaps.push({ field: "description", status: m.description ? "present" : "missing", artefact: "manifest" });
    gaps.push({ field: "department", status: m.department ? "present" : "missing", artefact: "manifest" });
    gaps.push({ field: "input_schema", status: m.input_schema ? "present" : "missing", artefact: "manifest" });
    gaps.push({ field: "output_schema", status: m.output_schema ? "present" : "missing", artefact: "manifest" });
    gaps.push({ field: "constraints", status: m.constraints ? "present" : "missing", artefact: "manifest" });
    gaps.push({ field: "redress", status: m.redress ? "present" : "missing", artefact: "manifest" });
    gaps.push({ field: "audit_requirements", status: m.audit_requirements ? "present" : "missing", artefact: "manifest" });
    gaps.push({ field: "handoff", status: m.handoff ? "present" : "missing", artefact: "manifest" });

    if (service.policy) {
      const p = service.policy;
      gaps.push({ field: "policy.rules", status: p.rules.length > 0 ? "present" : "missing", artefact: "policy" });
      gaps.push({ field: "policy.edge_cases", status: (p.edge_cases?.length || 0) > 0 ? "present" : "missing", artefact: "policy" });
      gaps.push({ field: "policy.explanation_template", status: p.explanation_template ? "present" : "missing", artefact: "policy" });
    } else {
      gaps.push({ field: "policy", status: "missing", artefact: "policy" });
    }

    if (service.stateModel) {
      const s = service.stateModel;
      gaps.push({ field: "state-model.states", status: s.states.length > 0 ? "present" : "missing", artefact: "state-model" });
      gaps.push({ field: "state-model.transitions", status: s.transitions.length > 0 ? "present" : "missing", artefact: "state-model" });
      const hasInitial = s.states.some((st) => st.type === "initial");
      const hasTerminal = s.states.some((st) => st.type === "terminal");
      gaps.push({ field: "state-model.initial_state", status: hasInitial ? "present" : "missing", artefact: "state-model" });
      gaps.push({ field: "state-model.terminal_states", status: hasTerminal ? "present" : "missing", artefact: "state-model" });
    } else {
      gaps.push({ field: "state-model", status: "missing", artefact: "state-model" });
    }

    if (service.consent) {
      const c = service.consent;
      gaps.push({ field: "consent.grants", status: c.grants.length > 0 ? "present" : "missing", artefact: "consent" });
      gaps.push({ field: "consent.revocation", status: c.revocation ? "present" : "missing", artefact: "consent" });
      gaps.push({ field: "consent.delegation", status: c.delegation ? "present" : "missing", artefact: "consent" });
    } else {
      gaps.push({ field: "consent", status: "missing", artefact: "consent" });
    }

    return gaps;
  }

  // --- Private helpers ---

  private rowToService(row: ServiceRow): ServiceWithArtefacts {
    return {
      id: row.id,
      name: row.name,
      department: row.department,
      departmentKey: row.department_key,
      description: row.description,
      source: row.source as "full" | "graph",
      serviceType: row.service_type,
      govukUrl: row.govuk_url,
      eligibilitySummary: row.eligibility_summary,
      promoted: !!row.promoted,
      proactive: !!row.proactive,
      gated: !!row.gated,
      manifest: JSON.parse(row.manifest_json),
      policy: row.policy_json ? JSON.parse(row.policy_json) : null,
      stateModel: row.state_model_json ? JSON.parse(row.state_model_json) : null,
      consent: row.consent_json ? JSON.parse(row.consent_json) : null,
      cardDefinitions: row.card_definitions_json ? JSON.parse(row.card_definitions_json) : null,
      generatedAt: row.generated_at || null,
      interactionType: row.interaction_type || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}
