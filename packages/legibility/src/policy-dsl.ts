/**
 * PolicyEvaluator — Evaluates eligibility rules against citizen context
 *
 * Supports the operators: >=, <=, ==, !=, exists, not-exists, in
 * Returns a PolicyResult with passed/failed rules and explanation.
 */

import type { PolicyRuleset, PolicyRule, PolicyEdgeCase, PolicyResult } from "@als/schemas";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current === null || current === undefined) return undefined;
    return (current as Record<string, unknown>)[key];
  }, obj);
}

function evaluateCondition(
  condition: PolicyRule["condition"],
  context: Record<string, unknown>
): boolean {
  const fieldValue = getNestedValue(context, condition.field);

  switch (condition.operator) {
    case "exists":
      return fieldValue !== undefined && fieldValue !== null;
    case "not-exists":
      return fieldValue === undefined || fieldValue === null;
    case "==":
      return fieldValue === condition.value;
    case "!=":
      return fieldValue !== condition.value;
    case ">=":
      return typeof fieldValue === "number" && fieldValue >= (condition.value as number);
    case "<=":
      return typeof fieldValue === "number" && fieldValue <= (condition.value as number);
    case "in":
      if (Array.isArray(condition.value)) {
        return condition.value.includes(fieldValue);
      }
      return false;
    default:
      return false;
  }
}

export class PolicyEvaluator {
  /**
   * Evaluate a ruleset against a citizen context object.
   * Returns which rules passed, which failed, and any detected edge cases.
   */
  evaluate(ruleset: PolicyRuleset, context: Record<string, unknown>): PolicyResult {
    const passed: PolicyRule[] = [];
    const failed: PolicyRule[] = [];
    const detectedEdgeCases: PolicyEdgeCase[] = [];

    for (const rule of ruleset.rules) {
      if (evaluateCondition(rule.condition, context)) {
        passed.push(rule);
      } else {
        failed.push(rule);
      }
    }

    // Check edge cases
    if (ruleset.edge_cases) {
      for (const edgeCase of ruleset.edge_cases) {
        // Edge case detection is a simple field check for now
        const detectionValue = getNestedValue(context, edgeCase.detection);
        if (detectionValue) {
          detectedEdgeCases.push(edgeCase);
        }
      }
    }

    const eligible = failed.length === 0;

    // Build explanation
    let explanation: string;
    if (eligible) {
      explanation = ruleset.explanation_template
        ? ruleset.explanation_template.replace("{outcome}", "eligible")
        : `All ${passed.length} eligibility rules passed.`;
    } else {
      const reasons = failed.map((r) => r.reason_if_failed).join("; ");
      explanation = `Not eligible: ${reasons}`;
    }

    if (detectedEdgeCases.length > 0) {
      explanation += ` Note: ${detectedEdgeCases.length} edge case(s) detected.`;
    }

    return {
      eligible,
      passed,
      failed,
      edgeCases: detectedEdgeCases,
      explanation,
    };
  }
}
