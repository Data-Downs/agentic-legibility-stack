import fs from "fs/promises";
import path from "path";

const MONOREPO_ROOT = path.join(process.cwd(), "..", "..");
const USERS_DIR = path.join(MONOREPO_ROOT, "data", "simulated", "users");
const WALLET_CREDS_PATH = path.join(MONOREPO_ROOT, "data", "simulated", "wallet-credentials.json");

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

/** Read all unified user files from data/simulated/users/ */
export async function getAllUsers(): Promise<Record<string, unknown>[]> {
  const files = await fs.readdir(USERS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  const users: Record<string, unknown>[] = [];
  for (const file of jsonFiles) {
    const raw = await fs.readFile(path.join(USERS_DIR, file), "utf-8");
    users.push(JSON.parse(raw));
  }
  return users;
}

/** Read a single unified user file */
export async function getUser(userId: string): Promise<Record<string, unknown> | null> {
  const filePath = path.join(USERS_DIR, `${userId}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Write a unified user file */
export async function updateUser(userId: string, data: Record<string, unknown>): Promise<void> {
  const filePath = path.join(USERS_DIR, `${userId}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/** Check if a user file exists */
export async function userExists(userId: string): Promise<boolean> {
  const filePath = path.join(USERS_DIR, `${userId}.json`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Create a new unified user file. Throws if file already exists. */
export async function createUser(userId: string, data: Record<string, unknown>): Promise<void> {
  const filePath = path.join(USERS_DIR, `${userId}.json`);
  const exists = await userExists(userId);
  if (exists) {
    throw new Error(`User file "${userId}.json" already exists`);
  }
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export async function getWalletCredentialTypes(): Promise<CredentialType[]> {
  const raw = await fs.readFile(WALLET_CREDS_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  return parsed.credential_types as CredentialType[];
}
