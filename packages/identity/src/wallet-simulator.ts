/**
 * WalletSimulator — Simulates a digital identity wallet
 *
 * The wallet holds credentials (driving licence, NI number, etc.)
 * and can present them when a service requests verification.
 * In production, this would be a real wallet SDK.
 */

import type { TestUser, WalletCredential, CredentialPresentation } from "./credential-types";

export class WalletSimulator {
  private credentials = new Map<string, WalletCredential[]>();

  /** Load credentials for a user */
  loadCredentials(userId: string, credentials: WalletCredential[]): void {
    this.credentials.set(userId, credentials);
  }

  /** Get all credentials for a user */
  getCredentials(userId: string): WalletCredential[] {
    return this.credentials.get(userId) || [];
  }

  /** Request a presentation of a specific credential type */
  requestPresentation(
    userId: string,
    credentialType: string
  ): { available: boolean; credential?: WalletCredential } {
    const userCredentials = this.credentials.get(userId) || [];
    const credential = userCredentials.find((c) => c.type === credentialType);

    if (!credential) {
      return { available: false };
    }

    return { available: true, credential };
  }

  /** Present a credential (returns structured claims for verification) */
  presentCredential(
    userId: string,
    credentialType: string
  ): CredentialPresentation | null {
    const { available, credential } = this.requestPresentation(userId, credentialType);
    if (!available || !credential) return null;

    return {
      credentialType: credential.type,
      issuer: credential.issuer,
      claims: {
        number: credential.number,
        status: credential.status,
        issued: credential.issued,
        expires: credential.expires,
        ...credential.claims,
      },
      presentedAt: new Date().toISOString(),
      verificationLevel: credential.status === "valid" ? "high" : "low",
    };
  }

  /** Check the status of a credential */
  checkStatus(
    userId: string,
    credentialType: string
  ): { exists: boolean; status?: string; expired?: boolean } {
    const { available, credential } = this.requestPresentation(userId, credentialType);
    if (!available || !credential) {
      return { exists: false };
    }

    const expired = credential.expires
      ? new Date(credential.expires) < new Date()
      : false;

    return {
      exists: true,
      status: credential.status,
      expired,
    };
  }

  /** Load credentials from a test user object */
  loadFromTestUser(user: TestUser): void {
    this.loadCredentials(user.id, user.credentials);
  }
}
