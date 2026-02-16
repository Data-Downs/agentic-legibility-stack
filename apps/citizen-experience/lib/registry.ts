/**
 * Singleton ServiceRegistry instance for the citizen-experience app.
 * Loads manifests from data/services/ on first access.
 */

import { ServiceRegistry } from "@als/runtime";
import path from "path";

let registry: ServiceRegistry | null = null;
let loadPromise: Promise<ServiceRegistry> | null = null;

/** Reset the singleton so new services get picked up without restart */
export function invalidateRegistry(): void {
  registry = null;
  loadPromise = null;
}

export async function getRegistry(): Promise<ServiceRegistry> {
  if (registry) return registry;

  // Prevent concurrent loads
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const reg = new ServiceRegistry();
    // Try monorepo root first (../../data/services from app dir), then app-local
    const monorepoDir = path.join(process.cwd(), "..", "..", "data", "services");
    const localDir = path.join(process.cwd(), "data", "services");
    try {
      await reg.loadFromDirectory(monorepoDir);
    } catch {
      await reg.loadFromDirectory(localDir);
    }
    registry = reg;
    return reg;
  })();

  return loadPromise;
}
