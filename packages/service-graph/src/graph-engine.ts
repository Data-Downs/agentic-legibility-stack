/**
 * ServiceGraphEngine — traversal and lookup for the UK Gov Service Graph.
 */

import type { ServiceNode, Edge, LifeEvent, LifeEventPlan, PlanGroup } from './types';
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

  /**
   * Compute a topological plan for a life event — groups services by depth
   * from entry nodes using BFS, and generates human-readable group labels.
   */
  getLifeEventPlan(lifeEventId: string): LifeEventPlan | null {
    const le = this.getLifeEvent(lifeEventId);
    if (!le) return null;

    // BFS to collect all reachable nodes
    const visited = new Set<string>();
    const queue = [...le.entryNodes];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const outgoing = this.outEdges.get(nodeId) || [];
      for (const edge of outgoing) {
        if (!visited.has(edge.to)) queue.push(edge.to);
      }
    }

    // Collect scoped edges (both endpoints in the visited set)
    const scopedEdges = this.edges.filter(
      (e) => visited.has(e.from) && visited.has(e.to)
    );

    // Compute max-depth for each node (entry=0, others=max(parent depths)+1)
    const entrySet = new Set(le.entryNodes);
    const depth = new Map<string, number>();
    for (const id of entrySet) depth.set(id, 0);

    // Topological BFS using in-degree within scoped graph
    const scopedInEdges = new Map<string, Edge[]>();
    for (const e of scopedEdges) {
      if (!scopedInEdges.has(e.to)) scopedInEdges.set(e.to, []);
      scopedInEdges.get(e.to)!.push(e);
    }

    // Iterative relaxation to find max-depth
    let changed = true;
    while (changed) {
      changed = false;
      for (const nodeId of visited) {
        const incoming = scopedInEdges.get(nodeId) || [];
        for (const e of incoming) {
          const parentDepth = depth.get(e.from);
          if (parentDepth !== undefined) {
            const candidate = parentDepth + 1;
            if (!depth.has(nodeId) || candidate > depth.get(nodeId)!) {
              depth.set(nodeId, candidate);
              changed = true;
            }
          }
        }
      }
    }

    // Group nodes by depth
    const groupMap = new Map<number, string[]>();
    for (const [nodeId, d] of depth) {
      if (!groupMap.has(d)) groupMap.set(d, []);
      groupMap.get(d)!.push(nodeId);
    }

    const sortedDepths = [...groupMap.keys()].sort((a, b) => a - b);

    const groups: PlanGroup[] = sortedDepths.map((d) => {
      const serviceIds = groupMap.get(d)!;

      // Find prerequisite service IDs for this group (parents from the previous depth)
      const prereqIds = new Set<string>();
      for (const svcId of serviceIds) {
        const incoming = scopedInEdges.get(svcId) || [];
        for (const e of incoming) {
          if (depth.has(e.from) && depth.get(e.from)! < d) {
            prereqIds.add(e.from);
          }
        }
      }

      const label = this.generateGroupLabel(d, [...prereqIds], serviceIds);

      return {
        depth: d,
        label,
        prerequisiteIds: [...prereqIds],
        serviceIds,
      };
    });

    return {
      entryServiceIds: le.entryNodes.filter((id) => visited.has(id)),
      groups,
      edges: scopedEdges.map((e) => ({ from: e.from, to: e.to, type: e.type })),
    };
  }

  private generateGroupLabel(
    depth: number,
    prereqIds: string[],
    serviceIds: string[]
  ): string {
    if (depth === 0) return 'Start here';

    // Check if all services in this group are legal_process
    const allLegal = serviceIds.every(
      (id) => this.nodes[id]?.serviceType === 'legal_process'
    );
    if (allLegal) return 'If you need to challenge a decision';

    if (prereqIds.length === 1) {
      const node = this.nodes[prereqIds[0]];
      if (!node) return 'After completing the previous step';
      // Use a short label: for documents use "After your {name}", otherwise "After {name}"
      const name = node.name;
      if (node.serviceType === 'document') {
        // Strip "Obtain " prefix if present to avoid "After your Obtain P45..."
        const shortName = name.replace(/^Obtain\s+/i, '');
        return `After obtaining your ${shortName}`;
      }
      return `After ${name}`;
    }
    if (prereqIds.length === 2) {
      const name1 = this.nodes[prereqIds[0]]?.name;
      const name2 = this.nodes[prereqIds[1]]?.name;
      return `After ${name1} or ${name2}`;
    }
    return 'Once receiving benefits';
  }
}
