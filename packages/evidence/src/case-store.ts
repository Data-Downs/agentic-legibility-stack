/**
 * CaseStore — Materialised view of trace events as operational ledger cases.
 *
 * Cases are always rebuildable from the immutable trace events — this is a
 * pre-computed operational view for dashboards and case tracking.
 *
 * Backend-agnostic: works with SqliteAdapter (local) or D1Adapter (Cloudflare).
 */

import type {
  LedgerCase,
  CaseStatus,
  CaseTimelineEntry,
  LedgerDashboard,
  StateBottleneck,
  TraceEvent,
} from "@als/schemas";
import crypto from "crypto";
import type { DatabaseAdapter } from "./db-adapter";

export class CaseStore {
  private db: DatabaseAdapter;

  constructor(adapter: DatabaseAdapter) {
    this.db = adapter;
  }

  async init(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS cases (
        case_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        current_state TEXT NOT NULL DEFAULT 'not-started',
        status TEXT NOT NULL DEFAULT 'in-progress',
        started_at TEXT NOT NULL,
        last_activity_at TEXT NOT NULL,
        states_completed TEXT NOT NULL DEFAULT '[]',
        progress_percent REAL NOT NULL DEFAULT 0,
        identity_verified INTEGER NOT NULL DEFAULT 0,
        eligibility_checked INTEGER NOT NULL DEFAULT 0,
        eligibility_result INTEGER,
        consent_granted INTEGER NOT NULL DEFAULT 0,
        handed_off INTEGER NOT NULL DEFAULT 0,
        handoff_reason TEXT,
        agent_actions INTEGER NOT NULL DEFAULT 0,
        human_actions INTEGER NOT NULL DEFAULT 0,
        review_status TEXT,
        review_requested_at TEXT,
        review_reason TEXT,
        event_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_cases_service_id ON cases(service_id);
      CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
      CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id);
      CREATE INDEX IF NOT EXISTS idx_cases_last_activity ON cases(last_activity_at);

      CREATE TABLE IF NOT EXISTS case_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT NOT NULL,
        trace_event_id TEXT NOT NULL,
        trace_id TEXT,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL DEFAULT 'system',
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (case_id) REFERENCES cases(case_id)
      );

      CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
    `);

    // Migration: add trace_id column if missing (for existing databases)
    try {
      await this.db.exec("ALTER TABLE case_events ADD COLUMN trace_id TEXT");
    } catch {
      // Column already exists — ignore
    }
  }

  /** Generate a deterministic case ID from userId + serviceId */
  static caseId(userId: string, serviceId: string): string {
    return crypto
      .createHash("sha256")
      .update(`${userId}:${serviceId}`)
      .digest("hex")
      .slice(0, 16);
  }

  /** Create or update a case when a trace event is emitted */
  async upsertCase(event: TraceEvent, totalStates?: number): Promise<void> {
    const userId = event.metadata.userId;
    const serviceId = event.metadata.capabilityId || (event.payload.serviceId as string);
    if (!userId || !serviceId) return;

    const caseId = CaseStore.caseId(userId, serviceId);
    const now = event.timestamp;

    // Ensure the case row exists
    await this.db.run(
      `INSERT OR IGNORE INTO cases (case_id, user_id, service_id, started_at, last_activity_at)
       VALUES (?, ?, ?, ?, ?)`,
      caseId, userId, serviceId, now, now,
    );

    // Always update last_activity_at and event_count
    await this.db.run(
      `UPDATE cases SET last_activity_at = ?, event_count = event_count + 1 WHERE case_id = ?`,
      now, caseId,
    );

    // Apply type-specific updates
    const payload = event.payload;

    switch (event.type) {
      case "state.transition": {
        const toState = payload.toState as string;
        const fromState = payload.fromState as string;

        // Get current states_completed
        const row = await this.db.get<{ states_completed: string }>(
          "SELECT states_completed FROM cases WHERE case_id = ?", caseId,
        );
        const visited: string[] = row ? JSON.parse(row.states_completed) : [];
        if (fromState && !visited.includes(fromState)) visited.push(fromState);
        if (toState && !visited.includes(toState)) visited.push(toState);

        const progress = totalStates && totalStates > 0
          ? Math.round((visited.length / totalStates) * 100)
          : 0;

        const isIdentityState = toState === "identity-verified";
        const isCompleted = toState === "claim-active" || toState === "completed" || toState === "Accepted";
        const isRejected = toState === "rejected";
        const isHandedOff = toState === "handed-off";

        let newStatus: CaseStatus = "in-progress";
        if (isCompleted) newStatus = "completed";
        else if (isRejected) newStatus = "rejected";
        else if (isHandedOff) newStatus = "handed-off";

        await this.db.run(
          `UPDATE cases SET
            current_state = ?,
            states_completed = ?,
            progress_percent = ?,
            status = ?,
            identity_verified = CASE WHEN ? THEN 1 ELSE identity_verified END
          WHERE case_id = ?`,
          toState,
          JSON.stringify(visited),
          progress,
          newStatus,
          isIdentityState ? 1 : 0,
          caseId,
        );

        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "system",
          `State: ${fromState} -> ${toState}`, now);
        break;
      }

      case "consent.granted":
        await this.db.run("UPDATE cases SET consent_granted = 1 WHERE case_id = ?", caseId);
        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "citizen",
          `Consent granted for ${payload.purpose || "data sharing"}`, now);
        break;

      case "consent.denied":
        await this.db.run("UPDATE cases SET consent_granted = 0 WHERE case_id = ?", caseId);
        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "citizen",
          "Consent denied", now);
        break;

      case "policy.evaluated": {
        const eligible = payload.eligible as boolean;
        await this.db.run(
          `UPDATE cases SET eligibility_checked = 1, eligibility_result = ? WHERE case_id = ?`,
          eligible ? 1 : 0, caseId,
        );
        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "system",
          `Eligibility: ${eligible ? "eligible" : "not eligible"}`, now);
        break;
      }

      case "handoff.initiated":
        await this.db.run(
          `UPDATE cases SET handed_off = 1, handoff_reason = ?, status = 'handed-off' WHERE case_id = ?`,
          (payload.reason as string) || (payload.description as string) || "Unknown", caseId,
        );
        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "system",
          `Handed off: ${payload.reason || payload.description || "reason unknown"}`, now);
        break;

      case "capability.invoked":
        await this.db.run("UPDATE cases SET agent_actions = agent_actions + 1 WHERE case_id = ?", caseId);
        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "agent",
          `Invoked: ${payload.capabilityId || "capability"}`, now);
        break;

      case "llm.request":
        await this.db.run("UPDATE cases SET agent_actions = agent_actions + 1 WHERE case_id = ?", caseId);
        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "agent",
          `Agent processing request`, now);
        break;

      case "llm.response":
        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "agent",
          `Agent responded (${payload.toolsUsed ? (payload.toolsUsed as string[]).length + " tools" : "no tools"})`, now);
        break;

      case "credential.presented":
        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "citizen",
          `Credential presented`, now);
        await this.db.run("UPDATE cases SET human_actions = human_actions + 1 WHERE case_id = ?", caseId);
        break;

      case "receipt.issued":
        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "system",
          `Receipt issued: ${payload.action || ""}`, now);
        break;

      default:
        await this.addCaseEvent(caseId, event.id, event.traceId, event.type, "system",
          `${event.type}`, now);
        break;
    }
  }

  private async addCaseEvent(
    caseId: string,
    traceEventId: string,
    traceId: string,
    eventType: string,
    actor: string,
    summary: string,
    createdAt: string,
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO case_events (case_id, trace_event_id, trace_id, event_type, actor, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      caseId, traceEventId, traceId, eventType, actor, summary, createdAt,
    );
  }

  /** Get a single case by ID */
  async getCase(caseId: string): Promise<LedgerCase | undefined> {
    const row = await this.db.get<Record<string, unknown>>(
      "SELECT * FROM cases WHERE case_id = ?", caseId,
    );
    if (!row) return undefined;
    return this.rowToCase(row);
  }

  /** Get a case by userId + serviceId */
  async getCaseByUser(userId: string, serviceId: string): Promise<LedgerCase | undefined> {
    const caseId = CaseStore.caseId(userId, serviceId);
    return this.getCase(caseId);
  }

  /** List cases for a service with optional filtering */
  async listCases(
    serviceId: string,
    opts?: { status?: string; page?: number; limit?: number },
  ): Promise<{ cases: LedgerCase[]; total: number }> {
    const page = opts?.page || 1;
    const limit = opts?.limit || 20;
    const offset = (page - 1) * limit;

    let where = "WHERE service_id = ?";
    const params: unknown[] = [serviceId];

    if (opts?.status) {
      where += " AND status = ?";
      params.push(opts.status);
    }

    const countRow = await this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM cases ${where}`, ...params,
    );
    const total = countRow?.count ?? 0;

    const rows = await this.db.all<Record<string, unknown>>(
      `SELECT * FROM cases ${where} ORDER BY last_activity_at DESC LIMIT ? OFFSET ?`,
      ...params, limit, offset,
    );

    return { cases: rows.map(r => this.rowToCase(r)), total };
  }

  /** Get the timeline for a case, enriched with trace event payloads */
  async getCaseTimeline(caseId: string): Promise<(CaseTimelineEntry & { tracePayload?: Record<string, unknown> })[]> {
    const rows = await this.db.all<Record<string, unknown>>(
      `SELECT ce.*, te.payload as trace_payload, te.type as trace_type,
              te.span_id, te.trace_id as te_trace_id
       FROM case_events ce
       LEFT JOIN trace_events te ON ce.trace_event_id = te.id
       WHERE ce.case_id = ?
       ORDER BY ce.created_at ASC`,
      caseId,
    );

    return rows.map(r => ({
      caseId: r.case_id as string,
      traceEventId: r.trace_event_id as string,
      traceId: (r.trace_id as string) || (r.te_trace_id as string) || undefined,
      eventType: r.event_type as string,
      actor: r.actor as "agent" | "citizen" | "system",
      summary: r.summary as string,
      createdAt: r.created_at as string,
      tracePayload: r.trace_payload ? JSON.parse(r.trace_payload as string) : undefined,
    }));
  }

  /** Get aggregated dashboard data for a service */
  async getDashboard(serviceId: string): Promise<LedgerDashboard> {
    const stats = await this.db.get<Record<string, number>>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'handed-off' THEN 1 ELSE 0 END) as handed_off,
        AVG(progress_percent) as avg_progress,
        SUM(agent_actions) as agent_total,
        SUM(human_actions) as human_total
      FROM cases WHERE service_id = ?`,
      serviceId,
    ) ?? {} as Record<string, number>;

    const total = stats.total || 0;
    const completed = stats.completed || 0;
    const handedOff = stats.handed_off || 0;

    const bottlenecks = await this.getBottlenecks(serviceId);

    const recentRows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM cases WHERE service_id = ? ORDER BY last_activity_at DESC LIMIT 5",
      serviceId,
    );

    return {
      serviceId,
      totalCases: total,
      activeCases: stats.active || 0,
      completedCases: completed,
      rejectedCases: stats.rejected || 0,
      handedOffCases: handedOff,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      handoffRate: total > 0 ? Math.round((handedOff / total) * 100) : 0,
      avgProgress: Math.round(stats.avg_progress || 0),
      agentActionTotal: stats.agent_total || 0,
      humanActionTotal: stats.human_total || 0,
      bottlenecks,
      recentCases: recentRows.map(r => this.rowToCase(r)),
    };
  }

  /** Get aggregated dashboard data across ALL services */
  async getDashboardAll(): Promise<LedgerDashboard> {
    const stats = await this.db.get<Record<string, number>>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'handed-off' THEN 1 ELSE 0 END) as handed_off,
        AVG(progress_percent) as avg_progress,
        SUM(agent_actions) as agent_total,
        SUM(human_actions) as human_total
      FROM cases`,
    ) ?? {} as Record<string, number>;

    const total = stats.total || 0;
    const completed = stats.completed || 0;
    const handedOff = stats.handed_off || 0;

    const bottleneckRows = await this.db.all<{ stateId: string; caseCount: number }>(
      `SELECT current_state as stateId, COUNT(*) as caseCount
       FROM cases
       WHERE status = 'in-progress'
       GROUP BY current_state
       ORDER BY caseCount DESC`,
    );

    const recentRows = await this.db.all<Record<string, unknown>>(
      "SELECT * FROM cases ORDER BY last_activity_at DESC LIMIT 5",
    );

    return {
      serviceId: "_all",
      totalCases: total,
      activeCases: stats.active || 0,
      completedCases: completed,
      rejectedCases: stats.rejected || 0,
      handedOffCases: handedOff,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      handoffRate: total > 0 ? Math.round((handedOff / total) * 100) : 0,
      avgProgress: Math.round(stats.avg_progress || 0),
      agentActionTotal: stats.agent_total || 0,
      humanActionTotal: stats.human_total || 0,
      bottlenecks: bottleneckRows,
      recentCases: recentRows.map(r => this.rowToCase(r)),
    };
  }

  /** Get states where cases are getting stuck */
  async getBottlenecks(serviceId: string): Promise<StateBottleneck[]> {
    return this.db.all<StateBottleneck>(
      `SELECT current_state as stateId, COUNT(*) as caseCount
       FROM cases
       WHERE service_id = ? AND status = 'in-progress'
       GROUP BY current_state
       ORDER BY caseCount DESC`,
      serviceId,
    );
  }

  /** Delete a specific case and its events */
  async deleteCase(caseId: string): Promise<void> {
    await this.db.run("DELETE FROM case_events WHERE case_id = ?", caseId);
    await this.db.run("DELETE FROM cases WHERE case_id = ?", caseId);
  }

  /** Submit a case for human review */
  async submitReview(caseId: string, reason: string, _priority: string): Promise<void> {
    await this.db.run(
      `UPDATE cases SET
        review_status = 'pending',
        review_requested_at = datetime('now'),
        review_reason = ?
      WHERE case_id = ?`,
      reason, caseId,
    );
  }

  /** Rebuild all cases from trace events (disaster recovery) */
  async rebuildFromTraces(totalStatesMap?: Record<string, number>): Promise<number> {
    await this.db.exec("DELETE FROM case_events");
    await this.db.exec("DELETE FROM cases");

    const events = await this.db.all<Record<string, string>>(
      "SELECT * FROM trace_events ORDER BY timestamp ASC",
    );

    let processed = 0;
    for (const row of events) {
      const event: TraceEvent = {
        id: row.id,
        traceId: row.trace_id,
        spanId: row.span_id,
        parentSpanId: row.parent_span_id || undefined,
        timestamp: row.timestamp,
        type: row.type as TraceEvent["type"],
        payload: JSON.parse(row.payload),
        metadata: JSON.parse(row.metadata),
      };

      const serviceId = event.metadata.capabilityId || (event.payload.serviceId as string);
      const totalStates = serviceId && totalStatesMap ? totalStatesMap[serviceId] : undefined;
      await this.upsertCase(event, totalStates);
      processed++;
    }

    return processed;
  }

  private rowToCase(row: Record<string, unknown>): LedgerCase {
    return {
      caseId: row.case_id as string,
      userId: row.user_id as string,
      serviceId: row.service_id as string,
      currentState: row.current_state as string,
      status: row.status as CaseStatus,
      startedAt: row.started_at as string,
      lastActivityAt: row.last_activity_at as string,
      statesCompleted: JSON.parse((row.states_completed as string) || "[]"),
      progressPercent: row.progress_percent as number,
      identityVerified: !!(row.identity_verified as number),
      eligibilityChecked: !!(row.eligibility_checked as number),
      eligibilityResult: row.eligibility_result === null ? null : !!(row.eligibility_result as number),
      consentGranted: !!(row.consent_granted as number),
      handedOff: !!(row.handed_off as number),
      handoffReason: (row.handoff_reason as string) || null,
      agentActions: row.agent_actions as number,
      humanActions: row.human_actions as number,
      reviewStatus: (row.review_status as LedgerCase["reviewStatus"]) || null,
      reviewRequestedAt: (row.review_requested_at as string) || null,
      reviewReason: (row.review_reason as string) || null,
      eventCount: row.event_count as number,
    };
  }
}
