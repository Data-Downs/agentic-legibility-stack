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

  /** Extract directory name from a service ID (e.g. "dvla.renew-driving-licence" → "renew-driving-licence") */
  static slugFromId(serviceId: string): string {
    const parts = serviceId.split(".");
    return parts.length > 1 ? parts.slice(1).join(".") : parts[0];
  }

  /** Save a service's artefacts to disk and update in-memory map */
  async saveService(dirPath: string, serviceId: string, artefacts: ServiceArtefacts): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const slug = ArtefactStore.slugFromId(serviceId);
    const serviceDir = path.join(dirPath, slug);

    await fs.mkdir(serviceDir, { recursive: true });

    // Always write manifest
    await fs.writeFile(
      path.join(serviceDir, "manifest.json"),
      JSON.stringify(artefacts.manifest, null, 2),
      "utf-8"
    );

    // Write optional artefacts if present
    if (artefacts.policy) {
      await fs.writeFile(
        path.join(serviceDir, "policy.json"),
        JSON.stringify(artefacts.policy, null, 2),
        "utf-8"
      );
    }

    if (artefacts.stateModel) {
      await fs.writeFile(
        path.join(serviceDir, "state-model.json"),
        JSON.stringify(artefacts.stateModel, null, 2),
        "utf-8"
      );
    }

    if (artefacts.consent) {
      await fs.writeFile(
        path.join(serviceDir, "consent.json"),
        JSON.stringify(artefacts.consent, null, 2),
        "utf-8"
      );
    }

    // Update in-memory map
    this.artefacts.set(serviceId, artefacts);
    console.log(`[ArtefactStore] Saved service ${serviceId} to ${serviceDir}`);
  }

  /** Delete a service from disk and in-memory map */
  async deleteService(dirPath: string, serviceId: string): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const slug = ArtefactStore.slugFromId(serviceId);
    const serviceDir = path.join(dirPath, slug);

    await fs.rm(serviceDir, { recursive: true, force: true });
    this.artefacts.delete(serviceId);
    console.log(`[ArtefactStore] Deleted service ${serviceId} from ${serviceDir}`);
  }
}
