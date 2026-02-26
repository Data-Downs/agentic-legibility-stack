/**
 * Seed the service store from @als/service-graph constants and
 * embedded full-artefact service data.
 *
 * Full services are now embedded in full-services.ts (no filesystem dependency)
 * so seeding works on both local dev and Cloudflare Workers.
 */

import type { DatabaseAdapter } from "@als/evidence";
import {
  ServiceGraphEngine,
  graphNodeToManifest,
  EDGES,
  LIFE_EVENTS,
} from "@als/service-graph";
import { ServiceArtefactStore } from "./service-store";
import { ServiceGraphStore } from "./graph-store";
import { FULL_SERVICES } from "./full-services";

export interface SeedOptions {
  /** @deprecated — no longer used. Full services are now embedded. */
  servicesDir?: string | null;
  /** If true, clear existing data before seeding */
  clear?: boolean;
}

export interface SeedResult {
  graphServices: number;
  fullServices: number;
  edges: number;
  lifeEvents: number;
}

/**
 * Seed the service store with data from:
 * 1. @als/service-graph (108 graph services, 98 edges, 16 life events)
 * 2. Embedded full-artefact services (4 services with policy/stateModel/consent)
 *
 * Full services that have a matching graph node ID replace the graph-only entry.
 */
export async function seedServiceStore(
  db: DatabaseAdapter,
  options: SeedOptions
): Promise<SeedResult> {
  const artefactStore = new ServiceArtefactStore(db);
  const graphStore = new ServiceGraphStore(db);
  const engine = new ServiceGraphEngine();

  if (options.clear) {
    await db.exec("DELETE FROM life_event_services");
    await db.exec("DELETE FROM life_events");
    await db.exec("DELETE FROM edges");
    await db.exec("DELETE FROM services");
  }

  let graphCount = 0;
  let fullCount = 0;

  // Build set of graph IDs that will be replaced by full services
  const replacedGraphIds = new Set<string>();
  for (const fs of FULL_SERVICES) {
    if (fs.graphId) replacedGraphIds.add(fs.graphId);
  }

  // 1. Seed graph services (skip those that will be replaced by full services)
  const nodes = engine.getServices();
  const graphStatements: Array<{ sql: string; params: unknown[] }> = [];

  for (const node of nodes) {
    if (replacedGraphIds.has(node.id)) continue; // Will be seeded as full service

    const manifest = graphNodeToManifest(node);
    graphStatements.push({
      sql: `INSERT OR IGNORE INTO services (id, name, department, department_key, description, source, service_type, govuk_url, eligibility_summary, promoted, proactive, gated, manifest_json)
            VALUES (?, ?, ?, ?, ?, 'graph', ?, ?, ?, 0, ?, ?, ?)`,
      params: [
        node.id,
        node.name,
        node.dept,
        node.deptKey,
        node.desc,
        node.serviceType,
        node.govuk_url,
        node.eligibility.summary,
        node.proactive ? 1 : 0,
        node.gated ? 1 : 0,
        JSON.stringify(manifest),
      ],
    });
    graphCount++;
  }

  await db.batch(graphStatements);

  // 2. Seed full-artefact services from embedded data
  for (const fullSvc of FULL_SERVICES) {
    // Use graph ID if available, otherwise use manifest ID
    const serviceId = fullSvc.graphId || (fullSvc.manifest.id as string) || fullSvc.dirName;

    // Delete any existing entry (graph or stale full) with this ID
    await db.run("DELETE FROM services WHERE id = ?", serviceId);

    // Also delete any entry with the manifest ID if different from serviceId
    const manifestId = fullSvc.manifest.id as string;
    if (manifestId && manifestId !== serviceId) {
      await db.run("DELETE FROM services WHERE id = ?", manifestId);
    }

    await artefactStore.createService({
      id: serviceId,
      manifest: {
        ...fullSvc.manifest,
        source: "full",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      policy: fullSvc.policy,
      stateModel: fullSvc.stateModel,
      consent: fullSvc.consent,
      source: "full",
      departmentKey: fullSvc.manifest.department
        ? (fullSvc.manifest.department as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
        : "other",
    });
    fullCount++;
  }

  // 3. Seed edges
  const edgeStatements: Array<{ sql: string; params: unknown[] }> = [];
  for (const edge of EDGES) {
    edgeStatements.push({
      sql: "INSERT OR IGNORE INTO edges (from_service_id, to_service_id, edge_type) VALUES (?, ?, ?)",
      params: [edge.from, edge.to, edge.type],
    });
  }
  await db.batch(edgeStatements);

  // 4. Seed life events
  const leStatements: Array<{ sql: string; params: unknown[] }> = [];
  const lesStatements: Array<{ sql: string; params: unknown[] }> = [];

  for (const le of LIFE_EVENTS) {
    leStatements.push({
      sql: "INSERT OR IGNORE INTO life_events (id, name, icon, description) VALUES (?, ?, ?, ?)",
      params: [le.id, le.name, le.icon, le.desc],
    });

    for (const nodeId of le.entryNodes) {
      lesStatements.push({
        sql: "INSERT OR IGNORE INTO life_event_services (life_event_id, service_id) VALUES (?, ?)",
        params: [le.id, nodeId],
      });
    }
  }

  await db.batch(leStatements);
  await db.batch(lesStatements);

  return {
    graphServices: graphCount,
    fullServices: fullCount,
    edges: EDGES.length,
    lifeEvents: LIFE_EVENTS.length,
  };
}
