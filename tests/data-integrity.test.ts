import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const SERVICES_DIR = path.join(ROOT, "data/services");
const SIMULATED_DIR = path.join(ROOT, "data/simulated");
const USERS_DIR = path.join(SIMULATED_DIR, "users");

const REQUIRED_ARTEFACTS = [
  "manifest.json",
  "policy.json",
  "state-model.json",
  "consent.json",
];

const SERVICE_DIRS = fs.readdirSync(SERVICES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

// ── Service artefact completeness ──

describe("Data integrity — services", () => {
  it("data/services/ exists and has services", () => {
    expect(fs.existsSync(SERVICES_DIR)).toBe(true);
    expect(SERVICE_DIRS.length).toBeGreaterThanOrEqual(4);
  });

  for (const svc of SERVICE_DIRS) {
    describe(`Service: ${svc}`, () => {
      for (const artefact of REQUIRED_ARTEFACTS) {
        it(`has ${artefact}`, () => {
          const filePath = path.join(SERVICES_DIR, svc, artefact);
          expect(fs.existsSync(filePath)).toBe(true);
        });
      }

      it("manifest.json is valid JSON with required fields", () => {
        const raw = fs.readFileSync(path.join(SERVICES_DIR, svc, "manifest.json"), "utf-8");
        const manifest = JSON.parse(raw);
        expect(manifest.id).toBeTruthy();
        expect(typeof manifest.id).toBe("string");
        expect(manifest.name).toBeTruthy();
        expect(typeof manifest.name).toBe("string");
        expect(manifest.version).toBeTruthy();
        expect(manifest.department).toBeTruthy();
      });

      it("policy.json is valid JSON with rules array", () => {
        const raw = fs.readFileSync(path.join(SERVICES_DIR, svc, "policy.json"), "utf-8");
        const policy = JSON.parse(raw);
        expect(typeof policy.id).toBe("string");
        expect(Array.isArray(policy.rules)).toBe(true);
        expect(policy.rules.length).toBeGreaterThan(0);

        for (const rule of policy.rules) {
          expect(rule.id).toBeTruthy();
          expect(rule.condition).toBeDefined();
          expect(rule.condition.field).toBeTruthy();
          expect(rule.condition.operator).toBeTruthy();
        }
      });

      it("state-model.json has states and transitions", () => {
        const raw = fs.readFileSync(path.join(SERVICES_DIR, svc, "state-model.json"), "utf-8");
        const model = JSON.parse(raw);
        expect(Array.isArray(model.states)).toBe(true);
        expect(model.states.length).toBeGreaterThan(0);
        expect(Array.isArray(model.transitions)).toBe(true);
        expect(model.transitions.length).toBeGreaterThan(0);

        // Must have initial and terminal states
        const hasInitial = model.states.some((s: { type?: string }) => s.type === "initial");
        const hasTerminal = model.states.some((s: { type?: string }) => s.type === "terminal");
        expect(hasInitial).toBe(true);
        expect(hasTerminal).toBe(true);

        // All transitions reference valid states
        const stateIds = new Set(model.states.map((s: { id: string }) => s.id));
        for (const t of model.transitions) {
          expect(stateIds.has(t.from)).toBe(true);
          expect(stateIds.has(t.to)).toBe(true);
        }
      });

      it("consent.json has grants array", () => {
        const raw = fs.readFileSync(path.join(SERVICES_DIR, svc, "consent.json"), "utf-8");
        const consent = JSON.parse(raw);
        expect(typeof consent.id).toBe("string");
        expect(Array.isArray(consent.grants)).toBe(true);
        expect(consent.grants.length).toBeGreaterThan(0);

        for (const grant of consent.grants) {
          expect(grant.id).toBeTruthy();
          expect(grant.description).toBeTruthy();
          expect(Array.isArray(grant.data_shared)).toBe(true);
        }
      });
    });
  }
});

// ── Persona validation ──

describe("Data integrity — simulated personas", () => {
  it("data/simulated/users/ exists and has persona files", () => {
    expect(fs.existsSync(USERS_DIR)).toBe(true);
    const files = fs.readdirSync(USERS_DIR).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(1);
  });

  const personaFiles = fs.existsSync(USERS_DIR)
    ? fs.readdirSync(USERS_DIR).filter((f) => f.endsWith(".json"))
    : [];

  for (const file of personaFiles) {
    describe(`Persona: ${file}`, () => {
      it("is valid JSON", () => {
        const raw = fs.readFileSync(path.join(USERS_DIR, file), "utf-8");
        expect(() => JSON.parse(raw)).not.toThrow();
      });

      it("has required identity fields", () => {
        const persona = JSON.parse(
          fs.readFileSync(path.join(USERS_DIR, file), "utf-8")
        );
        expect(persona.id).toBeTruthy();
        expect(persona.name).toBeTruthy();
        expect(persona.date_of_birth).toBeTruthy();
        expect(persona.national_insurance_number).toBeTruthy();
      });

      it("has address with required fields", () => {
        const persona = JSON.parse(
          fs.readFileSync(path.join(USERS_DIR, file), "utf-8")
        );
        expect(persona.address).toBeDefined();
        expect(persona.address.line_1).toBeTruthy();
        expect(persona.address.city).toBeTruthy();
        expect(persona.address.postcode).toBeTruthy();
      });

      it("has credentials array", () => {
        const persona = JSON.parse(
          fs.readFileSync(path.join(USERS_DIR, file), "utf-8")
        );
        expect(Array.isArray(persona.credentials)).toBe(true);
        for (const cred of persona.credentials) {
          expect(cred.type).toBeTruthy();
          expect(cred.issuer).toBeTruthy();
          expect(["valid", "expired", "revoked", "suspended"]).toContain(cred.status);
        }
      });
    });
  }
});

// ── Cross-reference validation ──

describe("Data integrity — cross-references", () => {
  it("wallet-credentials.json exists", () => {
    const walletPath = path.join(SIMULATED_DIR, "wallet-credentials.json");
    expect(fs.existsSync(walletPath)).toBe(true);
  });

  it("wallet credential types are valid JSON", () => {
    const raw = fs.readFileSync(
      path.join(SIMULATED_DIR, "wallet-credentials.json"),
      "utf-8"
    );
    const data = JSON.parse(raw);
    expect(data.credential_types).toBeDefined();
    expect(Array.isArray(data.credential_types)).toBe(true);
    for (const ct of data.credential_types) {
      expect(ct.type).toBeTruthy();
      expect(ct.issuer).toBeTruthy();
    }
  });

  it("manifest eligibility_ruleset_id matches policy id", () => {
    for (const svc of SERVICE_DIRS) {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(SERVICES_DIR, svc, "manifest.json"), "utf-8")
      );
      if (manifest.eligibility_ruleset_id) {
        const policy = JSON.parse(
          fs.readFileSync(path.join(SERVICES_DIR, svc, "policy.json"), "utf-8")
        );
        expect(policy.id).toBe(manifest.eligibility_ruleset_id);
      }
    }
  });

  it("state-model transition states all exist in states array", () => {
    for (const svc of SERVICE_DIRS) {
      const model = JSON.parse(
        fs.readFileSync(path.join(SERVICES_DIR, svc, "state-model.json"), "utf-8")
      );
      const stateIds = new Set(model.states.map((s: { id: string }) => s.id));
      for (const t of model.transitions) {
        expect(stateIds.has(t.from)).toBe(true);
        expect(stateIds.has(t.to)).toBe(true);
      }
    }
  });
});
