/**
 * CaseStore — Materialised view of trace events as operational ledger cases.
 *
 * Lives alongside TraceStore in the same SQLite database. Cases are always
 * rebuildable from the immutable trace events — this is a pre-computed
 * operational view for dashboards and case tracking.
 */

import Database from "better-sqlite3";
import type {
  LedgerCase,
  CaseStatus,
  CaseTimelineEntry,
  LedgerDashboard,
  StateBottleneck,
  TraceEvent,
} from "@als/schemas";
import crypto from "crypto";

export class CaseStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.init();
  }

  private init(): void {
    this.db.exec(`
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
      this.db.exec("ALTER TABLE case_events ADD COLUMN trace_id TEXT");
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
  upsertCase(event: TraceEvent, totalStates?: number): void {
    const userId = event.metadata.userId;
    const serviceId = event.metadata.capabilityId || (event.payload.serviceId as string);
    if (!userId || !serviceId) return;

    const caseId = CaseStore.caseId(userId, serviceId);
    const now = event.timestamp;

    // Ensure the case row exists
    this.db.prepare(`
      INSERT OR IGNORE INTO cases (case_id, user_id, service_id, started_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(caseId, userId, serviceId, now, now);

    // Always update last_activity_at and event_count
    this.db.prepare(`
      UPDATE cases SET last_activity_at = ?, event_count = event_count + 1 WHERE case_id = ?
    `).run(now, caseId);

    // Apply type-specific updates
    const payload = event.payload;

    switch (event.type) {
      case "state.transition": {
        const toState = payload.toState as string;
        const fromState = payload.fromState as string;

        // Get current states_completed
        const row = this.db.prepare("SELECT states_completed FROM cases WHERE case_id = ?").get(caseId) as { states_completed: string } | undefined;
        const visited: string[] = row ? JSON.parse(row.states_completed) : [];
        if (fromState && !visited.includes(fromState)) visited.push(fromState);
        if (toState && !visited.includes(toState)) visited.push(toState);

        const progress = totalStates && totalStates > 0
          ? Math.round((visited.length / totalStates) * 100)
          : 0;

        // Check if this is an identity verification state
        const isIdentityState = toState === "identity-verified";
        // Check if this is a terminal state
        const isCompleted = toState === "claim-active" || toState === "completed" || toState === "Accepted";
        const isRejected = toState === "rejected";
        const isHandedOff = toState === "handed-off";

        let newStatus: CaseStatus = "in-progress";
        if (isCompleted) newStatus = "completed";
        else if (isRejected) newStatus = "rejected";
        else if (isHandedOff) newStatus = "handed-off";

        this.db.prepare(`
          UPDATE cases SET
            current_state = ?,
            states_completed = ?,
            progress_percent = ?,
            status = ?,
            identity_verified = CASE WHEN ? THEN 1 ELSE identity_verified END
          WHERE case_id = ?
        `).run(
          toState,
          JSON.stringify(visited),
          progress,
          newStatus,
          isIdentityState ? 1 : 0,
          caseId,
        );

        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "system",
          `State: ${fromState} -> ${toState}`, now);
        break;
      }

      case "consent.granted":
        this.db.prepare("UPDATE cases SET consent_granted = 1 WHERE case_id = ?").run(caseId);
        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "citizen",
          `Consent granted for ${payload.purpose || "data sharing"}`, now);
        break;

      case "consent.denied":
        this.db.prepare("UPDATE cases SET consent_granted = 0 WHERE case_id = ?").run(caseId);
        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "citizen",
          "Consent denied", now);
        break;

      case "policy.evaluated": {
        const eligible = payload.eligible as boolean;
        this.db.prepare(`
          UPDATE cases SET eligibility_checked = 1, eligibility_result = ? WHERE case_id = ?
        `).run(eligible ? 1 : 0, caseId);
        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "system",
          `Eligibility: ${eligible ? "eligible" : "not eligible"}`, now);
        break;
      }

      case "handoff.initiated":
        this.db.prepare(`
          UPDATE cases SET handed_off = 1, handoff_reason = ?, status = 'handed-off' WHERE case_id = ?
        `).run((payload.reason as string) || (payload.description as string) || "Unknown", caseId);
        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "system",
          `Handed off: ${payload.reason || payload.description || "reason unknown"}`, now);
        break;

      case "capability.invoked":
        this.db.prepare("UPDATE cases SET agent_actions = agent_actions + 1 WHERE case_id = ?").run(caseId);
        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "agent",
          `Invoked: ${payload.capabilityId || "capability"}`, now);
        break;

      case "llm.request":
        this.db.prepare("UPDATE cases SET agent_actions = agent_actions + 1 WHERE case_id = ?").run(caseId);
        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "agent",
          `Agent processing request`, now);
        break;

      case "llm.response":
        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "agent",
          `Agent responded (${payload.toolsUsed ? (payload.toolsUsed as string[]).length + " tools" : "no tools"})`, now);
        break;

      case "credential.presented":
        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "citizen",
          `Credential presented`, now);
        this.db.prepare("UPDATE cases SET human_actions = human_actions + 1 WHERE case_id = ?").run(caseId);
        break;

      case "receipt.issued":
        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "system",
          `Receipt issued: ${payload.action || ""}`, now);
        break;

      default:
        // For other events, just add to timeline
        this.addCaseEvent(caseId, event.id, event.traceId, event.type, "system",
          `${event.type}`, now);
        break;
    }
  }

  private addCaseEvent(
    caseId: string,
    traceEventId: string,
    traceId: string,
    eventType: string,
    actor: string,
    summary: string,
    createdAt: string,
  ): void {
    this.db.prepare(`
      INSERT INTO case_events (case_id, trace_event_id, trace_id, event_type, actor, summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(caseId, traceEventId, traceId, eventType, actor, summary, createdAt);
  }

  /** Get a single case by ID */
  getCase(caseId: string): LedgerCase | undefined {
    const row = this.db.prepare("SELECT * FROM cases WHERE case_id = ?").get(caseId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return this.rowToCase(row);
  }

  /** Get a case by userId + serviceId */
  getCaseByUser(userId: string, serviceId: string): LedgerCase | undefined {
    const caseId = CaseStore.caseId(userId, serviceId);
    return this.getCase(caseId);
  }

  /** List cases for a service with optional filtering */
  listCases(
    serviceId: string,
    opts?: { status?: string; page?: number; limit?: number },
  ): { cases: LedgerCase[]; total: number } {
    const page = opts?.page || 1;
    const limit = opts?.limit || 20;
    const offset = (page - 1) * limit;

    let where = "WHERE service_id = ?";
    const params: unknown[] = [serviceId];

    if (opts?.status) {
      where += " AND status = ?";
      params.push(opts.status);
    }

    const total = (this.db.prepare(`SELECT COUNT(*) as count FROM cases ${where}`).get(...params) as { count: number }).count;

    const rows = this.db.prepare(
      `SELECT * FROM cases ${where} ORDER BY last_activity_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as Array<Record<string, unknown>>;

    return { cases: rows.map(r => this.rowToCase(r)), total };
  }

  /** Get the timeline for a case, enriched with trace event payloads */
  getCaseTimeline(caseId: string): (CaseTimelineEntry & { tracePayload?: Record<string, unknown> })[] {
    const rows = this.db.prepare(`
      SELECT ce.*, te.payload as trace_payload, te.type as trace_type,
             te.span_id, te.trace_id as te_trace_id
      FROM case_events ce
      LEFT JOIN trace_events te ON ce.trace_event_id = te.id
      WHERE ce.case_id = ?
      ORDER BY ce.created_at ASC
    `).all(caseId) as Array<Record<string, unknown>>;

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
  getDashboard(serviceId: string): LedgerDashboard {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'handed-off' THEN 1 ELSE 0 END) as handed_off,
        AVG(progress_percent) as avg_progress,
        SUM(agent_actions) as agent_total,
        SUM(human_actions) as human_total
      FROM cases WHERE service_id = ?
    `).get(serviceId) as Record<string, number>;

    const total = stats.total || 0;
    const completed = stats.completed || 0;
    const handedOff = stats.handed_off || 0;

    const bottlenecks = this.getBottlenecks(serviceId);

    const recentRows = this.db.prepare(
      "SELECT * FROM cases WHERE service_id = ? ORDER BY last_activity_at DESC LIMIT 5"
    ).all(serviceId) as Array<Record<string, unknown>>;

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
  getDashboardAll(): LedgerDashboard {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'handed-off' THEN 1 ELSE 0 END) as handed_off,
        AVG(progress_percent) as avg_progress,
        SUM(agent_actions) as agent_total,
        SUM(human_actions) as human_total
      FROM cases
    `).get() as Record<string, number>;

    const total = stats.total || 0;
    const completed = stats.completed || 0;
    const handedOff = stats.handed_off || 0;

    const bottleneckRows = this.db.prepare(`
      SELECT current_state as stateId, COUNT(*) as caseCount
      FROM cases
      WHERE status = 'in-progress'
      GROUP BY current_state
      ORDER BY caseCount DESC
    `).all() as Array<{ stateId: string; caseCount: number }>;

    const recentRows = this.db.prepare(
      "SELECT * FROM cases ORDER BY last_activity_at DESC LIMIT 5"
    ).all() as Array<Record<string, unknown>>;

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
  getBottlenecks(serviceId: string): StateBottleneck[] {
    const rows = this.db.prepare(`
      SELECT current_state as stateId, COUNT(*) as caseCount
      FROM cases
      WHERE service_id = ? AND status = 'in-progress'
      GROUP BY current_state
      ORDER BY caseCount DESC
    `).all(serviceId) as Array<{ stateId: string; caseCount: number }>;

    return rows;
  }

  /** Delete a specific case and its events */
  deleteCase(caseId: string): void {
    this.db.prepare("DELETE FROM case_events WHERE case_id = ?").run(caseId);
    this.db.prepare("DELETE FROM cases WHERE case_id = ?").run(caseId);
  }

  /** Submit a case for human review */
  submitReview(caseId: string, reason: string, _priority: string): void {
    this.db.prepare(`
      UPDATE cases SET
        review_status = 'pending',
        review_requested_at = datetime('now'),
        review_reason = ?
      WHERE case_id = ?
    `).run(reason, caseId);
  }

  /** Rebuild all cases from trace events (disaster recovery) */
  rebuildFromTraces(totalStatesMap?: Record<string, number>): number {
    // Clear existing case data
    this.db.exec("DELETE FROM case_events");
    this.db.exec("DELETE FROM cases");

    // Replay all trace events in chronological order
    const events = this.db.prepare(
      "SELECT * FROM trace_events ORDER BY timestamp ASC"
    ).all() as Array<Record<string, string>>;

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
      this.upsertCase(event, totalStates);
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
