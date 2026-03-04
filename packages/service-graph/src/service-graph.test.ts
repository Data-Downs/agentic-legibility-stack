import { describe, it, expect, beforeEach } from "vitest";
import { ServiceGraphEngine } from "./graph-engine";
import { NODES, EDGES, LIFE_EVENTS } from "./graph-data";
import { graphNodeToManifest } from "./manifest-bridge";

describe("ServiceGraphEngine", () => {
  let engine: ServiceGraphEngine;

  beforeEach(() => {
    engine = new ServiceGraphEngine();
  });

  it("has 100+ service nodes", () => {
    expect(engine.getServiceCount()).toBeGreaterThanOrEqual(100);
  });

  it("has 16 life events", () => {
    expect(engine.getLifeEvents()).toHaveLength(16);
  });

  it("getService returns a known service", () => {
    const services = engine.getServices();
    expect(services.length).toBeGreaterThan(0);

    const firstId = services[0].id;
    const svc = engine.getService(firstId);
    expect(svc).toBeDefined();
    expect(svc!.id).toBe(firstId);
    expect(svc!.name).toBeTruthy();
  });

  it("getService returns undefined for unknown", () => {
    expect(engine.getService("nonexistent")).toBeUndefined();
  });

  it("getLifeEvent returns a known life event", () => {
    const events = engine.getLifeEvents();
    const first = events[0];
    const found = engine.getLifeEvent(first.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(first.id);
    expect(found!.entryNodes.length).toBeGreaterThan(0);
  });

  it("getLifeEvent returns undefined for unknown", () => {
    expect(engine.getLifeEvent("nonexistent")).toBeUndefined();
  });

  it("getLifeEventServices returns reachable services", () => {
    const events = engine.getLifeEvents();
    const event = events[0];
    const services = engine.getLifeEventServices(event.id);
    expect(services.length).toBeGreaterThanOrEqual(event.entryNodes.length);
  });

  it("getLifeEventServices returns empty for unknown event", () => {
    expect(engine.getLifeEventServices("nonexistent")).toEqual([]);
  });

  it("every service node has required fields", () => {
    const services = engine.getServices();
    for (const svc of services) {
      expect(svc.id).toBeTruthy();
      expect(svc.name).toBeTruthy();
      expect(svc.desc).toBeTruthy();
      expect(svc.dept).toBeTruthy();
      expect(svc.serviceType).toBeTruthy();
    }
  });

  it("every edge references existing nodes", () => {
    for (const edge of EDGES) {
      expect(NODES[edge.from]).toBeDefined();
      expect(NODES[edge.to]).toBeDefined();
      expect(["ENABLES", "REQUIRES"]).toContain(edge.type);
    }
  });

  it("every life event entry node references an existing service", () => {
    for (const le of LIFE_EVENTS) {
      for (const nodeId of le.entryNodes) {
        expect(NODES[nodeId]).toBeDefined();
      }
    }
  });
});

describe("Graph integrity — no circular dependencies", () => {
  it("REQUIRES edges form a DAG (no cycles)", () => {
    const requiresEdges = EDGES.filter((e) => e.type === "REQUIRES");
    const visited = new Set<string>();
    const visiting = new Set<string>();

    // Build adjacency for REQUIRES
    const adj = new Map<string, string[]>();
    for (const e of requiresEdges) {
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from)!.push(e.to);
    }

    function hasCycle(node: string): boolean {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      for (const neighbor of adj.get(node) || []) {
        if (hasCycle(neighbor)) return true;
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    }

    for (const nodeId of adj.keys()) {
      expect(hasCycle(nodeId)).toBe(false);
    }
  });
});

describe("graphNodeToManifest", () => {
  it("converts a service node to CapabilityManifest", () => {
    const services = Object.values(NODES);
    const node = services[0];
    const manifest = graphNodeToManifest(node);

    expect(manifest.id).toBe(node.id);
    expect(manifest.name).toBe(node.name);
    expect(manifest.description).toBe(node.desc);
    expect(manifest.department).toBe(node.dept);
    expect(manifest.source).toBe("graph");
  });
});
