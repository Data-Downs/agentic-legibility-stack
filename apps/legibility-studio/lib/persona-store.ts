/**
 * Persona store — reads persona data from D1 (Cloudflare) or filesystem (local dev).
 */

export interface WalletCredential {
  type: string;
  issuer: string;
  number?: string;
  issued?: string;
  expires?: string;
  status: "valid" | "expired" | "revoked" | "suspended";
  claims?: Record<string, unknown>;
}

export interface CredentialType {
  type: string;
  issuer: string;
  fields: string[];
  verification_level: string;
}

// ── D1 helpers ──

// Cache the D1 reference once resolved
let cachedDb: D1Database | null | undefined;

function getD1(): D1Database | null {
  if (cachedDb !== undefined) return cachedDb;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare");
    const ctx = getCloudflareContext();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cachedDb = (ctx.env as any).SERVICE_STORE_DB ?? null;
  } catch (err) {
    console.log("[persona-store] getCloudflareContext failed, using filesystem fallback:", (err as Error).message);
    cachedDb = null;
  }
  return cachedDb;
}

// ── Public API ──

export async function getAllUsers(): Promise<Record<string, unknown>[]> {
  const db = getD1();
  if (db) {
    const rows = await db.prepare("SELECT data FROM personas ORDER BY id").all<{ data: string }>();
    return rows.results.map((r) => JSON.parse(r.data));
  }
  // Local dev fallback: read from filesystem
  const fs = await import("fs/promises");
  const path = await import("path");
  const usersDir = path.join(process.cwd(), "..", "..", "data", "simulated", "users");
  const files = await fs.readdir(usersDir);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  const users: Record<string, unknown>[] = [];
  for (const file of jsonFiles) {
    const raw = await fs.readFile(path.join(usersDir, file), "utf-8");
    users.push(JSON.parse(raw));
  }
  return users;
}

export async function getUser(userId: string): Promise<Record<string, unknown> | null> {
  const db = getD1();
  if (db) {
    const row = await db.prepare("SELECT data FROM personas WHERE id = ?").bind(userId).first<{ data: string }>();
    return row ? JSON.parse(row.data) : null;
  }
  const fs = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "..", "..", "data", "simulated", "users", `${userId}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function updateUser(userId: string, data: Record<string, unknown>): Promise<void> {
  const db = getD1();
  if (db) {
    const json = JSON.stringify(data);
    await db.prepare("INSERT OR REPLACE INTO personas (id, data, updated_at) VALUES (?, ?, datetime('now'))").bind(userId, json).run();
    return;
  }
  const fs = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "..", "..", "data", "simulated", "users", `${userId}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function userExists(userId: string): Promise<boolean> {
  const db = getD1();
  if (db) {
    const row = await db.prepare("SELECT 1 FROM personas WHERE id = ?").bind(userId).first();
    return row !== null;
  }
  const fs = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "..", "..", "data", "simulated", "users", `${userId}.json`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function createUser(userId: string, data: Record<string, unknown>): Promise<void> {
  const exists = await userExists(userId);
  if (exists) {
    throw new Error(`User file "${userId}.json" already exists`);
  }
  const db = getD1();
  if (db) {
    const json = JSON.stringify(data);
    await db.prepare("INSERT INTO personas (id, data, updated_at) VALUES (?, ?, datetime('now'))").bind(userId, json).run();
    return;
  }
  const fs = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "..", "..", "data", "simulated", "users", `${userId}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function getWalletCredentialTypes(): Promise<CredentialType[]> {
  const db = getD1();
  if (db) {
    // Wallet credential types are static — embed them inline for Cloudflare
    return [
      { type: "driving-licence", issuer: "DVLA", fields: ["full_name", "date_of_birth", "address", "licence_number", "photo"], verification_level: "high" },
      { type: "passport", issuer: "HMPO", fields: ["full_name", "date_of_birth", "nationality", "passport_number", "photo"], verification_level: "high" },
      { type: "national-insurance", issuer: "HMRC", fields: ["full_name", "national_insurance_number"], verification_level: "medium" },
      { type: "birth-certificate", issuer: "GRO", fields: ["full_name", "date_of_birth", "place_of_birth", "parents"], verification_level: "high" },
    ];
  }
  const fs = await import("fs/promises");
  const path = await import("path");
  const walletPath = path.join(process.cwd(), "..", "..", "data", "simulated", "wallet-credentials.json");
  const raw = await fs.readFile(walletPath, "utf-8");
  const parsed = JSON.parse(raw);
  return parsed.credential_types as CredentialType[];
}
