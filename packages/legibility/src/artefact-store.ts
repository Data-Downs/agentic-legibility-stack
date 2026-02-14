/**
 * ArtefactStore — Loads and manages the four artefact types per service
 *
 * Each service has:
 *   1. manifest.json — CapabilityManifest
 *   2. policy.json — PolicyRuleset
 *   3. state-model.json — StateModelDefinition
 *   4. consent.json — ConsentModel
 *
 * The ArtefactStore loads all four from a service directory.
 */

import type {
  CapabilityManifest,
  PolicyRuleset,
  StateModelDefinition,
  ConsentModel,
} from "@als/schemas";

export interface ServiceArtefacts {
  manifest: CapabilityManifest;
  policy?: PolicyRuleset;
  stateModel?: StateModelDefinition;
  consent?: ConsentModel;
}

export class ArtefactStore {
  private artefacts = new Map<string, ServiceArtefacts>();

  /** Register a complete set of artefacts for a service */
  register(serviceId: string, artefacts: ServiceArtefacts): void {
    this.artefacts.set(serviceId, artefacts);
  }

  /** Get all artefacts for a service */
  get(serviceId: string): ServiceArtefacts | undefined {
    return this.artefacts.get(serviceId);
  }

  /** List all registered service IDs */
  listServices(): string[] {
    return Array.from(this.artefacts.keys());
  }

  /**
   * Load artefacts from a directory.
   * Expects subdirectories each containing manifest.json and optionally
   * policy.json, state-model.json, consent.json.
   */
  async loadFromDirectory(dirPath: string): Promise<number> {
    const fs = await import("fs/promises");
    const path = await import("path");

    let loaded = 0;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const serviceDir = path.join(dirPath, entry.name);

      try {
        const manifestRaw = await fs.readFile(path.join(serviceDir, "manifest.json"), "utf-8");
        const manifest: CapabilityManifest = JSON.parse(manifestRaw);

        const artefacts: ServiceArtefacts = { manifest };

        // Try loading optional artefacts
        try {
          const policyRaw = await fs.readFile(path.join(serviceDir, "policy.json"), "utf-8");
          artefacts.policy = JSON.parse(policyRaw);
        } catch { /* optional */ }

        try {
          const stateRaw = await fs.readFile(path.join(serviceDir, "state-model.json"), "utf-8");
          artefacts.stateModel = JSON.parse(stateRaw);
        } catch { /* optional */ }

        try {
          const consentRaw = await fs.readFile(path.join(serviceDir, "consent.json"), "utf-8");
          artefacts.consent = JSON.parse(consentRaw);
        } catch { /* optional */ }

        this.register(manifest.id, artefacts);
        loaded++;
      } catch {
        console.warn(`[ArtefactStore] Skipping ${entry.name}: no valid manifest.json`);
      }
    }

    console.log(`[ArtefactStore] Loaded ${loaded} service artefact sets from ${dirPath}`);
    return loaded;
  }
}
