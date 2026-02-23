/**
 * resource-generator.ts — Generates MCP Resource registrations from service artefacts
 *
 * Each service gets 4 fixed-URI resources:
 *   - service://{serviceId}/manifest    → full manifest.json
 *   - service://{serviceId}/policy      → eligibility rules
 *   - service://{serviceId}/consent     → consent model
 *   - service://{serviceId}/state-model → state machine definition
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ArtefactStore, type ServiceArtefacts } from "@als/legibility";

function slugToPrefix(serviceId: string): string {
  const slug = ArtefactStore.slugFromId(serviceId);
  return slug.replace(/-/g, "_");
}

export function registerResourcesForService(
  mcpServer: McpServer,
  serviceId: string,
  artefacts: ServiceArtefacts
): number {
  const prefix = slugToPrefix(serviceId);
  const serviceName = artefacts.manifest.name;
  let count = 0;

  // Always register manifest
  mcpServer.resource(
    `${prefix}-manifest`,
    `service://${serviceId}/manifest`,
    { description: `Service metadata for ${serviceName}`, mimeType: "application/json" },
    () => ({
      contents: [{
        uri: `service://${serviceId}/manifest`,
        text: JSON.stringify(artefacts.manifest, null, 2),
      }],
    })
  );
  count++;

  // Policy (optional)
  if (artefacts.policy) {
    mcpServer.resource(
      `${prefix}-policy`,
      `service://${serviceId}/policy`,
      { description: `Eligibility rules for ${serviceName}`, mimeType: "application/json" },
      () => ({
        contents: [{
          uri: `service://${serviceId}/policy`,
          text: JSON.stringify(artefacts.policy, null, 2),
        }],
      })
    );
    count++;
  }

  // Consent (optional)
  if (artefacts.consent) {
    mcpServer.resource(
      `${prefix}-consent`,
      `service://${serviceId}/consent`,
      { description: `Consent model for ${serviceName}`, mimeType: "application/json" },
      () => ({
        contents: [{
          uri: `service://${serviceId}/consent`,
          text: JSON.stringify(artefacts.consent, null, 2),
        }],
      })
    );
    count++;
  }

  // State model (optional)
  if (artefacts.stateModel) {
    mcpServer.resource(
      `${prefix}-state-model`,
      `service://${serviceId}/state-model`,
      { description: `State machine for ${serviceName}`, mimeType: "application/json" },
      () => ({
        contents: [{
          uri: `service://${serviceId}/state-model`,
          text: JSON.stringify(artefacts.stateModel, null, 2),
        }],
      })
    );
    count++;
  }

  return count;
}

export function registerAllResources(mcpServer: McpServer, store: ArtefactStore): number {
  let total = 0;
  for (const serviceId of store.listServices()) {
    const artefacts = store.get(serviceId);
    if (!artefacts) continue;
    total += registerResourcesForService(mcpServer, serviceId, artefacts);
  }
  return total;
}
