import { describe, it, expect, beforeEach } from "vitest";
import { VerifiedStore } from "./verified-store";
import { IncidentalStore } from "./incidental-store";
import { WalletSimulator } from "@als/identity";
import type { TestUser } from "@als/identity";

const testUser: TestUser = {
  id: "user-1",
  name: "Alice Smith",
  date_of_birth: "1990-05-20",
  age: 35,
  national_insurance_number: "QQ123456C",
  address: { line_1: "42 Test Lane", line_2: "Flat B", city: "London", postcode: "SW1A 1AA" },
  jurisdiction: "England",
  credentials: [
    { type: "driving-licence", issuer: "DVLA", number: "DL123", status: "valid" },
    { type: "national-insurance", issuer: "HMRC", number: "QQ123456C", status: "valid" },
  ],
  employment_status: "employed",
  employer: "NHS",
  income: 35000,
  savings: 8000,
  bank_account: true,
};

// ── VerifiedStore (Tier 1) ──

describe("VerifiedStore — Tier 1 verified data", () => {
  let store: VerifiedStore;
  let wallet: WalletSimulator;

  beforeEach(() => {
    wallet = new WalletSimulator();
    wallet.loadFromTestUser(testUser);
    store = new VerifiedStore(wallet);
  });

  it("returns verified data from wallet credentials", () => {
    const data = store.getVerifiedData("user-1", testUser);
    expect(data.fullName).toBe("Alice Smith");
    expect(data.dateOfBirth).toBe("1990-05-20");
    expect(data.nationalInsuranceNumber).toBe("QQ123456C");
    expect(data.address).toEqual({
      line1: "42 Test Lane",
      line2: "Flat B",
      city: "London",
      postcode: "SW1A 1AA",
    });
    expect(data.source).toBe("wallet-simulator");
    expect(data.verifiedAt).toBeTruthy();
  });

  it("sets high verification when valid credentials exist", () => {
    const data = store.getVerifiedData("user-1", testUser);
    expect(data.verificationLevel).toBe("high");
  });

  it("sets medium verification when no valid credentials", () => {
    const noValidUser: TestUser = {
      ...testUser,
      id: "user-2",
      credentials: [{ type: "expired-card", issuer: "Test", status: "expired" }],
    };
    wallet.loadFromTestUser(noValidUser);
    const data = store.getVerifiedData("user-2", noValidUser);
    expect(data.verificationLevel).toBe("medium");
  });

  it("includes driving licence number when available", () => {
    const data = store.getVerifiedData("user-1", testUser);
    expect(data.drivingLicenceNumber).toBe("DL123");
  });

  it("verified data is read-only after creation (immutable shape)", () => {
    const data = store.getVerifiedData("user-1", testUser);
    // Each call produces a fresh object — no mutation risk
    const data2 = store.getVerifiedData("user-1", testUser);
    expect(data).toEqual(data2);
    expect(data).not.toBe(data2); // different object references
  });
});

// ── IncidentalStore (Tier 2 — conversation data) ──

describe("IncidentalStore — Tier 2 incidental data", () => {
  let store: IncidentalStore;

  beforeEach(() => {
    store = new IncidentalStore();
  });

  it("stores and retrieves incidental data", () => {
    store.recordFromConversation("user-1", "children_count", 2, "sess-1");
    const field = store.getField("user-1", "children_count");
    expect(field).toBeDefined();
    expect(field!.value).toBe(2);
    expect(field!.source).toBe("conversation");
    expect(field!.confidence).toBe("stated");
  });

  it("getAll returns all fields for a user", () => {
    store.recordFromConversation("user-1", "children", 2, "sess-1");
    store.recordFromConversation("user-1", "employed", true, "sess-1");
    const all = store.getAll("user-1");
    expect(all.fields.size).toBe(2);
  });

  it("returns empty data for unknown user", () => {
    const all = store.getAll("unknown");
    expect(all.fields.size).toBe(0);
  });

  it("can add data from conversation (Tier 2 enrichment)", () => {
    const field = store.recordFromConversation("user-1", "preferred_language", "Welsh", "sess-1", "stated");
    expect(field.key).toBe("preferred_language");
    expect(field.value).toBe("Welsh");
    expect(field.confidence).toBe("stated");
    expect(field.collectedAt).toBeTruthy();
    expect(field.sessionId).toBe("sess-1");
  });

  it("removeField deletes specific incidental data", () => {
    store.recordFromConversation("user-1", "temp-data", "value", "sess-1");
    expect(store.getField("user-1", "temp-data")).toBeDefined();
    const removed = store.removeField("user-1", "temp-data");
    expect(removed).toBe(true);
    expect(store.getField("user-1", "temp-data")).toBeUndefined();
  });

  it("removeField returns false for non-existent field", () => {
    expect(store.removeField("user-1", "nonexistent")).toBe(false);
  });

  it("clearAll removes all data for a user", () => {
    store.recordFromConversation("user-1", "a", 1, "s");
    store.recordFromConversation("user-1", "b", 2, "s");
    expect(store.fieldCount("user-1")).toBe(2);
    store.clearAll("user-1");
    expect(store.fieldCount("user-1")).toBe(0);
  });

  it("data is separated between users", () => {
    store.recordFromConversation("user-1", "field-a", "val-1", "sess-1");
    store.recordFromConversation("user-2", "field-b", "val-2", "sess-2");
    expect(store.getField("user-1", "field-a")?.value).toBe("val-1");
    expect(store.getField("user-1", "field-b")).toBeUndefined();
    expect(store.getField("user-2", "field-b")?.value).toBe("val-2");
    expect(store.getField("user-2", "field-a")).toBeUndefined();
  });

  it("fieldCount returns correct count", () => {
    expect(store.fieldCount("user-1")).toBe(0);
    store.recordFromConversation("user-1", "a", 1, "s");
    expect(store.fieldCount("user-1")).toBe(1);
  });
});

// ── Tier separation enforcement ──

describe("Tier separation", () => {
  it("Tier 1 data comes from wallet — not settable externally", () => {
    // VerifiedStore has no set/write methods — only getVerifiedData
    const store = new VerifiedStore(new WalletSimulator());
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(store));
    const writeMethods = methods.filter(
      (m) => m.startsWith("set") || m.startsWith("write") || m.startsWith("update") || m.startsWith("store")
    );
    expect(writeMethods).toEqual([]);
  });

  it("Tier 2 data can be added from conversations but not modify Tier 1", () => {
    // IncidentalStore only manages its own tier
    const iStore = new IncidentalStore();
    iStore.recordFromConversation("user-1", "some-field", "value", "sess-1");
    // The incidental store doesn't touch verified data
    expect(iStore.getField("user-1", "fullName")).toBeUndefined();
  });
});
