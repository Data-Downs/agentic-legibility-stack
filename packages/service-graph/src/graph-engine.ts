/**
 * ServiceGraphEngine — traversal and lookup for the UK Gov Service Graph.
 */

import type { ServiceNode, Edge, LifeEvent } from './types';
import { NODES, EDGES, LIFE_EVENTS } from './graph-data';

export class ServiceGraphEngine {
  private nodes: Record<string, ServiceNode>;
  private edges: Edge[];
  private lifeEvents: LifeEvent[];
  private outEdges: Map<string, Edge[]>;
  private inEdges: Map<string, Edge[]>;

  constructor() {
    this.nodes = NODES;
    this.edges = EDGES;
    this.lifeEvents = LIFE_EVENTS;

    // Build adjacency lists
    this.outEdges = new Map();
    this.inEdges = new Map();
    for (const edge of EDGES) {
      if (!this.outEdges.has(edge.from)) this.outEdges.set(edge.from, []);
      this.outEdges.get(edge.from)!.push(edge);
      if (!this.inEdges.has(edge.to)) this.inEdges.set(edge.to, []);
      this.inEdges.get(edge.to)!.push(edge);
    }
  }

  /** Get a single life event by ID */
  getLifeEvent(id: string): LifeEvent | undefined {
    return this.lifeEvents.find((le) => le.id === id);
  }

  /** Get all 16 life events */
  getLifeEvents(): LifeEvent[] {
    return this.lifeEvents;
  }

  /** Get a single service node by ID */
  getService(id: string): ServiceNode | undefined {
    return this.nodes[id];
  }

  /** Get all service nodes */
  getServices(): ServiceNode[] {
    return Object.values(this.nodes);
  }

  /** Get the total service count */
  getServiceCount(): number {
    return Object.keys(this.nodes).length;
  }

  /**
   * Get all services reachable from a life event:
   * entry nodes + everything downstream via ENABLES and REQUIRES edges.
   */
  getLifeEventServices(lifeEventId: string): ServiceNode[] {
    const le = this.getLifeEvent(lifeEventId);
    if (!le) return [];

    const visited = new Set<string>();
    const queue = [...le.entryNodes];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const outgoing = this.outEdges.get(nodeId) || [];
      for (const edge of outgoing) {
        if (!visited.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }

    return [...visited]
      .map((id) => this.nodes[id])
      .filter(Boolean);
  }

  /** Get prerequisite services (incoming REQUIRES edges) */
  getRequiredServices(serviceId: string): ServiceNode[] {
    const incoming = this.inEdges.get(serviceId) || [];
    return incoming
      .filter((e) => e.type === 'REQUIRES')
      .map((e) => this.nodes[e.from])
      .filter(Boolean);
  }

  /** Get downstream services (outgoing ENABLES edges) */
  getEnabledServices(serviceId: string): ServiceNode[] {
    const outgoing = this.outEdges.get(serviceId) || [];
    return outgoing
      .filter((e) => e.type === 'ENABLES')
      .map((e) => this.nodes[e.to])
      .filter(Boolean);
  }

  /** Find services by department key (e.g. 'hmrc', 'dwp') */
  getServicesByDepartment(deptKey: string): ServiceNode[] {
    return Object.values(this.nodes).filter((n) => n.deptKey === deptKey);
  }

  /** Find a service node by slug (e.g. 'register-birth' matches 'gro-register-birth') */
  findBySlug(slug: string): ServiceNode | undefined {
    // Exact match first
    if (this.nodes[slug]) return this.nodes[slug];
    // Suffix match (e.g. 'register-birth' → 'gro-register-birth')
    return Object.values(this.nodes).find((n) => n.id.endsWith(`-${slug}`) || n.id.endsWith(slug));
  }
}
