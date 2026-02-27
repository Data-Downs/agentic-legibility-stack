/**
 * Types for the service store — DB-backed service artefact storage.
 */

import type { CapabilityManifest, PolicyRuleset, StateModelDefinition, ConsentModel, StateCardMapping } from "@als/schemas";

/** A row in the services table */
export interface ServiceRow {
  id: string;
  name: string;
  department: string;
  department_key: string;
  description: string;
  source: "full" | "graph";
  service_type: string | null;
  govuk_url: string | null;
  eligibility_summary: string | null;
  promoted: number; // SQLite boolean
  proactive: number; // SQLite boolean
  gated: number; // SQLite boolean
  manifest_json: string;
  policy_json: string | null;
  state_model_json: string | null;
  consent_json: string | null;
  card_definitions_json: string | null;
  generated_at: string | null;
  interaction_type: string | null;
  created_at: string;
  updated_at: string;
}

/** An edge row in the edges table */
export interface EdgeRow {
  id: number;
  from_service_id: string;
  to_service_id: string;
  edge_type: "REQUIRES" | "ENABLES";
}

/** A life event row */
export interface LifeEventRow {
  id: string;
  name: string;
  icon: string;
  description: string;
}

/** Maps a life event to its entry-node services */
export interface LifeEventServiceRow {
  life_event_id: string;
  service_id: string;
}

/** Filtering options for listServices() */
export interface ServiceFilter {
  department?: string;
  source?: "full" | "graph";
  promoted?: boolean;
  search?: string;
  serviceType?: string;
}

/** Full service with parsed artefacts */
export interface ServiceWithArtefacts {
  id: string;
  name: string;
  department: string;
  departmentKey: string;
  description: string;
  source: "full" | "graph";
  serviceType: string | null;
  govukUrl: string | null;
  eligibilitySummary: string | null;
  promoted: boolean;
  proactive: boolean;
  gated: boolean;
  manifest: CapabilityManifest;
  policy: PolicyRuleset | null;
  stateModel: StateModelDefinition | null;
  consent: ConsentModel | null;
  cardDefinitions: StateCardMapping[] | null;
  generatedAt: string | null;
  interactionType: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Summary for list views (no full JSON artefacts) */
export interface ServiceSummary {
  id: string;
  name: string;
  department: string;
  departmentKey: string;
  description: string;
  source: "full" | "graph";
  serviceType: string | null;
  govukUrl: string | null;
  promoted: boolean;
  hasPolicy: boolean;
  hasStateModel: boolean;
  hasConsent: boolean;
  hasCardDefinitions: boolean;
  generatedAt: string | null;
  interactionType: string | null;
}

/** Life event with resolved service IDs */
export interface LifeEventWithServices {
  id: string;
  name: string;
  icon: string;
  description: string;
  serviceIds: string[];
}

/** Department summary */
export interface DepartmentInfo {
  key: string;
  name: string;
  serviceCount: number;
}
