/**
 * Singleton init for AnthropicAdapter + GovukContentAdapter.
 * Same pattern as service-store-init.ts.
 */

import { AnthropicAdapter, GovukContentAdapter } from "@als/adapters";

let anthropic: AnthropicAdapter | null = null;
let govuk: GovukContentAdapter | null = null;

export function getAnthropicAdapter(): AnthropicAdapter {
  if (!anthropic) {
    anthropic = new AnthropicAdapter();
    anthropic.initialize({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropic;
}

export function getGovukContentAdapter(): GovukContentAdapter {
  if (!govuk) {
    govuk = new GovukContentAdapter();
    govuk.initialize({});
  }
  return govuk;
}
