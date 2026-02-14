/**
 * Singleton identity layer instances for the citizen-experience app.
 */

import { OneLoginSimulator, WalletSimulator } from "@als/identity";
import type { TestUser } from "@als/identity";
import fs from "fs/promises";
import path from "path";

let oneLogin: OneLoginSimulator | null = null;
let wallet: WalletSimulator | null = null;
let testUsers: TestUser[] | null = null;
let initPromise: Promise<void> | null = null;

async function init(): Promise<void> {
  if (testUsers) return;
  if (initPromise) { await initPromise; return; }

  initPromise = (async () => {
    const filePath = path.join(process.cwd(), "data", "simulated", "test-users.json");
    const raw = await fs.readFile(filePath, "utf-8");
    testUsers = JSON.parse(raw) as TestUser[];

    oneLogin = new OneLoginSimulator();
    oneLogin.loadTestUsers(testUsers);

    wallet = new WalletSimulator();
    for (const user of testUsers) {
      wallet.loadFromTestUser(user);
    }
  })();

  await initPromise;
}

export async function getOneLogin(): Promise<OneLoginSimulator> {
  await init();
  return oneLogin!;
}

export async function getWallet(): Promise<WalletSimulator> {
  await init();
  return wallet!;
}

export async function getTestUsers(): Promise<TestUser[]> {
  await init();
  return testUsers!;
}
