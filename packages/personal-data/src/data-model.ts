/**
 * Personal Data Model — Two-tier data architecture
 *
 * Tier 1: Verified data from digital credentials (Wallet)
 *   - Cryptographically verified, high trust
 *   - e.g. name, DOB, NI number from driving licence or One Login
 *
 * Tier 2: Incidental data from conversations
 *   - Collected during interactions, lower trust
 *   - e.g. "I mentioned I have 2 children"
 *   - Architecturally marked for on-device storage only
 */

export interface PersonalDataProfile {
  userId: string;
  tier1: VerifiedData;
  tier2: IncidentalData;
  lastUpdated: string;
}

export interface VerifiedData {
  fullName?: string;
  dateOfBirth?: string;
  nationalInsuranceNumber?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
  };
  drivingLicenceNumber?: string;
  verificationLevel: "none" | "low" | "medium" | "high";
  source: string;
  verifiedAt?: string;
}

export interface IncidentalData {
  fields: Map<string, IncidentalField>;
}

export interface IncidentalField {
  key: string;
  value: unknown;
  source: "conversation" | "form" | "inferred";
  confidence: "stated" | "inferred" | "uncertain";
  collectedAt: string;
  sessionId: string;
}

export interface HouseholdMember {
  relationship: string;
  name?: string;
  age?: number;
  dependant: boolean;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  grantId: string;
  serviceId: string;
  granted: boolean;
  dataFields: string[];
  purpose: string;
  timestamp: string;
  sessionId: string;
  revokedAt?: string;
}

// ── Three-Tier Profile ──

export interface ThreeTierProfile {
  userId: string;
  tier1: VerifiedData;
  tier2: SubmittedData;
  tier3: InferredData;
  accessMap: ServiceAccessMap;
  lastUpdated: string;
}

// Tier 2: Submitted data

export interface SubmittedField {
  id: string;
  fieldKey: string;
  fieldValue: unknown;
  category: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmittedData {
  fields: SubmittedField[];
}

// Tier 3: Inferred data

export interface InferredFact {
  id: string;
  fieldKey: string;
  fieldValue: unknown;
  confidence: string;
  source: string;
  sessionId?: string;
  extractedFrom?: string;
  mentions: number;
  supersededBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InferredData {
  facts: InferredFact[];
}

// Service Access

export interface ServiceAccessGrant {
  id: string;
  serviceId: string;
  fieldKey: string;
  dataTier: string;
  purpose?: string;
  grantedAt: string;
  revokedAt?: string;
  consentRecordId?: string;
}

export interface ServiceAccessMap {
  [serviceId: string]: ServiceAccessGrant[];
}
