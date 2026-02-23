/**
 * tool-generator.ts — Generates MCP tool definitions from service JSON artefacts
 *
 * For each service, generates up to 5 tools:
 *   - {prefix}_check_eligibility    (if policy.json exists)
 *   - {prefix}_get_requirements     (always, from manifest)
 *   - {prefix}_get_consent_model    (if consent.json exists)
 *   - {prefix}_advance_state        (if state-model.json exists)
 *   - {prefix}_get_service_info     (always, from manifest)
 */

import { ArtefactStore, type ServiceArtefacts } from "@als/legibility";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolMapping {
  serviceId: string;
  action: string;
}

function slugToToolPrefix(serviceId: string): string {
  const slug = ArtefactStore.slugFromId(serviceId);
  return slug.replace(/-/g, "_");
}

export function generateToolsForService(
  serviceId: string,
  artefacts: ServiceArtefacts
): McpToolDefinition[] {
  const prefix = slugToToolPrefix(serviceId);
  const serviceName = artefacts.manifest.name;
  const tools: McpToolDefinition[] = [];

  // Always: service info
  tools.push({
    name: `${prefix}_get_service_info`,
    description: `Get full metadata for the "${serviceName}" service, including department, SLA, fees, redress, and handoff details.`,
    inputSchema: { type: "object", properties: {} },
  });

  // Always: requirements (from manifest)
  tools.push({
    name: `${prefix}_get_requirements`,
    description: `Get the input/output schemas, evidence requirements, and consent requirements for the "${serviceName}" service.`,
    inputSchema: { type: "object", properties: {} },
  });

  // If policy exists: eligibility check
  if (artefacts.policy) {
    tools.push({
      name: `${prefix}_check_eligibility`,
      description: `Check citizen eligibility for the "${serviceName}" service. Evaluates policy rules against the provided citizen data and returns which rules passed/failed, any detected edge cases, and an explanation.`,
      inputSchema: {
        type: "object",
        properties: {
          citizen_data: {
            type: "object",
            description:
              "Citizen context data for policy evaluation (e.g. age, jurisdiction, employment_status, savings, etc.)",
          },
        },
        required: ["citizen_data"],
      },
    });
  }

  // If consent exists: consent model
  if (artefacts.consent) {
    tools.push({
      name: `${prefix}_get_consent_model`,
      description: `Get the consent model for the "${serviceName}" service, including all consent grants, data shared, delegation scopes, and revocation details.`,
      inputSchema: { type: "object", properties: {} },
    });
  }

  // If state model exists: state advancement
  if (artefacts.stateModel) {
    const stateIds = artefacts.stateModel.states.map((s) => s.id);
    const triggers = [
      ...new Set(
        artefacts.stateModel.transitions
          .filter((t) => t.trigger)
          .map((t) => t.trigger!)
      ),
    ];

    tools.push({
      name: `${prefix}_advance_state`,
      description: `Attempt a state transition for the "${serviceName}" service. Valid states: [${stateIds.join(", ")}]. Valid triggers: [${triggers.join(", ")}]. Returns the new state or an error if the transition is not allowed.`,
      inputSchema: {
        type: "object",
        properties: {
          current_state: {
            type: "string",
            description: `Current state ID. One of: ${stateIds.join(", ")}`,
          },
          trigger: {
            type: "string",
            description: `Transition trigger name. One of: ${triggers.join(", ")}`,
          },
        },
        required: ["current_state", "trigger"],
      },
    });
  }

  return tools;
}

/**
 * Generate all tools for all services in the store.
 * Also builds a reverse lookup map for O(1) dispatch.
 */
export function generateAllTools(store: ArtefactStore): {
  tools: McpToolDefinition[];
  toolMap: Map<string, ToolMapping>;
} {
  const tools: McpToolDefinition[] = [];
  const toolMap = new Map<string, ToolMapping>();

  for (const serviceId of store.listServices()) {
    const artefacts = store.get(serviceId);
    if (!artefacts) continue;

    const serviceTools = generateToolsForService(serviceId, artefacts);
    for (const tool of serviceTools) {
      tools.push(tool);

      // Extract action from tool name (everything after the service prefix)
      const prefix = slugToToolPrefix(serviceId);
      const action = tool.name.slice(prefix.length + 1); // +1 for the underscore
      toolMap.set(tool.name, { serviceId, action });
    }
  }

  return { tools, toolMap };
}
