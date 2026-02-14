# Agentic Legibility Stack — Reference Implementation

## Claude Code Planning & Build Brief

**Version:** 1.0
**Date:** 13 February 2026
**Source Prototype:** https://github.com/Data-Downs/gov-agent-simulator (branch: `Taskified`)

---

## 1. What This Project Is (Plain English)

We are building a working demonstration of how UK government services could work when citizens interact through AI agents instead of (or alongside) web forms.

Right now, if you want to renew your driving licence, you go to GOV.UK, fill in forms, upload documents, and wait. In an agentic future, you'd tell an AI assistant "I need to renew my driving licence" and it would handle the process — but in a way that is transparent, accountable, and safe.

This project proves that's possible by building three things:

1. **Citizen Experience** — the conversational interface where citizens interact with an AI agent to access government services (this already exists as a prototype and we're preserving it)
2. **Legibility Studio** — a tool for service designers to define what a government service looks like to an AI agent: what it does, who's eligible, what consent is needed, what data it requires
3. **Evidence Plane** — a built-in layer (not a separate app) that records everything the agent does, producing receipts, traces, and audit logs so every action is accountable

We are also adding:

4. **Personal Data Architecture** — a model for how citizens' personal data is stored, split between government-verified credentials (via GOV.UK Wallet) and personal information that stays on the citizen's device
5. **Human Handoff** — a structured way for the AI agent to hand the citizen over to a real person in a call centre when things get too complex or go wrong
6. **GOV.UK One Login & Wallet Integration** — simulated but architecturally real integration with the government's identity and digital document systems

This is NOT a production government system. It is a reference implementation — an architectural argument in executable form — that demonstrates how agent infrastructure for government should work.

---

## 2. Source Prototype

**Repository:** https://github.com/Data-Downs/gov-agent-simulator
**Branch:** `Taskified`

The prototype is a Node.js application with:

- Express.js server (`server.js`)
- Static front-end files in `/public`
- JSON configuration in `/data`
- Agent prompts in `/prompts`
- Anthropic API integration for conversational AI
- MCP (Model Context Protocol) server integration
- Simulated multi-service government agent experience

**What we preserve:** All UI, all flows, all agent behaviour, all conversational quality.
**What we change:** The internal architecture beneath it.

---

## 3. Tech Stack Decision

### Choice: Next.js (TypeScript) in a Turborepo Monorepo

**Rationale:**

| Factor | Decision |
|--------|----------|
| GDS compatibility | Node.js is explicitly listed as a supported language in the GDS Way. TypeScript is explicitly endorsed for Node.js projects. |
| Developer familiarity | Next.js is the most widely adopted React framework globally. Any developer hired into government digital will likely know it. |
| Monorepo structure | Turborepo gives us the `/apps` and `/packages` layout from the planning document with proper workspace management, shared dependencies, and build caching. |
| Existing prototype | The prototype is already Node.js. Migration path is straightforward. |
| Server-side rendering | Next.js supports SSR, which matters for accessibility (a GDS requirement) and progressive enhancement. |
| API routes | Next.js API routes give us a clean backend without needing a separate Express server. |
| Nothing proprietary | Next.js is open source (MIT). Turborepo is open source. TypeScript is open source. No vendor lock-in. |

### Full Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 14+ (App Router) | Standard, well-documented, GDS-compatible |
| Language | TypeScript | Type safety, GDS-endorsed, catches errors early |
| Monorepo | Turborepo | Clean workspace management for apps + packages |
| Styling | GOV.UK Design System + Tailwind CSS | GOV.UK Frontend for government patterns, Tailwind for custom UI |
| State | React Context + Zustand | Simple, no boilerplate, works with SSR |
| AI Integration | Anthropic SDK (TypeScript) | Direct Claude API integration |
| MCP | Existing MCP server integration | Preserved from prototype |
| Data Storage | JSON files (manifests/config) + SQLite (traces/receipts) | No external database dependency, portable, inspectable |
| Testing | Vitest + Playwright | Fast unit tests, reliable E2E tests |
| Linting | ESLint + Prettier | Standard, matches GDS practice |

---

## 4. Repository Structure

```
agentic-legibility-stack/
│
├── apps/
│   ├── citizen-experience/          # The main citizen-facing agent UI
│   │   ├── app/                     # Next.js App Router pages
│   │   ├── components/              # React components
│   │   ├── lib/                     # Client-side utilities
│   │   └── public/                  # Static assets
│   │
│   └── legibility-studio/           # Service designer authoring tool
│       ├── app/                     # Next.js App Router pages
│       ├── components/              # Editor components
│       └── lib/                     # Studio utilities
│
├── packages/
│   ├── runtime/                     # Agent orchestration & capability invocation
│   │   ├── capability-invoker.ts    # THE single choke point for all service calls
│   │   ├── service-registry.ts      # Registry of available capabilities
│   │   ├── agent-orchestrator.ts    # Plan creation and execution
│   │   └── handoff-manager.ts       # Human escalation logic
│   │
│   ├── legibility/                  # Artefact definitions and management
│   │   ├── capability-manifest.ts   # Capability manifest schema and types
│   │   ├── policy-dsl.ts            # Policy rule engine
│   │   ├── state-model.ts           # State machine definitions
│   │   ├── consent-model.ts         # Consent and delegation
│   │   └── artefact-store.ts        # Versioned artefact storage
│   │
│   ├── evidence/                    # Trace, receipts, and audit
│   │   ├── trace-emitter.ts         # Structured event emission
│   │   ├── receipt-generator.ts     # Usage receipt creation
│   │   ├── trace-store.ts           # Append-only trace storage (SQLite)
│   │   └── replay-engine.ts         # Trace replay capability
│   │
│   ├── identity/                    # One Login & Wallet integration layer
│   │   ├── one-login-simulator.ts   # Simulated OIDC provider
│   │   ├── wallet-simulator.ts      # Simulated credential wallet
│   │   ├── credential-types.ts      # Verifiable credential type definitions
│   │   └── identity-context.ts      # Current user identity state
│   │
│   ├── personal-data/               # Citizen personal data architecture
│   │   ├── data-model.ts            # Schema for personal data
│   │   ├── verified-store.ts        # Interface to Wallet credentials
│   │   ├── incidental-store.ts      # On-device personal data (simulated)
│   │   ├── data-privacy.ts          # Privacy rules and data minimisation
│   │   └── consent-ledger.ts        # Record of what data was shared with whom
│   │
│   ├── adapters/                    # External service connectors
│   │   ├── govuk-content.ts         # GOV.UK Content API adapter
│   │   ├── anthropic.ts             # Claude API adapter
│   │   └── mcp.ts                   # MCP server adapter
│   │
│   └── schemas/                     # Shared JSON Schemas and TypeScript types
│       ├── capability-manifest.schema.json
│       ├── policy-ruleset.schema.json
│       ├── state-model.schema.json
│       ├── consent-grant.schema.json
│       ├── trace-event.schema.json
│       ├── receipt.schema.json
│       ├── handoff-package.schema.json
│       └── personal-data.schema.json
│
├── data/
│   ├── services/                    # Demo service definitions
│   │   ├── renew-driving-licence/
│   │   │   ├── manifest.json
│   │   │   ├── policy.json
│   │   │   ├── state-model.json
│   │   │   └── consent.json
│   │   ├── apply-universal-credit/
│   │   │   ├── manifest.json
│   │   │   ├── policy.json
│   │   │   ├── state-model.json
│   │   │   └── consent.json
│   │   └── check-state-pension/
│   │       ├── manifest.json
│   │       ├── policy.json
│   │       ├── state-model.json
│   │       └── consent.json
│   │
│   └── simulated/                   # Simulated identity and wallet data
│       ├── test-users.json
│       ├── wallet-credentials.json
│       └── service-directory.json
│
├── docs/                            # Documentation
│   ├── architecture.md
│   ├── personal-data-model.md
│   ├── one-login-integration.md
│   ├── wallet-integration.md
│   ├── handoff-protocol.md
│   └── gap-analysis.md
│
├── turbo.json                       # Turborepo configuration
├── package.json                     # Root workspace config
├── tsconfig.json                    # Shared TypeScript config
└── README.md
```

---

## 5. Core Architectural Principles

### 5.1 No Direct Tool Calls

The agent must NEVER call MCP servers, external APIs, or any government service directly.

Every single call goes through one function:

```typescript
CapabilityInvoker.invoke(capability_id, input, context)
```

This is the single choke point. It is where:
- The capability manifest is looked up
- Policy rules are evaluated
- Consent is checked
- The invocation is traced
- A receipt is generated
- The actual call is made
- The result is logged

Nothing bypasses this.

### 5.2 Everything Is a Capability

Each government service interaction is defined by four artefacts:
1. **Capability Manifest** — what the service does, what it needs, what it promises
2. **Policy Ruleset** — who is eligible, what the rules are, what evidence is needed
3. **State Model** — what states a request can be in, what transitions are allowed
4. **Consent Model** — what data is being shared, with whom, for how long

### 5.3 Publish vs Prove (Two Planes)

**Control Plane (Legibility Studio):**
- Where service designers author, edit, and publish artefacts
- Published artefacts become immutable (frozen versions)
- This is the "what should happen" side

**Evidence Plane (built into both apps):**
- Where runtime activity is recorded
- Receipts, traces, logs, audit records
- Append-only (no silent edits)
- This is the "what actually happened" side

The Evidence Plane is NOT a third app. It is a data layer and UI panel that appears within both the Citizen Experience (showing the citizen their own receipts and activity) and the Legibility Studio (showing the full audit/admin view with all traces, performance metrics, and failure analysis).

### 5.4 Data Privacy First

Personal data follows a strict split:

| Data Type | Where It Lives | Example | Who Controls It |
|-----------|---------------|---------|-----------------|
| Verified Credentials | GOV.UK Wallet (on device) | Driving licence, veteran status | Government issues, citizen holds |
| Incidental Personal Data | On-device secure store | Partner's name, preferences, notes | Citizen only |
| Session Context | In-memory only | Current conversation state | Destroyed after session |
| Consent Records | Evidence Plane | "I agreed to share my address with DVLA" | Append-only audit log |

Nothing personal is stored server-side unless the citizen explicitly consents, and even then, the consent is recorded as a formal artefact.

### 5.5 Human Handoff Is a First-Class Concept

The agent must always be able to say "I can't help with this — let me connect you to a person." This is not a failure state. It is a designed transition.

---

## 6. GOV.UK One Login Integration (Simulated)

### What One Login Actually Does

GOV.UK One Login is the government's identity system. It uses OIDC (OpenID Connect), which is the same protocol used by "Sign in with Google" or "Sign in with Apple" — a well-established, secure way to prove identity online.

It provides:
- **Authentication** — "this person is who they claim to be" (via email + password + 2FA)
- **Identity verification** — "we have checked their passport/driving licence and confirmed their identity" (higher confidence)
- **User attributes** — name, date of birth, address (returned as claims in a secure token)

### Our Simulated Version

We build a `OneLoginSimulator` that:

1. Presents a simulated sign-in screen matching the GOV.UK One Login branding and flow
2. Returns a simulated OIDC token containing:
   - `sub` — unique user identifier (pairwise, as One Login does)
   - `email` — user's email
   - `phone_number` — user's phone (if requested)
   - Core identity claim (name, date of birth) — as a nested JWT matching One Login's format
   - Address claim
   - Level of confidence (`Cl`, `Cl.Cm` matching One Login's real levels)
3. Follows the same OIDC Authorization Code Flow that real One Login uses
4. Includes clear code comments marking exactly where real integration would differ

**The code must be structured so that swapping the simulator for real One Login is a configuration change, not a code rewrite.**

### Integration Points

```typescript
// packages/identity/one-login-simulator.ts

interface OneLoginConfig {
  mode: 'simulated' | 'integration' | 'production';
  clientId: string;
  redirectUri: string;
  scopes: string[];  // e.g. ['openid', 'email', 'phone']
  claims: string[];  // e.g. ['https://vocab.account.gov.uk/v1/coreIdentityJWT']
  levelOfConfidence: 'Cl' | 'Cl.Cm';
}
```

---

## 7. GOV.UK Wallet Integration (Simulated)

### What Wallet Actually Does

GOV.UK Wallet lets citizens save government-issued digital documents on their phone. These are verifiable credentials — digitally signed documents that can be checked for authenticity.

Currently available: HM Armed Forces Veteran Card. Coming next: digital driving licence.

Key principles:
- Documents are stored locally on the user's device (not in the cloud)
- The user decides whether to share information
- Only government-issued documents (not tickets or commercial cards)
- Built on top of One Login (you need a verified identity first)
- Uses OpenID4VCI for credential issuance
- Uses Decentralised Identifiers (DIDs) for issuer verification

### Our Simulated Version

We build a `WalletSimulator` that:

1. Maintains a simulated credential store per test user
2. Supports the same credential types Wallet uses:
   - **Identity credentials** (driving licence — `org.iso.18013.5.1.mDL`)
   - **Eligibility credentials** (veteran card)
   - **Suitability credentials** (DBS check results — future)
   - **Qualification credentials** (professional qualifications — future)
3. Implements simulated credential presentation (the citizen choosing to share a credential with a service)
4. Includes credential status checking (valid, expired, revoked)
5. Follows the same data model as the real Wallet technical documentation

### Credential Data Model

```typescript
// packages/identity/credential-types.ts

interface WalletCredential {
  id: string;
  type: CredentialType;
  issuer: {
    id: string;            // DID of issuing department
    name: string;          // e.g. "DVLA"
  };
  subject: {
    oneLoginSub: string;   // Linked to One Login identity
  };
  claims: Record<string, unknown>;  // The actual data (e.g. licence number, categories)
  issuedAt: string;        // ISO 8601
  expiresAt: string;       // ISO 8601
  status: 'valid' | 'expired' | 'revoked' | 'suspended';
  // In production, this would be a proper SD-JWT or mdoc
  // In simulation, it's a plain JSON object with a simulated signature
}

type CredentialType =
  | 'driving-licence'
  | 'veteran-card'
  | 'dbs-check'
  | 'professional-qualification';
```

### How It Connects to the Agent

When the agent needs to verify something about the citizen (e.g. "do they hold a valid driving licence?"), the flow is:

1. Agent identifies the need via the capability manifest's `evidence_requirements`
2. `CapabilityInvoker` checks what credentials are required
3. The system asks the citizen: "This service needs to see your driving licence from your Wallet. Do you want to share it?"
4. If consent is given, `WalletSimulator.presentCredential()` returns the relevant claims
5. The consent is recorded in the Evidence Plane
6. The credential data is used for the current session only — not stored server-side

---

## 8. Personal Data Architecture

### The Two-Tier Model

Citizens have two types of personal information:

**Tier 1: Verified Credentials (from Wallet)**
- Government-attested facts
- Cryptographically signed (in production)
- Examples: driving licence details, veteran status, national insurance number
- Stored in the Wallet on the citizen's device
- Shared only with explicit consent per-service, per-session

**Tier 2: Incidental Personal Data (on-device only)**
- Self-declared information the citizen provides to help the agent
- NOT verified by government
- Examples: partner's name, number of children, housing situation, communication preferences, notes about ongoing cases
- Stored only on the citizen's device (in production, this would be a secure local store; in our simulation, we use an in-memory store with clear architectural markers)
- Never transmitted to any server without explicit consent
- The citizen can edit or delete any of this at any time

### Data Model

```typescript
// packages/personal-data/data-model.ts

interface PersonalDataProfile {
  // Tier 1: Verified (from Wallet — read-only, citizen can revoke sharing)
  verified: {
    credentials: WalletCredential[];
    lastSyncedAt: string;
  };

  // Tier 2: Incidental (self-declared, on-device, fully citizen-controlled)
  incidental: {
    // Core personal context
    preferredName?: string;           // "Call me Dave" vs formal name
    householdMembers?: HouseholdMember[];
    communicationPreferences?: {
      preferredChannel: 'email' | 'phone' | 'post' | 'text';
      preferredLanguage: string;
      accessibilityNeeds?: string[];
    };
    housingStatus?: string;
    employmentStatus?: string;
    notes?: string[];                 // Free-text notes the citizen wants remembered

    // Agent interaction preferences
    agentPreferences?: {
      verbosity: 'brief' | 'normal' | 'detailed';
      confirmBeforeActing: boolean;
      showEvidenceTrail: boolean;
    };
  };

  // Metadata
  dataPrivacy: {
    consentRecords: ConsentRecord[];  // Every time data was shared
    dataRetentionPolicy: 'session-only' | 'on-device-persistent';
  };
}

interface HouseholdMember {
  relationship: string;    // "partner", "child", "parent"
  name?: string;
  dateOfBirth?: string;
  // NO government identifiers stored here — those stay in Wallet
}

interface ConsentRecord {
  id: string;
  timestamp: string;
  dataShared: string[];         // Which fields were shared
  sharedWith: string;           // Which service/capability
  purpose: string;              // Why it was shared
  duration: 'session' | 'until-revoked';
  revoked: boolean;
  revokedAt?: string;
}
```

### Privacy Rules (Enforced in Code)

```typescript
// packages/personal-data/data-privacy.ts

const PRIVACY_RULES = {
  // Incidental data NEVER leaves the device without explicit consent
  incidentalDataRequiresConsent: true,

  // Verified credentials require per-service, per-session consent
  credentialSharingRequiresConsent: true,

  // Data minimisation: only share what's needed for the specific capability
  enforceDataMinimisation: true,

  // Session data is destroyed when the conversation ends
  sessionDataLifetime: 'session-only',

  // The citizen can see everything that's been shared and with whom
  fullTransparency: true,

  // The citizen can revoke consent at any time
  consentIsRevocable: true,

  // No data is ever shared with third parties
  noThirdPartySharing: true,
};
```

---

## 9. Human Handoff Architecture

### When Handoff Happens

The agent escalates to a human when:

1. **Complexity exceeds capability** — the citizen's situation doesn't fit the policy rules (e.g. unusual immigration status affecting benefit eligibility)
2. **Repeated failure** — the agent has tried multiple approaches and none have worked
3. **Citizen requests it** — "I want to speak to a person"
4. **Safeguarding concern** — the agent detects the citizen may be vulnerable or distressed
5. **Dispute or complaint** — the citizen disagrees with a decision
6. **Technical failure** — a service is down or returning errors

### The Handoff Package

When handoff occurs, the system generates a structured package that a call centre agent would receive:

```typescript
// In packages/schemas/handoff-package.schema.json

interface HandoffPackage {
  id: string;
  createdAt: string;
  urgency: 'routine' | 'priority' | 'urgent' | 'safeguarding';

  // Who is being handed off
  citizen: {
    name: string;                // From One Login identity
    contactDetails: {
      preferredChannel: string;
      phone?: string;
      email?: string;
    };
    // ONLY include verified identity info, not incidental data
    // Call centre agent should ask the citizen directly for anything else
  };

  // Why the handoff is happening
  reason: {
    category: HandoffReason;
    description: string;         // Human-readable explanation
    agentAssessment: string;     // What the agent thinks the issue is
  };

  // What's been done so far
  conversationSummary: {
    serviceAttempted: string;     // e.g. "Renew driving licence"
    stepsCompleted: string[];     // What the agent successfully did
    stepsBlocked: string[];      // What couldn't be completed and why
    dataCollected: string[];     // What information has been gathered (not the data itself)
    timeSpent: string;           // Duration of conversation
  };

  // The evidence trail
  traceId: string;               // Links to the full trace in the Evidence Plane
  receiptIds: string[];           // Receipts generated during the conversation

  // Suggested next steps for the human agent
  suggestedActions: string[];

  // Routing information
  routing: {
    department: string;           // e.g. "DVLA"
    serviceArea: string;          // e.g. "Licence renewals"
    suggestedQueue: string;       // e.g. "complex-cases"
    referenceNumber?: string;     // If one was generated
  };
}

type HandoffReason =
  | 'complexity-exceeded'
  | 'repeated-failure'
  | 'citizen-requested'
  | 'safeguarding-concern'
  | 'dispute-or-complaint'
  | 'technical-failure'
  | 'policy-edge-case';
```

### Handoff UX

In the Citizen Experience, handoff looks like:

1. The agent explains clearly why it can't continue: "I've hit a situation I'm not equipped to handle properly — your case involves [specific complexity]."
2. It summarises what's been done: "Here's what we've covered so far..."
3. It offers the handoff: "I can connect you with someone at [department] who can help. They'll have a summary of our conversation so you won't need to repeat everything."
4. If the citizen agrees, a handoff package is generated and a reference number is displayed
5. The citizen is given the phone number, opening hours, and reference number
6. The conversation ends gracefully with clear next steps

---

## 10. Legibility Artefacts (Full Specifications)

### 10.1 Capability Manifest

```json
{
  "$schema": "./capability-manifest.schema.json",
  "id": "dvla.renew-driving-licence",
  "version": "1.0.0",
  "name": "Renew Driving Licence",
  "description": "Renew a full UK driving licence (photocard)",
  "department": "DVLA",
  "jurisdiction": "England, Wales, Scotland",

  "input_schema": {
    "type": "object",
    "properties": {
      "driving_licence_number": { "type": "string" },
      "national_insurance_number": { "type": "string" },
      "addresses_last_3_years": { "type": "array" },
      "photo": { "type": "string", "format": "uri" }
    },
    "required": ["driving_licence_number"]
  },

  "output_schema": {
    "type": "object",
    "properties": {
      "application_reference": { "type": "string" },
      "expected_delivery_date": { "type": "string", "format": "date" },
      "fee_charged": { "type": "number" }
    }
  },

  "constraints": {
    "sla": "10 working days",
    "fee": { "amount": 14, "currency": "GBP" },
    "availability": "24/7 online"
  },

  "eligibility_ruleset_id": "dvla.renew-licence.eligibility",
  "consent_requirements": ["identity-verification", "photo-sharing", "address-confirmation"],
  "evidence_requirements": ["driving-licence-credential", "identity-verified"],

  "redress": {
    "complaint_url": "https://www.gov.uk/complain-about-dvla",
    "appeal_process": "Contact DVLA directly",
    "ombudsman": "Parliamentary and Health Service Ombudsman"
  },

  "audit_requirements": {
    "retention_period": "7 years",
    "data_controller": "DVLA",
    "lawful_basis": "Public task"
  },

  "handoff": {
    "escalation_phone": "0300 790 6801",
    "opening_hours": "Mon-Fri 8am-7pm, Sat 8am-2pm",
    "department_queue": "licence-renewals"
  }
}
```

### 10.2 Policy DSL

Simple, declarative, not a programming language:

```json
{
  "id": "dvla.renew-licence.eligibility",
  "version": "1.0.0",
  "rules": [
    {
      "id": "age-check",
      "description": "Applicant must be at least 16",
      "condition": {
        "field": "citizen.age",
        "operator": ">=",
        "value": 16
      },
      "reason_if_failed": "You must be at least 16 to hold a driving licence",
      "evidence_source": "identity-verification"
    },
    {
      "id": "licence-exists",
      "description": "Applicant must already hold a UK driving licence",
      "condition": {
        "field": "credentials.driving-licence",
        "operator": "exists"
      },
      "reason_if_failed": "This service is for renewing an existing licence. To apply for your first licence, you need a different service.",
      "alternative_service": "dvla.apply-provisional-licence"
    },
    {
      "id": "not-revoked",
      "description": "Licence must not be currently revoked",
      "condition": {
        "field": "credentials.driving-licence.status",
        "operator": "!=",
        "value": "revoked"
      },
      "reason_if_failed": "Your licence has been revoked. You need to contact DVLA directly.",
      "triggers_handoff": true
    }
  ],
  "explanation_template": "To renew your driving licence, you need to: {{list_requirements}}. You {{eligibility_result}} eligible because {{reasons}}.",
  "edge_cases": [
    {
      "id": "medical-condition",
      "description": "If the applicant has a notifiable medical condition, additional steps are required",
      "detection": "self-declared or flagged in licence record",
      "action": "route to medical fitness assessment"
    }
  ]
}
```

### 10.3 State Model

```json
{
  "id": "dvla.renew-licence.states",
  "version": "1.0.0",
  "states": [
    { "id": "not-started", "type": "initial" },
    { "id": "identity-verified", "receipt": true },
    { "id": "eligibility-checked", "receipt": true },
    { "id": "data-collected" },
    { "id": "consent-granted", "receipt": true },
    { "id": "application-submitted", "receipt": true },
    { "id": "payment-completed", "receipt": true },
    { "id": "completed", "type": "terminal", "receipt": true },
    { "id": "handed-off", "type": "terminal", "receipt": true },
    { "id": "failed", "type": "terminal", "receipt": true }
  ],
  "transitions": [
    { "from": "not-started", "to": "identity-verified", "trigger": "one-login-auth-complete" },
    { "from": "identity-verified", "to": "eligibility-checked", "trigger": "policy-evaluation-complete" },
    { "from": "eligibility-checked", "to": "data-collected", "condition": "eligible == true" },
    { "from": "eligibility-checked", "to": "handed-off", "condition": "eligible == false && edge_case == true" },
    { "from": "eligibility-checked", "to": "failed", "condition": "eligible == false && edge_case == false" },
    { "from": "data-collected", "to": "consent-granted", "trigger": "consent-confirmed" },
    { "from": "consent-granted", "to": "application-submitted", "trigger": "service-invoked" },
    { "from": "application-submitted", "to": "payment-completed", "trigger": "payment-confirmed" },
    { "from": "payment-completed", "to": "completed", "trigger": "confirmation-received" },
    { "from": "*", "to": "handed-off", "trigger": "escalation-requested" }
  ]
}
```

### 10.4 Consent Model

```json
{
  "id": "dvla.renew-licence.consent",
  "version": "1.0.0",
  "grants": [
    {
      "id": "identity-verification",
      "description": "Share your verified identity (name, date of birth, address) with DVLA to process your licence renewal",
      "data_shared": ["name", "date_of_birth", "address"],
      "source": "one-login",
      "purpose": "Licence renewal application",
      "duration": "session",
      "required": true
    },
    {
      "id": "driving-licence-credential",
      "description": "Share your current driving licence details from your Wallet with DVLA",
      "data_shared": ["licence_number", "categories", "expiry_date", "photo"],
      "source": "wallet",
      "purpose": "Verify existing licence for renewal",
      "duration": "session",
      "required": true
    },
    {
      "id": "address-confirmation",
      "description": "Confirm your current address for the new licence",
      "data_shared": ["current_address"],
      "source": "citizen-declared",
      "purpose": "Print address on new licence",
      "duration": "session",
      "required": true
    }
  ],
  "revocation": {
    "mechanism": "citizen can withdraw at any point before submission",
    "effect": "application cancelled, no data retained"
  },
  "delegation": {
    "agent_identity": "agentic-legibility-stack/citizen-agent",
    "scopes": ["read-credential", "submit-application", "make-payment"],
    "limitations": "Agent cannot modify credential data or access credentials the citizen has not explicitly shared"
  }
}
```

### 10.5 Trace Events

```typescript
interface TraceEvent {
  id: string;
  traceId: string;          // Groups all events in one conversation
  spanId: string;           // Groups events within one operation
  parentSpanId?: string;
  timestamp: string;
  type: TraceEventType;
  payload: Record<string, unknown>;
  metadata: {
    userId: string;          // Pseudonymised
    sessionId: string;
    capabilityId?: string;
  };
}

type TraceEventType =
  | 'llm.request'
  | 'llm.response'
  | 'plan.created'
  | 'plan.step.started'
  | 'plan.step.completed'
  | 'capability.invoked'
  | 'capability.result'
  | 'policy.evaluated'
  | 'consent.requested'
  | 'consent.granted'
  | 'consent.denied'
  | 'consent.revoked'
  | 'credential.requested'
  | 'credential.presented'
  | 'receipt.issued'
  | 'state.transition'
  | 'handoff.initiated'
  | 'handoff.package.created'
  | 'error.raised'
  | 'redress.offered';
```

---

## 11. Demo Services

### Why These Three

| Service | Why It's a Good Demo |
|---------|---------------------|
| **Renew Driving Licence** | Directly connects to GOV.UK Wallet (driving licence is the next credential going into Wallet). Clear eligibility rules. Payment involved. Strong handoff scenarios (medical conditions, endorsements). |
| **Apply for Universal Credit** | The most complex eligibility scenario in UK government. Tests the policy DSL thoroughly. Multiple household members involved (tests personal data model). High stakes for citizens. Strong safeguarding handoff needs. |
| **Check State Pension Forecast** | Read-only service (no application, no payment). Good contrast with the others. Tests credential sharing without modification. Simple but meaningful. Shows the system handles information requests, not just transactions. |

### Scraping & Gap Analysis

For each service, we will:

1. Pull content from the GOV.UK Content API for the relevant pages
2. Extract candidate: inputs, eligibility prose, required evidence, redress pathways, steps
3. Generate draft artefacts (manifests, policy rules, state models)
4. Label each field as:
   - **Observed** — clearly stated on GOV.UK
   - **Inferred** — implied but not explicitly stated
   - **Missing** — not available from public content

The system must make incompleteness explicit. If a field cannot be populated from GOV.UK content, it is marked as a gap. This gap analysis is itself a valuable output — it shows what government would need to publish to make services truly agent-usable.

---

## 12. Evidence Plane — Design Decision

The Evidence Plane is a **shared data layer and UI component**, not a standalone app.

### Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│  Citizen Experience  │     │  Legibility Studio   │
│                      │     │                      │
│  ┌────────────────┐  │     │  ┌────────────────┐  │
│  │ Evidence Panel  │  │     │  │ Evidence Panel  │  │
│  │ (My receipts,  │  │     │  │ (All traces,   │  │
│  │  my activity,  │  │     │  │  all receipts, │  │
│  │  my consent    │  │     │  │  performance,  │  │
│  │  history)      │  │     │  │  audit export, │  │
│  └────────────────┘  │     │  │  replay,       │  │
│                      │     │  │  gap analysis)  │  │
└──────────┬───────────┘     │  └────────────────┘  │
           │                 └──────────┬───────────┘
           │                            │
           └──────────┬─────────────────┘
                      │
              ┌───────▼───────┐
              │   Evidence    │
              │   Package     │
              │  (SQLite DB)  │
              │               │
              │  • Traces     │
              │  • Receipts   │
              │  • Consent    │
              │  • Metrics    │
              │               │
              │  Append-only  │
              │  No edits     │
              │  No deletes   │
              └───────────────┘
```

### What Each App Sees

**Citizen Experience** shows the citizen:
- Their own receipts ("Here's proof that you applied for X on Y date")
- Their consent history ("You shared your driving licence with DVLA on Z date")
- A timeline of what the agent did on their behalf
- The ability to download their data

**Legibility Studio** shows the service designer/auditor:
- Full trace explorer (every event, filterable)
- Performance dashboards (how long capabilities take, failure rates)
- Failure categorisation (why things go wrong)
- Replay engine (step through a conversation event by event)
- Audit export (downloadable records for compliance)
- Gap analysis view (where artefacts are incomplete)

---

## 13. Migration Strategy

This is not a rewrite. It is a structured migration.

### Step 1: Set up new repo with Turborepo

Create `agentic-legibility-stack` repo. Set up the workspace structure. Get a blank Next.js app running in `/apps/citizen-experience`.

### Step 2: Import prototype UI

Copy the front-end from the Taskified branch into the citizen experience app. Get it rendering identically. All existing behaviour preserved.

### Step 3: Wrap tool calls with CapabilityInvoker

Introduce `CapabilityInvoker` as a wrapper around existing tool calls. At this point, it's a pass-through — it just logs and delegates. No behaviour change.

### Step 4: Introduce ServiceRegistry

Create a static JSON registry of available capabilities. The agent looks up capabilities here instead of having hardcoded references.

### Step 5: Emit trace events everywhere

Add trace emission to every significant operation. Build the SQLite trace store. At this point, you can see what the agent is doing.

### Step 6: Move JSON configs into formal manifests

Take the existing JSON configurations from `/data` and restructure them as capability manifests, policy rulesets, and state models.

### Step 7: Add Identity layer

Introduce the One Login simulator and Wallet simulator. Wire them into the capability invocation flow.

### Step 8: Add Personal Data layer

Implement the two-tier personal data model. Add the consent ledger.

### Step 9: Add Handoff Manager

Implement the handoff package generation and the handoff UX in the citizen experience.

### Step 10: Build Legibility Studio

Create the authoring tool as a parallel app. Manifest editor, policy editor, state model editor, gap analysis view.

### Step 11: Wire up Evidence Plane UI

Add the evidence panel to both apps. Receipt viewer in citizen experience. Full trace explorer in Legibility Studio.

### Step 12: Gradually remove direct wiring

As each capability is formally defined, remove any remaining direct references. Everything goes through the invoker.

---

## 14. Non-Goals

- **Not a production government system** — this is a demonstrator
- **Not replacing GOV.UK** — this shows what sits alongside/beneath it
- **Not a full policy engine** — the policy DSL is intentionally simple
- **Not cryptographic-grade receipts** — these are stubbed (but structurally correct)
- **Not an identity provider** — we simulate One Login, not replace it
- **Not a real secure enclave** — on-device storage is simulated
- **Not a real call centre integration** — handoff packages are generated but not routed

---

## 15. Success Criteria

We succeed if:

1. The citizen experience remains compelling and feels like talking to a helpful government agent
2. Every capability is discoverable via its manifest
3. Policy is structured, readable, and testable
4. Consent is explicit — the citizen always knows what data is being shared and why
5. Every invocation produces a receipt the citizen can see
6. Traces are replayable — you can step through any conversation
7. Gaps between GOV.UK web content and agent-usability are visible
8. The personal data split (verified vs incidental) is architecturally clear
9. Human handoff produces a useful, structured package
10. One Login and Wallet integration points are clearly marked and swappable
11. New features and new services can still be added quickly
12. Any developer familiar with Next.js and TypeScript can understand the codebase

---

## 16. What This Proves

This project demonstrates:

- How government services become agent-usable (via capability manifests)
- How policy becomes inspectable (via the policy DSL)
- How delegation becomes safe (via the consent model)
- How accountability is preserved (via the evidence plane)
- How identity works in an agentic context (via One Login + Wallet)
- How personal data stays under citizen control (via the two-tier model)
- How humans stay in the loop (via structured handoff)
- How experience runs on infrastructure (not the other way around)

**Agent Infrastructure > Agent Products.**

---

## Appendix A: Key GOV.UK References

| Resource | URL | Purpose |
|----------|-----|---------|
| GOV.UK One Login Docs | https://docs.sign-in.service.gov.uk/ | OIDC integration reference |
| GOV.UK Wallet Docs | https://docs.wallet.service.gov.uk/ | Credential issuance/verification reference |
| GOV.UK Wallet Guidance | https://www.gov.uk/guidance/using-govuk-wallet-in-government | Policy and principles |
| GOV.UK Wallet Public | https://www.gov.uk/wallet | Citizen-facing description |
| GOV.UK Content API | https://content-api.publishing.service.gov.uk | For scraping service content |
| GDS Way - Languages | https://gds-way.digital.cabinet-office.gov.uk/standards/programming-languages.html | Tech stack validation |
| GOV.UK Design System | https://design-system.service.gov.uk/ | UI patterns and components |
| Source Prototype | https://github.com/Data-Downs/gov-agent-simulator (branch: Taskified) | Existing codebase |

---

## Appendix B: Test Users for Simulation

```json
[
  {
    "id": "test-citizen-01",
    "name": "Sarah Chen",
    "dateOfBirth": "1988-03-15",
    "scenario": "straightforward-renewal",
    "walletCredentials": ["driving-licence"],
    "incidentalData": {
      "preferredName": "Sarah",
      "householdMembers": [
        { "relationship": "partner", "name": "James" },
        { "relationship": "child", "name": "Lily", "dateOfBirth": "2019-06-01" }
      ]
    }
  },
  {
    "id": "test-citizen-02",
    "name": "Mohammed Al-Rashid",
    "dateOfBirth": "1975-11-22",
    "scenario": "complex-uc-application",
    "walletCredentials": [],
    "incidentalData": {
      "preferredName": "Mo",
      "employmentStatus": "recently-redundant",
      "housingStatus": "private-rental",
      "householdMembers": [
        { "relationship": "partner", "name": "Fatima" },
        { "relationship": "child", "name": "Amir", "dateOfBirth": "2015-09-10" },
        { "relationship": "child", "name": "Noor", "dateOfBirth": "2018-01-30" }
      ]
    }
  },
  {
    "id": "test-citizen-03",
    "name": "Margaret Thompson",
    "dateOfBirth": "1957-07-08",
    "scenario": "pension-check",
    "walletCredentials": ["veteran-card"],
    "incidentalData": {
      "preferredName": "Maggie",
      "communicationPreferences": {
        "preferredChannel": "phone",
        "accessibilityNeeds": ["large-text"]
      }
    }
  },
  {
    "id": "test-citizen-04",
    "name": "David Evans",
    "dateOfBirth": "1992-12-01",
    "scenario": "medical-condition-edge-case",
    "walletCredentials": ["driving-licence"],
    "incidentalData": {
      "notes": ["Has epilepsy — needs medical fitness assessment for licence renewal"]
    }
  }
]
```

---

*This document is the complete brief for Claude Code. Begin with Step 1 of the Migration Strategy.*
