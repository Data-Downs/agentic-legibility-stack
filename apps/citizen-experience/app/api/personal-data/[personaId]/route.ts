import { NextRequest, NextResponse } from "next/server";
import { getSubmittedStore, getInferredStore, getServiceAccessStore } from "@/lib/personal-data-store";
import { getPersonaData } from "@/lib/service-data";
import { WalletSimulator } from "@als/identity";
import { VerifiedStore } from "@als/personal-data";

// Wallet/verified store for Tier 1
async function loadTestUsers(): Promise<Array<Record<string, unknown>> | null> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const base = path.join(process.cwd(), "..", "..", "data", "simulated");
    const usersRaw = await fs.readFile(path.join(base, "test-users.json"), "utf-8");
    return JSON.parse(usersRaw);
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

    // Load Tier 1 verified data from test-user credentials
    let tier1 = null;
    const testUsers = await loadTestUsers();
    if (testUsers) {
      const testUser = testUsers.find(
        (u) => u.id === personaId || u.persona_mapping === personaId
      );
      if (testUser) {
        const wallet = new WalletSimulator();
        const creds = testUser.credentials as Array<Record<string, unknown>> | undefined;
        if (creds && creds.length > 0) {
          wallet.loadCredentials(testUser.id as string, creds);
        }
        const verifiedStore = new VerifiedStore(wallet);
        tier1 = verifiedStore.getVerifiedData(testUser.id as string, testUser as never);
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
