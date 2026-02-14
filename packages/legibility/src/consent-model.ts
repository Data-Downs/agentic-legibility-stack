/**
 * ConsentManager — Manages citizen consent for data sharing
 *
 * Tracks which consent grants have been given, denied, or revoked.
 * Every consent decision is recorded for the Evidence Plane.
 */

import type { ConsentModel, ConsentGrant } from "@als/schemas";

export interface ConsentDecision {
  grantId: string;
  granted: boolean;
  timestamp: string;
  reason?: string;
}

export class ConsentManager {
  private model: ConsentModel;
  private decisions = new Map<string, ConsentDecision>();

  constructor(model: ConsentModel) {
    this.model = model;
  }

  /** Get all required consent grants */
  getRequiredGrants(): ConsentGrant[] {
    return this.model.grants.filter((g) => g.required);
  }

  /** Get all optional consent grants */
  getOptionalGrants(): ConsentGrant[] {
    return this.model.grants.filter((g) => !g.required);
  }

  /** Get pending grants (not yet decided) */
  getPendingGrants(): ConsentGrant[] {
    return this.model.grants.filter((g) => !this.decisions.has(g.id));
  }

  /** Record a consent decision */
  recordDecision(grantId: string, granted: boolean, reason?: string): ConsentDecision {
    const decision: ConsentDecision = {
      grantId,
      granted,
      timestamp: new Date().toISOString(),
      reason,
    };
    this.decisions.set(grantId, decision);
    return decision;
  }

  /** Check if a specific grant has been given */
  hasConsent(grantId: string): boolean {
    return this.decisions.get(grantId)?.granted === true;
  }

  /** Revoke a consent grant */
  revoke(grantId: string, reason?: string): ConsentDecision {
    return this.recordDecision(grantId, false, reason || "Revoked by citizen");
  }

  /** Check if all required consents have been granted */
  allRequiredGranted(): boolean {
    return this.getRequiredGrants().every((g) => this.hasConsent(g.id));
  }

  /** Get all decisions made so far */
  getAllDecisions(): ConsentDecision[] {
    return Array.from(this.decisions.values());
  }

  /** Get the data that would be shared for a given grant */
  getDataShared(grantId: string): string[] {
    const grant = this.model.grants.find((g) => g.id === grantId);
    return grant?.data_shared || [];
  }
}
