/**
 * ServiceGraphStore — DB-backed storage for service graph relationships
 * (edges, life events, and traversal queries).
 */

import type { DatabaseAdapter } from "@als/evidence";
import type {
  EdgeRow,
  LifeEventRow,
  LifeEventServiceRow,
  LifeEventWithServices,
  DepartmentInfo,
} from "./types";

export class ServiceGraphStore {
  constructor(private db: DatabaseAdapter) {}

  /** Create tables if they don't exist (SQLite local dev). D1 uses migrations. */
  async init(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_service_id TEXT NOT NULL,
        to_service_id TEXT NOT NULL,
        edge_type TEXT NOT NULL CHECK(edge_type IN ('REQUIRES', 'ENABLES')),
        UNIQUE(from_service_id, to_service_id, edge_type)
      );

      CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_service_id);
      CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_service_id);

      CREATE TABLE IF NOT EXISTS life_events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS life_event_services (
        life_event_id TEXT NOT NULL,
        service_id TEXT NOT NULL,
        PRIMARY KEY (life_event_id, service_id)
      );

      CREATE INDEX IF NOT EXISTS idx_les_life_event ON life_event_services(life_event_id);
    `);
  }

  /** Get all life events with their entry-node service IDs */
  async getLifeEvents(): Promise<LifeEventWithServices[]> {
    const events = await this.db.all<LifeEventRow>("SELECT * FROM life_events ORDER BY name ASC");
    const mappings = await this.db.all<LifeEventServiceRow>("SELECT * FROM life_event_services");

    const serviceMap = new Map<string, string[]>();
    for (const m of mappings) {
      if (!serviceMap.has(m.life_event_id)) serviceMap.set(m.life_event_id, []);
      serviceMap.get(m.life_event_id)!.push(m.service_id);
    }

    return events.map((e) => ({
      id: e.id,
      name: e.name,
      icon: e.icon,
      description: e.description,
      serviceIds: serviceMap.get(e.id) || [],
    }));
  }

  /** Get a single life event with services */
  async getLifeEvent(id: string): Promise<LifeEventWithServices | undefined> {
    const event = await this.db.get<LifeEventRow>(
      "SELECT * FROM life_events WHERE id = ?",
      id
    );
    if (!event) return undefined;

    const mappings = await this.db.all<LifeEventServiceRow>(
      "SELECT * FROM life_event_services WHERE life_event_id = ?",
      id
    );

    return {
      id: event.id,
      name: event.name,
      icon: event.icon,
      description: event.description,
      serviceIds: mappings.map((m) => m.service_id),
    };
  }

  /** Get edges outgoing from a service */
  async getEdgesFrom(serviceId: string): Promise<EdgeRow[]> {
    return this.db.all<EdgeRow>(
      "SELECT * FROM edges WHERE from_service_id = ?",
      serviceId
    );
  }

  /** Get services that are required by a given service (incoming REQUIRES edges) */
  async getRequiredServices(serviceId: string): Promise<string[]> {
    const rows = await this.db.all<{ from_service_id: string }>(
      "SELECT from_service_id FROM edges WHERE to_service_id = ? AND edge_type = 'REQUIRES'",
      serviceId
    );
    return rows.map((r) => r.from_service_id);
  }

  /** Get services that are enabled by a given service (outgoing ENABLES edges) */
  async getEnabledServices(serviceId: string): Promise<string[]> {
    const rows = await this.db.all<{ to_service_id: string }>(
      "SELECT to_service_id FROM edges WHERE from_service_id = ? AND edge_type = 'ENABLES'",
      serviceId
    );
    return rows.map((r) => r.to_service_id);
  }

  /**
   * Get all services reachable from a life event via BFS traversal.
   * Follows both REQUIRES and ENABLES edges downstream.
   */
  async getLifeEventReachableServices(lifeEventId: string): Promise<string[]> {
    const event = await this.getLifeEvent(lifeEventId);
    if (!event) return [];

    const visited = new Set<string>();
    const queue = [...event.serviceIds];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const outgoing = await this.getEdgesFrom(nodeId);
      for (const edge of outgoing) {
        if (!visited.has(edge.to_service_id)) {
          queue.push(edge.to_service_id);
        }
      }
    }

    return [...visited];
  }

  /** Get unique departments with service counts */
  async getDepartments(): Promise<DepartmentInfo[]> {
    const rows = await this.db.all<{
      department_key: string;
      department: string;
      cnt: number;
    }>(
      "SELECT department_key, department, COUNT(*) as cnt FROM services GROUP BY department_key ORDER BY department ASC"
    );

    return rows.map((r) => ({
      key: r.department_key,
      name: r.department,
      serviceCount: r.cnt,
    }));
  }
}
