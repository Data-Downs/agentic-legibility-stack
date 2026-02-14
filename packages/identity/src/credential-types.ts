/**
 * Credential types used across the identity system
 */

export interface TestUser {
  id: string;
  name: string;
  date_of_birth: string;
  age: number;
  national_insurance_number: string;
  address: {
    line_1: string;
    line_2?: string;
    city: string;
    postcode: string;
  };
  jurisdiction: string;
  credentials: WalletCredential[];
  employment_status: string;
  employer?: string;
  self_employed?: boolean;
  income: number;
  savings: number;
  bank_account: boolean;
  over_70?: boolean;
  no_fixed_address?: boolean;
  pension_qualifying_years?: number;
  persona_mapping: string;
}

export interface WalletCredential {
  type: string;
  issuer: string;
  number?: string;
  issued?: string;
  expires?: string;
  status: "valid" | "expired" | "revoked" | "suspended";
  claims?: Record<string, unknown>;
}

export interface IdentityContext {
  authenticated: boolean;
  userId: string;
  name: string;
  verificationLevel: "none" | "low" | "medium" | "high";
  authMethod: "one-login" | "simulated";
  sessionToken?: string;
  claims: Record<string, unknown>;
}

export interface CredentialPresentation {
  credentialType: string;
  issuer: string;
  claims: Record<string, unknown>;
  presentedAt: string;
  verificationLevel: "low" | "medium" | "high";
}
