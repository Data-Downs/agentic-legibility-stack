/**
 * Ledger helper — wraps CaseStore with service-aware logic.
 * Loads state models from the filesystem to compute progress percentages.
 */

import fs from "fs";
import path from "path";
import type { StateModelDefinition } from "@als/schemas";
import { getCaseStore } from "./evidence";

/** Resolve the filesystem directory slug from a serviceId */
function serviceDirSlug(serviceId: string): string {
  const parts = serviceId.split(".");
  return parts.length > 1 ? parts.slice(1).join(".") : parts[0];
}

/** Load a state model definition for a service */
export function loadStateModel(serviceId: string): StateModelDefinition | null {
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
export function getTotalStates(serviceId: string): number {
  const model = loadStateModel(serviceId);
  return model ? model.states.length : 0;
}

/** Get the CaseStore singleton */
export function getLedgerStore() {
  return getCaseStore();
}
