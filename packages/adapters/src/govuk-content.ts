/**
 * GovukContentAdapter — GOV.UK Content API adapter
 *
 * Fetches content from the GOV.UK Content API (content-api.publishing.service.gov.uk).
 * Used to retrieve official guidance, service pages, and structured content.
 */

import type { ServiceAdapter, AdapterConfig, AdapterRequest, AdapterResponse } from "./service-adapter";

export interface GovukContentInput {
  path: string;
  fields?: string[];
}

export interface GovukContentOutput {
  title: string;
  basePath: string;
  description: string;
  body?: string;
  details?: Record<string, unknown>;
  documentType: string;
  locale: string;
  updatedAt: string;
}

export class GovukContentAdapter implements ServiceAdapter {
  readonly type = "govuk-content";
  private baseUrl = "https://www.gov.uk/api/content";
  private ready = false;

  initialize(config: AdapterConfig): void {
    if (config.baseUrl) this.baseUrl = config.baseUrl as string;
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async execute(request: AdapterRequest): Promise<AdapterResponse> {
    if (!this.ready) {
      return { success: false, error: "GOV.UK Content adapter not initialized" };
    }

    const input = request.input as GovukContentInput;
    const cleanPath = input.path.startsWith("/") ? input.path : `/${input.path}`;

    try {
      const resp = await fetch(`${this.baseUrl}${cleanPath}`);
      if (!resp.ok) {
        return {
          success: false,
          error: `GOV.UK Content API returned ${resp.status}: ${resp.statusText}`,
        };
      }

      const data = await resp.json();

      const output: GovukContentOutput = {
        title: data.title || "",
        basePath: data.base_path || cleanPath,
        description: data.description || "",
        body: data.details?.body || undefined,
        details: data.details || {},
        documentType: data.document_type || "unknown",
        locale: data.locale || "en",
        updatedAt: data.public_updated_at || "",
      };

      return {
        success: true,
        output,
        metadata: {
          contentId: data.content_id,
          schema: data.schema_name,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async shutdown(): Promise<void> {
    this.ready = false;
  }
}
