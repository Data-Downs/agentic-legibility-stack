# ALS GOV.UK Services MCP Server — Developer Guide

A public MCP server exposing 110 UK government services as structured tools, resources, and prompts. No API key required.

**Endpoint:**
```
https://als-studio.chris-8ab.workers.dev/api/mcp
```

**Transport:** StreamableHTTP (MCP protocol over HTTPS)

---

## Quick Start

### Claude Desktop

Add this to your Claude Desktop MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "als-govuk": {
      "type": "streamable-http",
      "url": "https://als-studio.chris-8ab.workers.dev/api/mcp"
    }
  }
}
```

Restart Claude Desktop. You'll have access to 110 UK government services.

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "als-govuk": {
      "type": "streamable-http",
      "url": "https://als-studio.chris-8ab.workers.dev/api/mcp"
    }
  }
}
```

### Any MCP Client (TypeScript SDK)

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-app", version: "1.0" });
const transport = new StreamableHTTPClientTransport(
  new URL("https://als-studio.chris-8ab.workers.dev/api/mcp")
);
await client.connect(transport);

// List all tools
const { tools } = await client.listTools();
console.log(`${tools.length} tools available`);

// Call a tool
const result = await client.callTool("dwp_universal_credit_check_eligibility", {
  citizen_data: { age: 28, employment_status: "unemployed", savings: 2400 }
});
console.log(result);
```

### Raw HTTP (curl)

```bash
# Initialize
curl -X POST https://als-studio.chris-8ab.workers.dev/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# List tools
curl -X POST https://als-studio.chris-8ab.workers.dev/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Call a tool
curl -X POST https://als-studio.chris-8ab.workers.dev/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"dwp_universal_credit_check_eligibility","arguments":{"citizen_data":{"age":28,"employment_status":"unemployed","savings":2400}}}}'
```

Responses are in SSE format: `event: message\ndata: {JSON}\n\n`

---

## What's Available

### 220 Tools (2 per service)

**`{service}_check_eligibility`** — Evaluate policy rules against citizen data.

- Input: `citizen_data` (object with fields like age, employment_status, savings, jurisdiction, etc.)
- Output: rules passed, rules failed, edge cases, explanation
- Read-only, idempotent — safe to call repeatedly

**`{service}_advance_state`** — Move through the service state machine.

- Input: `current_state` (string), `trigger` (string)
- Output: new state, whether it's terminal, whether it requires a receipt, allowed next transitions
- Mutating, not idempotent

Example tool names:
```
dwp_universal_credit_check_eligibility
dwp_universal_credit_advance_state
dvla_renew_driving_licence_check_eligibility
dvla_renew_driving_licence_advance_state
hmrc_child_benefit_check_eligibility
gro_register_birth_advance_state
```

### 440 Resources (4 per service)

Each service has 4 JSON resources accessible via `service://` URIs:

| Resource | URI Pattern | What It Contains |
|----------|-------------|------------------|
| Manifest | `service://{id}/manifest` | Service identity, inputs/outputs, fees, SLAs, redress pathways |
| Policy | `service://{id}/policy` | Eligibility rules with conditions, failure messages, alternatives |
| State Model | `service://{id}/state-model` | Valid states and transitions, terminal states, receipt triggers |
| Consent | `service://{id}/consent` | Data sharing requirements, purposes, revocation mechanisms |

Example:
```
service://dwp-universal-credit/manifest
service://dwp-universal-credit/policy
service://dvla-renew-driving-licence/state-model
service://gro-register-birth/consent
```

### 220 Prompts (2 per service)

**`{service}_journey`** — A step-by-step guide for helping a citizen through the service. Includes state flow, rules, constraints, and consent requirements. Accepts an optional `citizen_context` argument.

**`{service}_eligibility_check`** — A focused eligibility assessment template. Accepts an optional `citizen_data_json` argument with the citizen's details.

---

## Example: Check Universal Credit Eligibility

Call the `dwp_universal_credit_check_eligibility` tool with citizen data:

```json
{
  "citizen_data": {
    "age": 28,
    "jurisdiction": "England",
    "employment_status": "unemployed",
    "savings": 2400,
    "housing_status": "renting"
  }
}
```

Response (abbreviated):
```json
{
  "eligible": false,
  "passed": [
    { "id": "age-range", "description": "Applicant must be 18 or over and under State Pension age" },
    { "id": "under-pension-age", "description": "Applicant must be under State Pension age" },
    { "id": "uk-resident", "description": "Applicant must be living in the UK" }
  ],
  "failed": [
    { "id": "capital-limit", "description": "Savings must be under £16,000", "reason_if_failed": "..." }
  ],
  "edge_cases": [
    { "id": "student-exception", "description": "Students may qualify in certain circumstances" }
  ],
  "explanation": "Based on the rules evaluated..."
}
```

## Example: Walk Through a State Machine

Call `dwp_universal_credit_advance_state`:

```json
{
  "current_state": "not-started",
  "trigger": "begin"
}
```

Response:
```json
{
  "success": true,
  "newState": "identity-verification",
  "isTerminal": false,
  "requiresReceipt": false,
  "allowedTransitions": ["identity-verified", "handed-off"]
}
```

---

## Services Covered

110 services across 15 UK government departments:

| Department | Count | Examples |
|------------|-------|---------|
| HMRC | 27 | Child Benefit, Self Assessment, Tax-Free Childcare, Stamp Duty |
| DWP | 21 | Universal Credit, PIP, State Pension, Carer's Allowance |
| Local Authority | 14 | Council Tax, School Admissions, Planning Permission |
| Home Office | 6 | UK Visa, Settled Status, Passport |
| HMCTS | 6 | Probate, Divorce, Employment Tribunal |
| NHS | 5 | GP Registration, Healthy Start, NHS Prescriptions |
| GRO | 5 | Register Birth, Register Death, Marriage Certificate |
| DVLA | 5 | Driving Licence, Vehicle Tax, SORN |
| DVSA | 2 | Theory Test, Driving Test |
| OPG | 2 | Lasting Power of Attorney |

Plus Companies House, Land Registry, SLC, ICO, and FCA.

---

## Use Cases

**Build a benefits advisor chatbot** — Use the eligibility tools to check which benefits a citizen qualifies for based on their circumstances, then use the journey prompts to guide them through the application.

**Government service search** — Read manifests to build a searchable catalog of services with fees, SLAs, and requirements.

**Compliance checking** — Use state models to verify that a service integration follows the correct state machine transitions.

**Training data for gov-focused AI** — The 440 resources provide structured, machine-readable descriptions of how UK government services work.

**Prototype a GOV.UK frontend** — Use the consent models to build data-sharing permission screens, and state models to build progress trackers.

---

## Technical Details

- **Transport:** StreamableHTTP (MCP protocol version `2024-11-05`)
- **Authentication:** None — open access, open CORS
- **Hosting:** Cloudflare Workers (global edge)
- **Data source:** Cloudflare D1 database
- **Stateless:** Each request creates a fresh server instance — no session management needed
- **CORS headers:** `Access-Control-Allow-Origin: *` — works from browsers
- **Response format:** Server-Sent Events (`event: message\ndata: {JSON}`)

---

## Important Notes

- This is a **reference implementation**, not a live government service. The policy rules and state models are illustrative.
- 4 services are hand-authored with detailed artefacts (Universal Credit, Driving Licence, State Pension, Robot Registration). The remaining 106 are auto-generated from GOV.UK content.
- The server is **read-only from the client's perspective** — `advance_state` returns what the new state would be, it doesn't persist anything server-side.
- No rate limiting is currently enforced, but please be reasonable with usage.

---

## Source Code

The MCP server implementation lives in the [Agentic Legibility Stack](https://github.com/datadowns/agentic-legibility-stack) monorepo:

- Server core: `packages/mcp-server/src/index.ts`
- Tool handlers: `packages/mcp-server/src/tool-handlers.ts`
- Remote HTTP route: `apps/legibility-studio/app/api/mcp/route.ts`
- D1 factory: `apps/legibility-studio/lib/mcp-server.ts`
