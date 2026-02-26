/**
 * Seed the service store from @als/service-graph constants and
 * filesystem-based service artefacts (data/services/).
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

export interface SeedOptions {
  /** Path to data/services/ directory — null to skip filesystem services */
  servicesDir: string | null;
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
 * 2. Filesystem data/services/ (4 full-artefact services) — optional
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

  // 1. Seed graph services
  const nodes = engine.getServices();
  const graphStatements: Array<{ sql: string; params: unknown[] }> = [];

  for (const node of nodes) {
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

  // 2. Seed full-artefact services from filesystem (if available)
  if (options.servicesDir) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const entries = fs.readdirSync(options.servicesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const dir = path.join(options.servicesDir, entry.name);
        const manifestPath = path.join(dir, "manifest.json");

        if (!fs.existsSync(manifestPath)) continue;

        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        const serviceId = manifest.id || entry.name;

        let policy = null;
        let stateModel = null;
        let consent = null;

        const policyPath = path.join(dir, "policy.json");
        if (fs.existsSync(policyPath)) {
          policy = JSON.parse(fs.readFileSync(policyPath, "utf-8"));
        }

        const stateModelPath = path.join(dir, "state-model.json");
        if (fs.existsSync(stateModelPath)) {
          stateModel = JSON.parse(fs.readFileSync(stateModelPath, "utf-8"));
        }

        const consentPath = path.join(dir, "consent.json");
        if (fs.existsSync(consentPath)) {
          consent = JSON.parse(fs.readFileSync(consentPath, "utf-8"));
        }

        // Upsert: replace graph entry with full artefact entry
        await db.run("DELETE FROM services WHERE id = ?", serviceId);
        await artefactStore.createService({
          id: serviceId,
          manifest: {
            ...manifest,
            source: "full",
          },
          policy,
          stateModel,
          consent,
          source: "full",
          departmentKey: manifest.department
            ? manifest.department.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
            : "other",
        });
        fullCount++;
      }
    } catch (err) {
      // Filesystem not available (e.g. Cloudflare Workers) — skip
      console.warn("[ServiceStore] Filesystem seed skipped:", (err as Error).message);
    }
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
