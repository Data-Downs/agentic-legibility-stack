/**
 * HandoffManager — Manages escalation from agent to human
 *
 * Monitors for triggers that require human intervention:
 *   - Citizen request ("I want to speak to someone")
 *   - Policy edge case (detected by PolicyEvaluator)
 *   - Repeated failure (same operation fails 3+ times)
 *   - Safeguarding concern (keywords detected)
 *
 * Creates a structured handoff package with all context.
 */

import type { HandoffPackage, HandoffReason, CapabilityManifest } from "@als/schemas";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const SAFEGUARDING_KEYWORDS = [
  "suicide", "self-harm", "kill myself", "end my life",
  "domestic abuse", "being hurt", "violence",
  "child protection", "child abuse",
  "homeless", "sleeping rough",
  "no food", "starving", "can't eat",
];

const HANDOFF_REQUEST_KEYWORDS = [
  "speak to someone", "speak to a person", "talk to someone",
  "talk to a human", "real person", "human agent",
  "call someone", "want to complain", "make a complaint",
];

export class HandoffManager {
  private failureCounts = new Map<string, number>();

  /**
   * Evaluate whether a handoff should be triggered.
   * Returns the trigger reason if handoff is needed, null otherwise.
   */
  evaluateTriggers(
    messageText: string,
    context?: { failureKey?: string; policyEdgeCase?: boolean }
  ): { triggered: boolean; reason?: HandoffReason; description?: string } {
    const textLower = messageText.toLowerCase();

    // Check safeguarding keywords
    for (const keyword of SAFEGUARDING_KEYWORDS) {
      if (textLower.includes(keyword)) {
        return {
          triggered: true,
          reason: "safeguarding-concern",
          description: `Safeguarding keyword detected: "${keyword}"`,
        };
      }
    }

    // Check citizen request to speak to a human
    for (const keyword of HANDOFF_REQUEST_KEYWORDS) {
      if (textLower.includes(keyword)) {
        return {
          triggered: true,
          reason: "citizen-requested",
          description: "Citizen requested to speak to a human agent",
        };
      }
    }

    // Check policy edge case
    if (context?.policyEdgeCase) {
      return {
        triggered: true,
        reason: "policy-edge-case",
        description: "Policy edge case detected during eligibility check",
      };
    }

    // Check repeated failures
    if (context?.failureKey) {
      const count = (this.failureCounts.get(context.failureKey) || 0) + 1;
      this.failureCounts.set(context.failureKey, count);
      if (count >= 3) {
        return {
          triggered: true,
          reason: "repeated-failure",
          description: `Operation '${context.failureKey}' has failed ${count} times`,
        };
      }
    }

    return { triggered: false };
  }

  /** Create a structured handoff package */
  createPackage(opts: {
    reason: HandoffReason;
    description: string;
    agentAssessment: string;
    citizen: { name: string; preferredChannel?: string; phone?: string; email?: string };
    service?: CapabilityManifest;
    stepsCompleted: string[];
    stepsBlocked: string[];
    dataCollected: string[];
    timeSpent: string;
    traceId: string;
    receiptIds: string[];
  }): HandoffPackage {
    const urgency = opts.reason === "safeguarding-concern"
      ? "safeguarding"
      : opts.reason === "repeated-failure"
        ? "priority"
        : "routine";

    return {
      id: `handoff_${generateId()}`,
      createdAt: new Date().toISOString(),
      urgency,

      citizen: {
        name: opts.citizen.name,
        contactDetails: {
          preferredChannel: opts.citizen.preferredChannel || "phone",
          phone: opts.citizen.phone,
          email: opts.citizen.email,
        },
      },

      reason: {
        category: opts.reason,
        description: opts.description,
        agentAssessment: opts.agentAssessment,
      },

      conversationSummary: {
        serviceAttempted: opts.service?.name || "Unknown service",
        stepsCompleted: opts.stepsCompleted,
        stepsBlocked: opts.stepsBlocked,
        dataCollected: opts.dataCollected,
        timeSpent: opts.timeSpent,
      },

      traceId: opts.traceId,
      receiptIds: opts.receiptIds,
      suggestedActions: this.generateSuggestedActions(opts.reason, opts.service),

      routing: {
        department: opts.service?.department || "Unknown",
        serviceArea: opts.service?.name || "General",
        suggestedQueue: opts.service?.handoff?.department_queue || "general-enquiries",
      },
    };
  }

  /** Reset failure count for a key */
  resetFailures(key: string): void {
    this.failureCounts.delete(key);
  }

  private generateSuggestedActions(
    reason: HandoffReason,
    service?: CapabilityManifest
  ): string[] {
    const actions: string[] = [];

    switch (reason) {
      case "safeguarding-concern":
        actions.push("Follow safeguarding protocol immediately");
        actions.push("Do not redirect citizen to automated systems");
        actions.push("Consider multi-agency referral if appropriate");
        break;
      case "citizen-requested":
        actions.push("Review conversation summary before connecting");
        actions.push("Confirm citizen's identity and details");
        break;
      case "repeated-failure":
        actions.push("Investigate the technical cause of the failure");
        actions.push("Attempt the operation manually for the citizen");
        break;
      case "policy-edge-case":
        actions.push("Review the edge case against policy guidance");
        actions.push("Escalate to policy team if unclear");
        break;
      default:
        actions.push("Review the handoff package and conversation history");
    }

    if (service?.handoff?.escalation_phone) {
      actions.push(`Service contact: ${service.handoff.escalation_phone}`);
    }

    return actions;
  }
}
