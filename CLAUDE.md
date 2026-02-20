# Agentic Legibility Stack

## What is this project?
A Turborepo monorepo implementing a reference architecture for UK government services accessed through AI agents. It demonstrates how citizens can interact with gov services via chat while maintaining full transparency and auditability.

## Project structure

```
apps/
  citizen-experience/   → Citizen-facing chat + auth UI (Next.js, port 3000)
  legibility-studio/    → Admin dashboard for services, traces, gap analysis (Next.js, port 3001)

packages/
  adapters/     → LLM + MCP integration (Anthropic SDK lives here ONLY)
  evidence/     → SQLite append-only store for traces + receipts
  identity/     → User identity and authentication
  legibility/   → State models and legibility logic
  personal-data/→ Personal data handling
  runtime/      → CapabilityInvoker and runtime orchestration
  schemas/      → Shared TypeScript schemas

data/
  services/*/   → manifest.json, policy.json, state-model.json, consent.json per service
  simulated/    → test-users.json, wallet-credentials.json
  traces.db     → SQLite evidence store (created at runtime)
```

## Commands
- `npm run dev` — start both apps in dev mode
- `npm run build` — build everything
- `npm run seed` — seed the traces database

## Architecture rules — IMPORTANT
- ALL service calls route through `CapabilityInvoker` in `@als/runtime` (single choke point)
- ALL LLM calls go through `AnthropicAdapter` in `@als/adapters` — zero direct Anthropic SDK usage elsewhere
- `@anthropic-ai/sdk` and `@modelcontextprotocol/sdk` live in `@als/adapters` ONLY
- legibility-studio fetches evidence from citizen-experience API (`http://localhost:3000/api/traces`) — it does NOT import `@als/evidence` directly

## Build gotchas — READ BEFORE CHANGING DEPENDENCIES
- `serverExternalPackages: ["better-sqlite3"]` is required in BOTH Next.js configs — do not remove
- Do NOT add `@als/evidence` as a dependency of legibility-studio — it causes lru-cache/native module crashes. Studio fetches via HTTP instead.
- MCP tool types need `as unknown as Array<Record<string, unknown>>` cast for the adapter interface

## Environment
- Requires `ANTHROPIC_API_KEY` env variable for LLM functionality
- Node.js with npm workspaces
- Package manager: npm
