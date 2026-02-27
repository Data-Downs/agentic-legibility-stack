/**
 * Ledger helper — wraps CaseStore with service-aware logic.
 * Loads state models from the filesystem to compute progress percentages.
 */

import fs from "fs";
import path from "path";
import type { StateModelDefinition } from "@als/schemas";
import { getCaseStore } from "./evidence";
import type { CaseStore } from "@als/evidence";
import { getServiceArtefact } from "./service-data";

/** Resolve the filesystem directory slug from a serviceId */
function serviceDirSlug(serviceId: string): string {
  const parts = serviceId.split(".");
  return parts.length > 1 ? parts.slice(1).join(".") : parts[0];
}

/** Load a state model definition for a service */
export async function loadStateModel(serviceId: string): Promise<StateModelDefinition | null> {
  // Try bundled data first (works on Cloudflare, now async with Studio fallback)
  const bundled = await getServiceArtefact(serviceId, "stateModel");
  if (bundled) return bundled as unknown as StateModelDefinition;
  // Fallback to filesystem
  const slug = serviceDirSlug(serviceId);
  for (const base of [
    path.join(process.cwd(), "..", "..", "data", "services"),
    path.join(process.cwd(), "data", "services"),
  ]) {
    try {
      const raw = fs.readFileSync(path.join(base, slug, "state-model.json"), "utf-8");
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  return null;
}

/** Get the total number of states in a service's state model */
export async function getTotalStates(serviceId: string): Promise<number> {
  const model = await loadStateModel(serviceId);
  return model ? model.states.length : 0;
}

/** Get the CaseStore singleton */
export async function getLedgerStore(): Promise<CaseStore> {
  return getCaseStore();
}

/**
 * Map from service-store ID format (dwp-universal-credit) to the legacy
 * dot-separated format used in trace/case data (dwp.apply-universal-credit).
 */
const SERVICE_STORE_TO_LEGACY: Record<string, string> = {
  "dwp-universal-credit": "dwp.apply-universal-credit",
  "dvla-renew-driving-licence": "dvla.renew-driving-licence",
  "dwp-check-state-pension": "dwp.check-state-pension",
};

/**
 * Normalize a serviceId for ledger queries. The service-store uses hyphenated IDs
 * (e.g. "dwp-universal-credit") while the cases table uses legacy dot-separated IDs
 * (e.g. "dwp.apply-universal-credit"). This tries the input first, then the legacy mapping.
 */
export async function normalizeLedgerServiceId(serviceId: string): Promise<string> {
  const store = await getLedgerStore();
  // Try as-is first
  const dashboard = await store.getDashboard(serviceId);
  if (dashboard.totalCases > 0) return serviceId;
  // Try legacy mapping
  const legacy = SERVICE_STORE_TO_LEGACY[serviceId];
  if (legacy) return legacy;
  // Try converting hyphen format to dot format (dept-slug → dept.slug)
  const dotted = serviceId.replace("-", ".");
  const dottedDash = await store.getDashboard(dotted);
  if (dottedDash.totalCases > 0) return dotted;
  return serviceId;
}
