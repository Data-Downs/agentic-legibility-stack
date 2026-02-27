/**
 * Server-side artefact loader for the Legibility Studio.
 *
 * Delegates to the DB-backed @als/service-store via the singleton
 * in service-store-init.ts. This replaces the old filesystem-based loader.
 *
 * Backward-compatible exports for existing Studio pages and routes.
 */

import {
  getServiceArtefactStore,
  getServiceGraphStore,
  invalidateServiceStore,
} from "./service-store-init";
import type { ServiceWithArtefacts, ServiceSummary } from "@als/service-store";

/** Graph service summary for Studio display */
export interface GraphServiceInfo {
  id: string;
  name: string;
  department: string;
  description: string;
  serviceType: string | null;
  govuk_url: string | null;
  eligibility_summary: string | null;
  proactive: boolean;
  gated: boolean;
}

export interface GapItem {
  field: string;
  status: "present" | "missing" | "incomplete";
  artefact: "manifest" | "policy" | "state-model" | "consent";
}

/** Resets the cached store so the next read triggers a fresh load */
export function invalidateArtefactStore(): void {
  invalidateServiceStore();
}

/** Get all services as summaries */
export async function listAllServices(): Promise<ServiceSummary[]> {
  const store = await getServiceArtefactStore();
  return store.listServices();
}

/** Get a specific service's full artefacts */
export async function getServiceArtefacts(
  serviceId: string
): Promise<ServiceWithArtefacts | undefined> {
  const store = await getServiceArtefactStore();
  return store.getService(serviceId);
}

/** List just the service IDs */
export async function listServices(): Promise<string[]> {
  const store = await getServiceArtefactStore();
  const summaries = await store.listServices();
  return summaries.map((s) => s.id);
}

/** List graph services (those without full artefacts) */
export async function listGraphServices(): Promise<GraphServiceInfo[]> {
  const store = await getServiceArtefactStore();
  const graphServices = await store.listServices({ source: "graph" });
  return graphServices.map((s) => ({
    id: s.id,
    name: s.name,
    department: s.department,
    description: s.description,
    serviceType: s.serviceType,
    govuk_url: s.govukUrl,
    eligibility_summary: null,
    proactive: false,
    gated: false,
  }));
}

/** Get life events from the graph store */
export async function listLifeEvents() {
  const graphStore = await getServiceGraphStore();
  const events = await graphStore.getLifeEvents();
  return events.map((e) => ({
    id: e.id,
    name: e.name,
    icon: e.icon,
    serviceIds: e.serviceIds,
  }));
}

/** Get unique department keys */
export async function listDepartments(): Promise<string[]> {
  const graphStore = await getServiceGraphStore();
  const depts = await graphStore.getDepartments();
  return depts.map((d) => d.key);
}

/** Gap analysis for a service (standalone, no store instance needed) */
export function analyzeGaps(service: ServiceWithArtefacts): GapItem[] {
  const store = getServiceArtefactStoreSync();
  if (store) return store.analyzeGaps(service);

  // Fallback inline analysis if store not yet initialized
  return analyzeGapsInline(service);
}

// Cached reference for sync access
let _cachedStore: import("@als/service-store").ServiceArtefactStore | null = null;

function getServiceArtefactStoreSync() {
  if (_cachedStore) return _cachedStore;
  // Will be set on next async access
  getServiceArtefactStore().then((s) => { _cachedStore = s; });
  return null;
}

function analyzeGapsInline(service: ServiceWithArtefacts): GapItem[] {
  const gaps: GapItem[] = [];
  const m = service.manifest;

  gaps.push({ field: "id", status: m.id ? "present" : "missing", artefact: "manifest" });
  gaps.push({ field: "name", status: m.name ? "present" : "missing", artefact: "manifest" });
  gaps.push({ field: "description", status: m.description ? "present" : "missing", artefact: "manifest" });
  gaps.push({ field: "department", status: m.department ? "present" : "missing", artefact: "manifest" });
  gaps.push({ field: "input_schema", status: m.input_schema ? "present" : "missing", artefact: "manifest" });
  gaps.push({ field: "output_schema", status: m.output_schema ? "present" : "missing", artefact: "manifest" });
  gaps.push({ field: "constraints", status: m.constraints ? "present" : "missing", artefact: "manifest" });
  gaps.push({ field: "redress", status: m.redress ? "present" : "missing", artefact: "manifest" });
  gaps.push({ field: "audit_requirements", status: m.audit_requirements ? "present" : "missing", artefact: "manifest" });
  gaps.push({ field: "handoff", status: m.handoff ? "present" : "missing", artefact: "manifest" });

  if (service.policy) {
    const p = service.policy;
    gaps.push({ field: "policy.rules", status: p.rules.length > 0 ? "present" : "missing", artefact: "policy" });
    gaps.push({ field: "policy.edge_cases", status: (p.edge_cases?.length || 0) > 0 ? "present" : "missing", artefact: "policy" });
    gaps.push({ field: "policy.explanation_template", status: p.explanation_template ? "present" : "missing", artefact: "policy" });
  } else {
    gaps.push({ field: "policy", status: "missing", artefact: "policy" });
  }

  if (service.stateModel) {
    const s = service.stateModel;
    gaps.push({ field: "state-model.states", status: s.states.length > 0 ? "present" : "missing", artefact: "state-model" });
    gaps.push({ field: "state-model.transitions", status: s.transitions.length > 0 ? "present" : "missing", artefact: "state-model" });
    const hasInitial = s.states.some((st) => st.type === "initial");
    const hasTerminal = s.states.some((st) => st.type === "terminal");
    gaps.push({ field: "state-model.initial_state", status: hasInitial ? "present" : "missing", artefact: "state-model" });
    gaps.push({ field: "state-model.terminal_states", status: hasTerminal ? "present" : "missing", artefact: "state-model" });
  } else {
    gaps.push({ field: "state-model", status: "missing", artefact: "state-model" });
  }

  if (service.consent) {
    const c = service.consent;
    gaps.push({ field: "consent.grants", status: c.grants.length > 0 ? "present" : "missing", artefact: "consent" });
    gaps.push({ field: "consent.revocation", status: c.revocation ? "present" : "missing", artefact: "consent" });
    gaps.push({ field: "consent.delegation", status: c.delegation ? "present" : "missing", artefact: "consent" });
  } else {
    gaps.push({ field: "consent", status: "missing", artefact: "consent" });
  }

  return gaps;
}
