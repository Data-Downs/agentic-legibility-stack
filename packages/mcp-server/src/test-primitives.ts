/**
 * test-primitives.ts — Integration test for MCP server primitives
 *
 * Verifies that Resources, Tools (with annotations), and Prompts are
 * correctly registered and functional after the McpServer upgrade.
 *
 * Uses InMemoryTransport for in-process server ↔ client communication.
 *
 * Usage: npx tsx packages/mcp-server/src/test-primitives.ts
 */

import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesDir = path.resolve(__dirname, "../../../data/services");

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS  ${message}`);
    passed++;
  } else {
    console.log(`  FAIL  ${message}`);
    failed++;
  }
}

async function main() {
  console.log("=== MCP Primitives Integration Test ===\n");

  // ── Setup: create server + client via InMemoryTransport ──
  console.log("Setting up server + client...");
  const { server, toolCount, resourceCount, promptCount, serviceCount } =
    await createServer(servicesDir);

  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "0.1.0" });

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  console.log("Connected.\n");

  // ── Test 1: Server creation counts ──
  console.log("1. Server creation counts");
  assert(serviceCount === 4, `serviceCount === 4 (got ${serviceCount})`);
  assert(toolCount === 8, `toolCount === 8 (got ${toolCount})`);
  assert(resourceCount === 16, `resourceCount === 16 (got ${resourceCount})`);
  assert(promptCount === 8, `promptCount === 8 (got ${promptCount})`);
  console.log();

  // ── Test 2: Resources — listing ──
  console.log("2. Resources — listing");
  const resources = await client.listResources();
  const resourceList = resources.resources || [];
  assert(resourceList.length === 16, `listResources() returns 16 (got ${resourceList.length})`);

  const resourceUris = resourceList.map((r) => r.uri);
  assert(
    resourceUris.includes("service://dwp.apply-universal-credit/manifest"),
    "UC manifest resource exists"
  );
  assert(
    resourceUris.includes("service://dwp.apply-universal-credit/policy"),
    "UC policy resource exists"
  );
  assert(
    resourceUris.includes("service://dwp.apply-universal-credit/consent"),
    "UC consent resource exists"
  );
  assert(
    resourceUris.includes("service://dwp.apply-universal-credit/state-model"),
    "UC state-model resource exists"
  );
  assert(
    resourceUris.includes("service://dvla.renew-driving-licence/manifest"),
    "DVLA manifest resource exists"
  );
  console.log();

  // ── Test 3: Resources — reading ──
  console.log("3. Resources — reading");
  const manifestResult = await client.readResource({
    uri: "service://dwp.apply-universal-credit/manifest",
  });
  const manifestText = (manifestResult.contents[0] as { text: string }).text;
  const manifest = JSON.parse(manifestText);
  assert(
    manifest.id === "dwp.apply-universal-credit",
    `manifest.id === "dwp.apply-universal-credit" (got "${manifest.id}")`
  );
  assert(
    manifest.name === "Apply for Universal Credit",
    `manifest.name === "Apply for Universal Credit" (got "${manifest.name}")`
  );

  const policyResult = await client.readResource({
    uri: "service://dwp.apply-universal-credit/policy",
  });
  const policyText = (policyResult.contents[0] as { text: string }).text;
  const policy = JSON.parse(policyText);
  assert(Array.isArray(policy.rules), "policy.rules is an array");
  const ruleIds = policy.rules.map((r: { id: string }) => r.id);
  assert(ruleIds.includes("age-range"), 'policy has "age-range" rule');
  assert(ruleIds.includes("uk-resident"), 'policy has "uk-resident" rule');
  assert(ruleIds.includes("low-savings"), 'policy has "low-savings" rule');
  console.log();

  // ── Test 4: Tools — listing + annotations ──
  console.log("4. Tools — listing + annotations");
  const tools = await client.listTools();
  const toolList = tools.tools || [];
  assert(toolList.length === 8, `listTools() returns 8 (got ${toolList.length})`);

  const toolNames = toolList.map((t) => t.name);
  assert(
    !toolNames.some((n) => n.endsWith("_get_service_info")),
    "NO _get_service_info tools (migrated to resources)"
  );
  assert(
    !toolNames.some((n) => n.endsWith("_get_requirements")),
    "NO _get_requirements tools (migrated to resources)"
  );
  assert(
    !toolNames.some((n) => n.endsWith("_get_consent_model")),
    "NO _get_consent_model tools (migrated to resources)"
  );

  const eligTools = toolList.filter((t) => t.name.endsWith("_check_eligibility"));
  assert(eligTools.length === 4, `4 check_eligibility tools (got ${eligTools.length})`);
  for (const t of eligTools) {
    const ann = t.annotations as Record<string, unknown> | undefined;
    assert(
      ann?.readOnlyHint === true,
      `${t.name} has readOnlyHint: true (got ${ann?.readOnlyHint})`
    );
    assert(
      ann?.idempotentHint === true,
      `${t.name} has idempotentHint: true (got ${ann?.idempotentHint})`
    );
  }

  const stateTools = toolList.filter((t) => t.name.endsWith("_advance_state"));
  assert(stateTools.length === 4, `4 advance_state tools (got ${stateTools.length})`);
  for (const t of stateTools) {
    const ann = t.annotations as Record<string, unknown> | undefined;
    assert(
      ann?.readOnlyHint === false,
      `${t.name} has readOnlyHint: false (got ${ann?.readOnlyHint})`
    );
    assert(
      ann?.idempotentHint === false,
      `${t.name} has idempotentHint: false (got ${ann?.idempotentHint})`
    );
  }
  console.log();

  // ── Test 5: Tools — check_eligibility execution ──
  console.log("5. Tools — check_eligibility execution");

  // Eligible citizen
  const eligibleResult = await client.callTool({
    name: "apply_universal_credit_check_eligibility",
    arguments: {
      citizen_data: { age: 30, jurisdiction: "England", savings: 5000, bank_account: true },
    },
  });
  const eligibleText = (eligibleResult.content as Array<{ type: string; text: string }>)[0].text;
  const eligibleData = JSON.parse(eligibleText);
  assert(eligibleData.eligible === true, "Eligible citizen → eligible: true");
  const passedIds = eligibleData.passed.map((r: { id: string }) => r.id);
  assert(passedIds.includes("age-range"), "age-range rule passed");
  assert(passedIds.includes("uk-resident"), "uk-resident rule passed");

  // Ineligible citizen (under 18)
  const ineligibleResult = await client.callTool({
    name: "apply_universal_credit_check_eligibility",
    arguments: {
      citizen_data: { age: 15, jurisdiction: "England", savings: 5000, bank_account: true },
    },
  });
  const ineligibleText = (ineligibleResult.content as Array<{ type: string; text: string }>)[0].text;
  const ineligibleData = JSON.parse(ineligibleText);
  assert(ineligibleData.eligible === false, "Under-18 citizen → eligible: false");
  const failedIds = ineligibleData.failed.map((r: { id: string }) => r.id);
  assert(failedIds.includes("age-range"), "age-range rule failed for under-18");
  console.log();

  // ── Test 6: Tools — advance_state execution ──
  console.log("6. Tools — advance_state execution");

  // Valid transition
  const validTransition = await client.callTool({
    name: "apply_universal_credit_advance_state",
    arguments: { current_state: "not-started", trigger: "verify-identity" },
  });
  const validText = (validTransition.content as Array<{ type: string; text: string }>)[0].text;
  const validData = JSON.parse(validText);
  assert(validData.success === true, "Valid transition → success: true");
  assert(
    validData.fromState === "not-started",
    `fromState === "not-started" (got "${validData.fromState}")`
  );
  assert(
    validData.toState === "identity-verified",
    `toState === "identity-verified" (got "${validData.toState}")`
  );

  // Invalid transition
  const invalidTransition = await client.callTool({
    name: "apply_universal_credit_advance_state",
    arguments: { current_state: "not-started", trigger: "submit-claim" },
  });
  const invalidText = (invalidTransition.content as Array<{ type: string; text: string }>)[0].text;
  const invalidData = JSON.parse(invalidText);
  assert(invalidData.success === false, "Invalid transition → success: false");
  console.log();

  // ── Test 7: Prompts — listing + execution ──
  console.log("7. Prompts — listing + execution");
  const prompts = await client.listPrompts();
  const promptList = prompts.prompts || [];
  assert(promptList.length === 8, `listPrompts() returns 8 (got ${promptList.length})`);

  const promptNames = promptList.map((p) => p.name);
  assert(
    promptNames.includes("apply_universal_credit_journey"),
    "UC journey prompt exists"
  );
  assert(
    promptNames.includes("apply_universal_credit_eligibility_check"),
    "UC eligibility_check prompt exists"
  );
  assert(
    promptNames.includes("renew_driving_licence_journey"),
    "DVLA journey prompt exists"
  );

  // Execute journey prompt (must pass arguments: {} even when optional)
  const journeyResult = await client.getPrompt({
    name: "apply_universal_credit_journey",
    arguments: {},
  });
  assert(
    journeyResult.messages.length > 0,
    "Journey prompt returns messages"
  );
  const journeyMsg = journeyResult.messages[0];
  assert(journeyMsg.role === "user", 'Journey prompt message role === "user"');
  const journeyText = (journeyMsg.content as { type: string; text: string }).text;
  assert(
    journeyText.includes("Apply for Universal Credit"),
    'Journey prompt text contains "Apply for Universal Credit"'
  );
  assert(
    journeyText.includes("State Machine") || journeyText.includes("Journey Flow"),
    "Journey prompt text contains state machine section"
  );

  // Execute eligibility prompt with args
  const eligPromptResult = await client.getPrompt({
    name: "apply_universal_credit_eligibility_check",
    arguments: { citizen_data_json: '{"age": 25}' },
  });
  const eligPromptText = (eligPromptResult.messages[0].content as { type: string; text: string }).text;
  assert(
    eligPromptText.includes("age-range"),
    "Eligibility prompt includes age-range rule"
  );
  assert(
    eligPromptText.includes('"age": 25'),
    "Eligibility prompt includes provided citizen data"
  );
  console.log();

  // ── Cleanup ──
  await client.close();
  await server.close();

  // ── Summary ──
  console.log("===========================================");
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log("===========================================");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test script crashed:", err);
  process.exit(1);
});
