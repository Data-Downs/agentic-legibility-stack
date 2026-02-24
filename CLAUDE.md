# Agentic Legibility Stack

## What is this project?
A Turborepo monorepo implementing a reference architecture for UK government services accessed through AI agents. It demonstrates how citizens can interact with gov services via chat while maintaining full transparency and auditability.

## Project structure

```
apps/
  citizen-experience/   → Citizen-facing chat + auth UI (Next.js, port 3100)
    data/               → Persona files (emma-liam.json, margaret.json, etc.) and prompts/
  legibility-studio/    → Admin dashboard for services, traces, gap analysis (Next.js, port 3101)

packages/
  adapters/     → LLM + MCP client integration (Anthropic SDK lives here ONLY)
                  AnthropicAdapter, GovukContentAdapter, McpAdapter, AdapterRegistry
  evidence/     → SQLite append-only store: TraceStore, CaseStore, ReceiptGenerator, ReplayEngine
  identity/     → User identity and authentication (OneLogin + wallet simulators)
  legibility/   → State models, policy DSL, consent model, artefact loading
  mcp-server/   → Local MCP server exposing service JSON artefacts as tools
  personal-data/→ Personal data handling (verified, incidental, consent ledger; uses better-sqlite3)
  runtime/      → CapabilityInvoker, ServiceRegistry, HandoffManager
  schemas/      → Shared TypeScript schemas

scripts/
  seed-traces.ts  → Seeds demo trace data
  seed-ledger.ts  → Seeds ledger case data

data/
  services/*/   → manifest.json, policy.json, state-model.json, consent.json per service
  simulated/    → test-users.json, wallet-credentials.json
  traces.db     → SQLite evidence store (created at runtime; also written to apps/citizen-experience/data/traces.db)
```

## Commands
- `npm run dev` — start both apps in dev mode
- `npm run build` — build everything
- `npm run lint` — run linter across all packages
- `npm run test` — run tests across all packages
- `npm run clean` — remove .next build caches from both apps
- `npm run seed` — seed the traces database
- `npm run seed:ledger` — seed the ledger with case data

## Architecture rules — IMPORTANT
- ALL service calls route through `CapabilityInvoker` in `@als/runtime` (single choke point)
- ALL LLM calls go through `AnthropicAdapter` in `@als/adapters` — zero direct Anthropic SDK usage elsewhere
- `@anthropic-ai/sdk` lives in `@als/adapters` ONLY
- `@modelcontextprotocol/sdk` SERVER usage lives in `@als/mcp-server` — CLIENT usage lives in `@als/adapters` and `apps/citizen-experience/lib/` (mcp-client.ts for external govmcp, local-mcp-client.ts for local MCP server)
- legibility-studio fetches evidence from citizen-experience API (`http://localhost:3100/api/traces`) — it does NOT import `@als/evidence` directly

## Build gotchas — READ BEFORE CHANGING DEPENDENCIES
- `serverExternalPackages: ["better-sqlite3"]` is required in BOTH Next.js configs — do not remove
- Do NOT add `@als/evidence` as a dependency of legibility-studio — it causes lru-cache/native module crashes. Studio fetches via HTTP instead.
- MCP tool types need `as unknown as Array<Record<string, unknown>>` cast for the adapter interface
- `better-sqlite3` is used by both `@als/evidence` and `@als/personal-data`

## Environment
- Requires `ANTHROPIC_API_KEY` env variable for LLM functionality
- Node.js with npm workspaces
- Package manager: npm
