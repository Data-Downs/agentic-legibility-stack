/**
 * prompt-generator.ts — Generates MCP Prompt registrations from service artefacts
 *
 * Per service, registers 2 prompts:
 *   - {prefix}_journey           → full journey template (overview, flow, rules)
 *   - {prefix}_eligibility_check → focused eligibility assessment template
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ArtefactStore, type ServiceArtefacts } from "@als/legibility";

function slugToPrefix(serviceId: string): string {
  const slug = ArtefactStore.slugFromId(serviceId);
  return slug.replace(/-/g, "_");
}

export function buildJourneyPrompt(
  serviceId: string,
  artefacts: ServiceArtefacts,
  citizenContext?: string
): string {
  const m = artefacts.manifest;
  const lines: string[] = [];

  // Service overview
  lines.push(`# Journey Guide: ${m.name}`);
  lines.push("");
  lines.push(`**Service:** ${m.name}`);
  lines.push(`**Department:** ${m.department}`);
  lines.push(`**Description:** ${m.description}`);
  if (m.jurisdiction) lines.push(`**Jurisdiction:** ${m.jurisdiction}`);
  lines.push("");

  // Constraints
  const constraints = m.constraints as Record<string, unknown> | undefined;
  if (constraints) {
    lines.push("## Service Constraints");
    if (constraints.sla) lines.push(`- **SLA:** ${constraints.sla}`);
    if (constraints.fee) {
      const fee = constraints.fee as Record<string, unknown>;
      lines.push(`- **Fee:** ${fee.amount} ${fee.currency}`);
    }
    if (constraints.availability) lines.push(`- **Availability:** ${constraints.availability}`);
    lines.push("");
  }

  // Eligibility rules summary
  if (artefacts.policy) {
    lines.push("## Eligibility Rules");
    for (const rule of artefacts.policy.rules) {
      lines.push(`- **${rule.id}:** ${rule.description}`);
      if (rule.reason_if_failed) lines.push(`  - If failed: ${rule.reason_if_failed}`);
    }
    if (artefacts.policy.edge_cases && artefacts.policy.edge_cases.length > 0) {
      lines.push("");
      lines.push("### Edge Cases");
      for (const ec of artefacts.policy.edge_cases) {
        lines.push(`- **${ec.id}:** ${ec.description} → ${ec.action}`);
      }
    }
    lines.push("");
  }

  // State machine flow
  if (artefacts.stateModel) {
    lines.push("## Journey Flow (State Machine)");
    lines.push("");
    const states = artefacts.stateModel.states;
    for (const state of states) {
      const label = state.type === "initial" ? " (START)" : state.type === "terminal" ? " (END)" : "";
      lines.push(`- **${state.id}**${label}`);
    }
    lines.push("");
    lines.push("### Transitions");
    for (const t of artefacts.stateModel.transitions) {
      const cond = t.condition ? ` [${t.condition}]` : "";
      lines.push(`- ${t.from} → ${t.to} (trigger: ${t.trigger})${cond}`);
    }
    lines.push("");
  }

  // Consent requirements
  if (artefacts.consent) {
    lines.push("## Consent Requirements");
    const grants = (artefacts.consent as unknown as Record<string, unknown>).grants as Array<Record<string, unknown>> | undefined;
    if (grants) {
      for (const g of grants) {
        lines.push(`- **${g.id}:** ${g.description}`);
        lines.push(`  - Data shared: ${(g.data_shared as string[]).join(", ")}`);
        lines.push(`  - Purpose: ${g.purpose}`);
        lines.push(`  - Required: ${g.required ? "Yes" : "No"}`);
      }
    }
    const revocation = (artefacts.consent as unknown as Record<string, unknown>).revocation as Record<string, string> | undefined;
    if (revocation) {
      lines.push("");
      lines.push(`**Revocation:** ${revocation.mechanism}`);
      if (revocation.effect) lines.push(`**Effect of revocation:** ${revocation.effect}`);
    }
    lines.push("");
  }

  // Handoff / escalation
  const handoff = m.handoff as Record<string, unknown> | undefined;
  if (handoff) {
    lines.push("## Escalation / Handoff");
    if (handoff.escalation_phone) lines.push(`- **Phone:** ${handoff.escalation_phone}`);
    if (handoff.opening_hours) lines.push(`- **Hours:** ${handoff.opening_hours}`);
    lines.push("");
  }

  // Redress
  const redress = m.redress as Record<string, unknown> | undefined;
  if (redress) {
    lines.push("## Redress");
    if (redress.complaint_url) lines.push(`- **Complaints:** ${redress.complaint_url}`);
    if (redress.appeal_process) lines.push(`- **Appeals:** ${redress.appeal_process}`);
    if (redress.ombudsman) lines.push(`- **Ombudsman:** ${redress.ombudsman}`);
    lines.push("");
  }

  // Instructions
  lines.push("## Instructions");
  lines.push("You are helping a citizen navigate this government service journey.");
  lines.push("Follow the state machine flow above — complete each step before moving to the next.");
  lines.push("Use the eligibility rules to determine whether the citizen qualifies.");
  lines.push("Ensure all required consents are obtained before proceeding with data collection.");
  lines.push("If an edge case is detected, follow the specified action.");
  lines.push("Never fabricate reference numbers, payment amounts, or specific dates.");

  // Citizen context
  if (citizenContext) {
    lines.push("");
    lines.push("## Citizen Context");
    lines.push(citizenContext);
  }

  return lines.join("\n");
}

export function buildEligibilityPrompt(
  serviceId: string,
  artefacts: ServiceArtefacts,
  citizenDataJson?: string
): string {
  const m = artefacts.manifest;
  const lines: string[] = [];

  lines.push(`# Eligibility Assessment: ${m.name}`);
  lines.push("");
  lines.push(`You are assessing a citizen's eligibility for **${m.name}** (${m.department}).`);
  lines.push("");

  if (artefacts.policy) {
    lines.push("## Rules to Evaluate");
    for (const rule of artefacts.policy.rules) {
      const cond = rule.condition;
      lines.push(`- **${rule.id}:** ${rule.description}`);
      lines.push(`  - Check: \`${cond.field}\` ${cond.operator} ${JSON.stringify(cond.value)}`);
      lines.push(`  - If failed: "${rule.reason_if_failed}"`);
    }
    lines.push("");

    if (artefacts.policy.edge_cases && artefacts.policy.edge_cases.length > 0) {
      lines.push("## Edge Cases to Watch For");
      for (const ec of artefacts.policy.edge_cases) {
        lines.push(`- **${ec.id}:** ${ec.description}`);
        lines.push(`  - Detection: ${ec.detection}`);
        lines.push(`  - Action: ${ec.action}`);
      }
      lines.push("");
    }
  }

  lines.push("## Instructions");
  lines.push("1. Evaluate each rule against the citizen's data");
  lines.push("2. Report which rules passed and which failed");
  lines.push("3. Flag any edge cases that apply");
  lines.push("4. Provide a clear explanation of the eligibility outcome");
  lines.push("5. If not eligible, mention any alternative services");

  if (citizenDataJson) {
    lines.push("");
    lines.push("## Citizen Data");
    lines.push("```json");
    lines.push(citizenDataJson);
    lines.push("```");
  }

  return lines.join("\n");
}

export function registerPromptsForService(
  mcpServer: McpServer,
  serviceId: string,
  artefacts: ServiceArtefacts
): number {
  const prefix = slugToPrefix(serviceId);
  const serviceName = artefacts.manifest.name;
  let count = 0;

  // Journey prompt
  mcpServer.prompt(
    `${prefix}_journey`,
    `Step-by-step guide for helping a citizen with "${serviceName}"`,
    { citizen_context: z.string().optional().describe("Optional context about the citizen's situation") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: buildJourneyPrompt(serviceId, artefacts, args.citizen_context),
        },
      }],
    })
  );
  count++;

  // Eligibility check prompt (only if policy exists)
  if (artefacts.policy) {
    mcpServer.prompt(
      `${prefix}_eligibility_check`,
      `Eligibility assessment template for "${serviceName}"`,
      { citizen_data_json: z.string().optional().describe("Citizen data as JSON string for evaluation") },
      (args) => ({
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: buildEligibilityPrompt(serviceId, artefacts, args.citizen_data_json),
          },
        }],
      })
    );
    count++;
  }

  return count;
}

export function registerAllPrompts(mcpServer: McpServer, store: ArtefactStore): number {
  let total = 0;
  for (const serviceId of store.listServices()) {
    const artefacts = store.get(serviceId);
    if (!artefacts) continue;
    total += registerPromptsForService(mcpServer, serviceId, artefacts);
  }
  return total;
}
