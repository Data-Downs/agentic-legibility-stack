import { NextRequest, NextResponse } from "next/server";
import { getSubmittedStore, getInferredStore, getServiceAccessStore } from "@/lib/personal-data-store";
import { getPersonaData } from "@/lib/service-data";
import { WalletSimulator, type WalletCredential } from "@als/identity";
import { VerifiedStore } from "@als/personal-data";

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

    // Unified user data — contains both persona fields and credentials
    const personaData = getPersonaData(personaId);

    // Seed Tier 2 from persona data on first access
    if (personaData) {
      await submittedStore.seedFromPersona(personaId, personaData);
    }

    // Load Tier 1 verified data from user credentials
    let tier1 = null;
    if (personaData) {
      const wallet = new WalletSimulator();
      const creds = personaData.credentials as WalletCredential[] | undefined;
      if (creds && creds.length > 0) {
        wallet.loadCredentials(personaId, creds);
      }
      const verifiedStore = new VerifiedStore(wallet);
      tier1 = verifiedStore.getVerifiedData(personaId, personaData as never);
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
