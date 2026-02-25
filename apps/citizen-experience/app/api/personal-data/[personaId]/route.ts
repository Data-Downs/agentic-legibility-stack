import { NextRequest, NextResponse } from "next/server";
import { getSubmittedStore, getInferredStore, getServiceAccessStore } from "@/lib/personal-data-store";
import { getPersonaData } from "@/lib/service-data";
import { WalletSimulator } from "@als/identity";
import { VerifiedStore } from "@als/personal-data";

// Wallet/verified store for Tier 1
const testUsersPath = "data/simulated/test-users.json";
const walletCredsPath = "data/simulated/wallet-credentials.json";

async function loadWalletData() {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const usersRaw = await fs.readFile(path.join(process.cwd(), testUsersPath), "utf-8");
    const credsRaw = await fs.readFile(path.join(process.cwd(), walletCredsPath), "utf-8");
    return { users: JSON.parse(usersRaw), credentials: JSON.parse(credsRaw) };
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;

  try {
    const [submittedStore, inferredStore, accessStore] = await Promise.all([
      getSubmittedStore(),
      getInferredStore(),
      getServiceAccessStore(),
    ]);

    // Seed Tier 2 from persona data on first access
    const personaData = getPersonaData(personaId);
    if (personaData) {
      await submittedStore.seedFromPersona(personaId, personaData);
    }

    // Load Tier 1 verified data
    let tier1 = null;
    const walletData = await loadWalletData();
    if (walletData) {
      const wallet = new WalletSimulator();
      const testUser = walletData.users.find(
        (u: Record<string, unknown>) => u.persona_mapping === personaId
      );
      if (testUser) {
        // Load credentials from wallet-credentials.json for this user
        const userCreds = walletData.credentials.filter(
          (c: Record<string, unknown>) => c.userId === testUser.id || c.user_id === testUser.id
        );
        if (userCreds.length > 0) {
          wallet.loadCredentials(testUser.id, userCreds);
        } else if (testUser.credentials) {
          // Fallback: credentials embedded in test-users.json
          wallet.loadCredentials(testUser.id, testUser.credentials);
        }
        const verifiedStore = new VerifiedStore(wallet);
        tier1 = verifiedStore.getVerifiedData(testUser.id, testUser);
      }
    }

    // Load all three tiers
    const [submitted, inferred, accessMap] = await Promise.all([
      submittedStore.getAll(personaId),
      inferredStore.getAll(personaId),
      accessStore.getAccessMap(personaId),
    ]);

    return NextResponse.json({
      userId: personaId,
      tier1: tier1 || { verificationLevel: "none", source: "none" },
      tier2: { fields: submitted },
      tier3: { facts: inferred },
      accessMap,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PersonalData] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load personal data" },
      { status: 500 }
    );
  }
}
