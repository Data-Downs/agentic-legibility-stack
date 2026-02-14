/**
 * Server-side artefact loader for the Legibility Studio.
 * Reads service manifests, policies, state models, and consent models
 * from the shared data/services/ directory.
 */

import { ArtefactStore } from "@als/legibility";
import type { ServiceArtefacts } from "@als/legibility";
import path from "path";

let store: ArtefactStore | null = null;
let loadPromise: Promise<ArtefactStore> | null = null;

/** Returns the resolved path to the data/services/ directory */
export function getServicesDirectory(): string {
  return path.join(process.cwd(), "..", "..", "data", "services");
}

/** Resets the cached store so the next read triggers a fresh load from disk */
export function invalidateArtefactStore(): void {
  store = null;
  loadPromise = null;
}

export async function getArtefactStore(): Promise<ArtefactStore> {
  if (store) return store;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const s = new ArtefactStore();
    await s.loadFromDirectory(getServicesDirectory());
    store = s;
    return s;
  })();

  return loadPromise;
}

export async function getServiceArtefacts(serviceId: string): Promise<ServiceArtefacts | undefined> {
  const s = await getArtefactStore();
  return s.get(serviceId);
}

export async function listServices(): Promise<string[]> {
  const s = await getArtefactStore();
  return s.listServices();
}

/**
 * Gap analysis: Check which artefact fields are present, missing, or incomplete.
 */
export interface GapItem {
  field: string;
  status: "present" | "missing" | "incomplete";
  artefact: "manifest" | "policy" | "state-model" | "consent";
}

export function analyzeGaps(artefacts: ServiceArtefacts): GapItem[] {
  const gaps: GapItem[] = [];

  // Manifest checks
  const m = artefacts.manifest;
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

  // Policy checks
  if (artefacts.policy) {
    const p = artefacts.policy;
    gaps.push({ field: "policy.rules", status: p.rules.length > 0 ? "present" : "missing", artefact: "policy" });
    gaps.push({ field: "policy.edge_cases", status: (p.edge_cases?.length || 0) > 0 ? "present" : "missing", artefact: "policy" });
    gaps.push({ field: "policy.explanation_template", status: p.explanation_template ? "present" : "missing", artefact: "policy" });
  } else {
    gaps.push({ field: "policy", status: "missing", artefact: "policy" });
  }

  // State model checks
  if (artefacts.stateModel) {
    const s = artefacts.stateModel;
    gaps.push({ field: "state-model.states", status: s.states.length > 0 ? "present" : "missing", artefact: "state-model" });
    gaps.push({ field: "state-model.transitions", status: s.transitions.length > 0 ? "present" : "missing", artefact: "state-model" });
    const hasInitial = s.states.some((st) => st.type === "initial");
    const hasTerminal = s.states.some((st) => st.type === "terminal");
    gaps.push({ field: "state-model.initial_state", status: hasInitial ? "present" : "missing", artefact: "state-model" });
    gaps.push({ field: "state-model.terminal_states", status: hasTerminal ? "present" : "missing", artefact: "state-model" });
  } else {
    gaps.push({ field: "state-model", status: "missing", artefact: "state-model" });
  }

  // Consent model checks
  if (artefacts.consent) {
    const c = artefacts.consent;
    gaps.push({ field: "consent.grants", status: c.grants.length > 0 ? "present" : "missing", artefact: "consent" });
    gaps.push({ field: "consent.revocation", status: c.revocation ? "present" : "missing", artefact: "consent" });
    gaps.push({ field: "consent.delegation", status: c.delegation ? "present" : "missing", artefact: "consent" });
  } else {
    gaps.push({ field: "consent", status: "missing", artefact: "consent" });
  }

  return gaps;
}
