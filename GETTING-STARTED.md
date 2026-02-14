# Getting Started with the Agentic Legibility Stack

A step-by-step guide to running the simulator and exploring how UK government services could work through AI agents.

---

## Prerequisites

- **Node.js 18+** (check with `node --version`)
- **npm** (comes with Node.js)
- **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

## Setup

1. **Install dependencies** from the project root:

   ```bash
   npm install
   ```

2. **Set your Anthropic API key** — create (or edit) the file `apps/citizen-experience/.env.local`:

   ```
   ANTHROPIC_API_KEY=sk-ant-...your-key-here...
   ```

   **Chat will not work without this.** The file must be at `apps/citizen-experience/.env.local` (not the repo root).

3. **Seed demo data** (optional but recommended — pre-populates the evidence store so the Studio has something to show on first launch):

   ```bash
   npm run seed
   ```

## Starting the Apps

From the project root, run:

```bash
npm run dev
```

This starts both applications:

| App | URL | Purpose |
|-----|-----|---------|
| Citizen Experience | [http://localhost:3100](http://localhost:3100) | The citizen-facing chat interface |
| Legibility Studio | [http://localhost:3101](http://localhost:3101) | The admin dashboard for services & evidence |

---

## Your First Session

### 1. Choose a Persona

Open [http://localhost:3100](http://localhost:3100). You'll see the **persona picker** with three options:

| Persona | Description | Good for trying |
|---------|-------------|-----------------|
| **Emma & Liam** | Young expecting couple, first baby | Benefits, family services, driving |
| **Rajesh** | Self-employed IT consultant, two kids | Tax, child benefit, driving |
| **Margaret** | Retired, managing health conditions | Pension, benefits eligibility, driving |

**Start with Emma & Liam** — they have the richest data and most interesting scenarios.

### 2. Choose Your Agent

After picking a persona, you'll see the **Dashboard**. In the header, you can switch between two agent personalities:

- **DOT** — The cautious agent. Asks permission before using your data. Explains what it's doing and why. Best for seeing how consent works.
- **MAX** — The proactive agent. Auto-fills data without asking. Gets things done quickly. Best for seeing efficiency vs. transparency trade-offs.

**Start with DOT** to see the full consent flow, then try MAX to compare.

### 3. Explore the Dashboard

The Dashboard shows:

- **Your Details** — name, NI number (masked), address, date of birth
- **Digital Credentials** — driving licence status, NI verification, proof of address
- **Upcoming Dates** — MOT expiry, tax renewal, baby due date (persona-specific)
- **Service Cards** — Driving, Benefits & Money, Family
- **Recent Conversations** — resume previous chats

### 4. Start a Conversation

Tap any **service card** (e.g., "Driving") to start chatting. Try these prompts:

**For Emma & Liam (driving):**
> "Our car's MOT is expiring in April, what do we need to do?"

**For Emma & Liam (benefits):**
> "We're expecting our first baby — what benefits can we claim?"

**For Margaret (benefits):**
> "Can you check if I'm getting everything I'm entitled to?"

**For Rajesh (driving):**
> "I need to renew my driving licence"

### 5. See the Agent Think

After the agent responds, tap the **reasoning button** (bottom-right corner). This shows Claude's internal thinking process — how it decided what to say and which data to use.

### 6. Trigger a Handoff

Try typing:
> "I want to speak to a real person"

This triggers the **handoff system**, which creates a structured package with your conversation summary, routing info, and contact details. You'll see a notice with the appropriate department and phone number.

---

## Viewing Evidence in the Studio

Open [http://localhost:3101](http://localhost:3101) to see the **Legibility Studio**.

### Services

Go to **Services** to see the three government services formally defined:

- **Renew Driving Licence** (DVLA) — with fee, SLA, eligibility rules
- **Apply Universal Credit** (DWP) — complex eligibility with edge cases
- **Check State Pension** (DWP) — read-only lookup

Click into any service to see its **four artefacts**:

1. **Capability Manifest** — what the service does, its inputs/outputs, constraints
2. **Policy Ruleset** — formal eligibility rules with conditions and failure messages
3. **State Model** — the state machine showing valid transitions
4. **Consent Model** — what data sharing is required and why

### Evidence

Go to **Evidence** to see the trace log from your chat sessions (and demo sessions if you ran `npm run seed`):

- **Sessions list** (left panel) — each chat creates a trace
- **Explorer** (right panel) — see every event: LLM requests, policy evaluations, consent grants, capability results, receipts
- **Replay** — step through events chronologically

Each trace includes rich event types:
- `llm.request` / `llm.response` — what was sent to and received from Claude
- `policy.evaluated` — formal eligibility check results
- `consent.granted` — what data was shared and why
- `capability.invoked` / `capability.result` — service invocation with duration
- `receipt.issued` — citizen-facing proof of what happened
- `handoff.initiated` — when escalation was triggered

### Gap Analysis

Go to **Gap Analysis** to see artefact completeness across all services — which services have full manifests, policies, state models, and consent definitions.

---

## What Each Feature Demonstrates

| Feature | Demonstrates |
|---------|-------------|
| Chat with personas | How citizens interact with government services conversationally |
| DOT vs MAX agents | The trade-off between transparency (asking permission) and efficiency (auto-filling) |
| Capability Manifests | How government services become machine-readable and discoverable by agents |
| Policy Rulesets | How eligibility rules become structured, inspectable, and testable |
| Consent recording | How data sharing stays explicit and auditable |
| Evidence Plane | How every agent action is traced, receipted, and accountable |
| Handoff system | How AI agents hand off to humans when things get complex |
| Digital credentials | How identity works in an agentic context (simulated GOV.UK Wallet) |
| State models | How service journeys have defined states and valid transitions |
| MCP tool calling | How agents can access live government data (flood warnings, MP lookup, bank holidays) |

---

## Tips

- **Compare agents**: Ask the same question as DOT and MAX to see how they differ
- **Try live data**: Ask "Are there any flood warnings near me?" or "Who is my MP?" — the agent calls real GOV.UK APIs
- **Check the evidence**: After every chat, open the Studio to see the trace
- **Test edge cases**: Try Margaret asking about Universal Credit — she's over pension age, so policy evaluation flags her as ineligible and suggests Pension Credit instead
- **Safeguarding**: Mentioning sensitive topics triggers immediate handoff protocols
- **Multiple sessions**: Each persona maintains separate conversation history

---

## Troubleshooting

### "Chat request failed" error when sending a message

This almost always means your Anthropic API key is missing or invalid.

1. Check the file exists: `apps/citizen-experience/.env.local`
2. Check it contains: `ANTHROPIC_API_KEY=sk-ant-...` (your real key, not a placeholder)
3. Restart the dev server after creating or editing the file (`Ctrl+C`, then `npm run dev`)
4. Check the terminal for a warning: "ANTHROPIC_API_KEY is not set"

### Studio shows "No traces recorded yet"

Run `npm run seed` to populate demo trace data. Or send a few chat messages first — traces are created automatically from conversations.

### Port already in use

The apps default to ports 3100 and 3101. If those are taken, edit the `dev` and `start` scripts in:
- `apps/citizen-experience/package.json` (change `--port 3100`)
- `apps/legibility-studio/package.json` (change `--port 3101`)
- Also update `apps/legibility-studio/app/evidence/page.tsx` to match the citizen-experience port

---

## Project Structure

```
agentic-legibility-stack/
  apps/
    citizen-experience/    # Chat interface (port 3100)
    legibility-studio/     # Admin dashboard (port 3101)
  packages/
    schemas/               # Shared TypeScript types
    runtime/               # CapabilityInvoker, ServiceRegistry, HandoffManager
    evidence/              # SQLite trace store, emitter, receipts
    legibility/            # PolicyEvaluator, StateMachine, ConsentManager
    identity/              # GOV.UK One Login & Wallet simulators
    personal-data/         # Two-tier data model (verified + incidental)
    adapters/              # Anthropic, GOV.UK Content, MCP adapters
  data/
    services/              # Service definitions (manifest, policy, state-model, consent)
    simulated/             # Test users and wallet credentials
```
