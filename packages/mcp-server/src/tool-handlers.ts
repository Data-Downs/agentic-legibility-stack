/**
 * tool-handlers.ts — Dispatches MCP tool calls to service logic
 *
 * Each action maps to a real operation using @als/legibility:
 *   - check_eligibility → PolicyEvaluator.evaluate()
 *   - get_requirements  → manifest input/output schemas
 *   - get_consent_model → full consent.json
 *   - advance_state     → StateMachine.transition()
 *   - get_service_info  → full manifest.json
 */

import {
  ArtefactStore,
  PolicyEvaluator,
  StateMachine,
} from "@als/legibility";
import type { ToolMapping } from "./tool-generator";

export interface ToolCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const policyEvaluator = new PolicyEvaluator();

export function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  store: ArtefactStore,
  toolMap: Map<string, ToolMapping>
): ToolCallResult {
  const mapping = toolMap.get(toolName);
  if (!mapping) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
      isError: true,
    };
  }

  const { serviceId, action } = mapping;
  const artefacts = store.get(serviceId);
  if (!artefacts) {
    return {
      content: [{ type: "text", text: `Service not found: ${serviceId}` }],
      isError: true,
    };
  }

  switch (action) {
    case "get_service_info": {
      return {
        content: [
          { type: "text", text: JSON.stringify(artefacts.manifest, null, 2) },
        ],
      };
    }

    case "get_requirements": {
      const requirements = {
        input_schema: artefacts.manifest.input_schema,
        output_schema: artefacts.manifest.output_schema,
        evidence_requirements: artefacts.manifest.evidence_requirements || [],
        consent_requirements: artefacts.manifest.consent_requirements || [],
        constraints: artefacts.manifest.constraints || null,
      };
      return {
        content: [
          { type: "text", text: JSON.stringify(requirements, null, 2) },
        ],
      };
    }

    case "check_eligibility": {
      if (!artefacts.policy) {
        return {
          content: [
            {
              type: "text",
              text: "No policy rules defined for this service.",
            },
          ],
        };
      }
      const citizenData = (args.citizen_data || {}) as Record<string, unknown>;
      const result = policyEvaluator.evaluate(artefacts.policy, citizenData);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "get_consent_model": {
      if (!artefacts.consent) {
        return {
          content: [
            {
              type: "text",
              text: "No consent model defined for this service.",
            },
          ],
        };
      }
      return {
        content: [
          { type: "text", text: JSON.stringify(artefacts.consent, null, 2) },
        ],
      };
    }

    case "advance_state": {
      if (!artefacts.stateModel) {
        return {
          content: [
            { type: "text", text: "No state model defined for this service." },
          ],
        };
      }

      const currentState = args.current_state as string;
      const trigger = args.trigger as string;

      if (!currentState || !trigger) {
        return {
          content: [
            {
              type: "text",
              text: "Both current_state and trigger are required.",
            },
          ],
          isError: true,
        };
      }

      const sm = new StateMachine(artefacts.stateModel);
      sm.setState(currentState);
      const result = sm.transition(trigger);

      // Include allowed transitions from the new state
      const allowedNext = sm.allowedTransitions();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...result,
                isTerminal: sm.isTerminal(),
                requiresReceipt: sm.requiresReceipt(),
                allowedTransitions: allowedNext,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    default: {
      return {
        content: [{ type: "text", text: `Unknown action: ${action}` }],
        isError: true,
      };
    }
  }
}
