/**
 * ServiceRegistry — Registry of available capabilities
 *
 * Loads capability manifests from JSON files and provides lookup.
 * The agent discovers what services are available through this registry.
 */

import type { CapabilityManifest } from "@als/schemas";

export class ServiceRegistry {
  private manifests = new Map<string, CapabilityManifest>();

  /** Register a capability manifest */
  register(manifest: CapabilityManifest): void {
    this.manifests.set(manifest.id, manifest);
  }

  /** Look up a capability by ID */
  lookup(capabilityId: string): CapabilityManifest | undefined {
    return this.manifests.get(capabilityId);
  }

  /** List all registered capabilities */
  listAll(): CapabilityManifest[] {
    return Array.from(this.manifests.values());
  }

  /** Check if a capability is registered */
  has(capabilityId: string): boolean {
    return this.manifests.has(capabilityId);
  }

  /** Get the number of registered capabilities */
  get size(): number {
    return this.manifests.size;
  }

  /**
   * Load manifests from a directory.
   * Expects subdirectories each containing a manifest.json file.
   * e.g. data/services/renew-driving-licence/manifest.json
   *
   * Uses dynamic import of fs/path to work in both Node.js and edge environments.
   */
  async loadFromDirectory(dirPath: string): Promise<number> {
    const fs = await import("fs/promises");
    const path = await import("path");

    let loaded = 0;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(dirPath, entry.name, "manifest.json");
      try {
        const raw = await fs.readFile(manifestPath, "utf-8");
        const manifest: CapabilityManifest = JSON.parse(raw);
        this.register(manifest);
        loaded++;
      } catch {
        // Skip directories without a valid manifest.json
        console.warn(`[ServiceRegistry] Skipping ${entry.name}: no valid manifest.json`);
      }
    }

    console.log(`[ServiceRegistry] Loaded ${loaded} manifests from ${dirPath}`);
    return loaded;
  }
}
