/**
 * VerifiedStore — Reads Tier 1 (verified) data from wallet credentials
 *
 * This store pulls verified data from the WalletSimulator.
 * In production, verified data would come from cryptographic
 * credential presentations.
 */

import type { WalletSimulator, TestUser } from "@als/identity";
import type { VerifiedData } from "./data-model";

export class VerifiedStore {
  private wallet: WalletSimulator;

  constructor(wallet: WalletSimulator) {
    this.wallet = wallet;
  }

  /** Build a verified data profile from wallet credentials */
  getVerifiedData(userId: string, user: TestUser): VerifiedData {
    const credentials = this.wallet.getCredentials(userId);
    const hasValidCredential = credentials.some((c) => c.status === "valid");

    return {
      fullName: user.name,
      dateOfBirth: user.date_of_birth,
      nationalInsuranceNumber: user.national_insurance_number,
      address: {
        line1: user.address.line_1,
        line2: user.address.line_2,
        city: user.address.city,
        postcode: user.address.postcode,
      },
      drivingLicenceNumber: credentials.find((c) => c.type === "driving-licence")?.number,
      verificationLevel: hasValidCredential ? "high" : "medium",
      source: "wallet-simulator",
      verifiedAt: new Date().toISOString(),
    };
  }
}
