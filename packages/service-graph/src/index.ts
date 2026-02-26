/**
 * @als/service-graph — UK Government Service Graph
 *
 * 108 services, 98 relationships, and 16 life events with rich
 * eligibility data for multi-service triage and discovery.
 */

export type {
  ServiceType,
  EligibilityFactor,
  EligibilityInfo,
  ServiceNode,
  Edge,
  LifeEvent,
} from './types';

export { NODES, EDGES, LIFE_EVENTS } from './graph-data';
export { ServiceGraphEngine } from './graph-engine';
export { graphNodeToManifest } from './manifest-bridge';
