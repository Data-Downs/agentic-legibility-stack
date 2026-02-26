/**
 * Manifest bridge — converts a ServiceNode from the graph into a
 * CapabilityManifest for compatibility with the existing runtime.
 */

import type { CapabilityManifest } from '@als/schemas';
import type { ServiceNode } from './types';

/**
 * Convert a graph ServiceNode into a CapabilityManifest.
 * The manifest is lightweight — no input/output schema, no state model.
 * It provides enough metadata for the Dashboard, chat route, and Studio.
 */
export function graphNodeToManifest(node: ServiceNode): CapabilityManifest {
  return {
    id: node.id,
    version: '1.0.0',
    name: node.name,
    description: node.desc,
    department: node.dept,

    input_schema: { type: 'object' },
    output_schema: { type: 'object' },

    // Graph-specific optional fields
    source: 'graph',
    serviceType: node.serviceType,
    govuk_url: node.govuk_url,
    eligibility_summary: node.eligibility.summary,
    proactive: node.proactive,
    gated: node.gated,
  };
}
