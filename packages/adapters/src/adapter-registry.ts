/**
 * AdapterRegistry — Resolves adapters by type
 *
 * Manifests declare an `adapter` field with a type string.
 * The CapabilityInvoker uses this registry to look up the
 * correct adapter for each capability.
 */

import type { ServiceAdapter, AdapterConfig } from "./service-adapter";
import { AnthropicAdapter } from "./anthropic";
import { GovukContentAdapter } from "./govuk-content";
import { McpAdapter } from "./mcp";

export class AdapterRegistry {
  private adapters = new Map<string, ServiceAdapter>();

  constructor() {
    // Register built-in adapter factories
    this.register("anthropic", new AnthropicAdapter());
    this.register("govuk-content", new GovukContentAdapter());
    this.register("mcp", new McpAdapter());
  }

  /** Register a named adapter instance */
  register(type: string, adapter: ServiceAdapter): void {
    this.adapters.set(type, adapter);
  }

  /** Get an adapter by type */
  get(type: string): ServiceAdapter | undefined {
    return this.adapters.get(type);
  }

  /** Initialize an adapter with config */
  initialize(type: string, config: AdapterConfig): void {
    const adapter = this.adapters.get(type);
    if (adapter) {
      adapter.initialize(config);
    }
  }

  /** List all registered adapter types */
  listTypes(): string[] {
    return Array.from(this.adapters.keys());
  }

  /** Shutdown all adapters */
  async shutdownAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.shutdown();
    }
  }
}
