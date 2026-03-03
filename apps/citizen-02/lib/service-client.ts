/**
 * ServiceClient — fetches service data from Studio's v1 API.
 *
 * Features:
 * - TTL cache (default 60s) to avoid hammering Studio on every chat turn
 * - Request deduplication — concurrent calls for the same key share one in-flight fetch
 * - 5s timeout via AbortController for fast failure
 * - Service binding support — on Cloudflare, uses env.STUDIO.fetch() for
 *   direct Worker-to-Worker calls (bypasses *.workers.dev DNS routing)
 * - Returns null on any error (caller falls back to bundled data)
 */

/** Minimal Fetcher interface — matches Cloudflare Service Binding */
interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface CacheEntry<T> {
  data: T;
  ts: number;
}

interface ServiceClientOptions {
  ttl?: number;      // cache TTL in ms (default 60_000)
  timeout?: number;  // fetch timeout in ms (default 5_000)
  fetcher?: Fetcher; // optional service binding fetcher
}

export class ServiceClient {
  private baseUrl: string;
  private ttl: number;
  private timeout: number;
  private fetcher: Fetcher | undefined;
  private cache = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(baseUrl: string, options?: ServiceClientOptions) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.ttl = options?.ttl ?? 60_000;
    this.timeout = options?.timeout ?? 5_000;
    this.fetcher = options?.fetcher;
  }

  /** GET /api/v1/services/:id — returns full service detail or null */
  async getService(id: string): Promise<Record<string, unknown> | null> {
    return this.fetchJson(`/api/v1/services/${encodeURIComponent(id)}`);
  }

  /** GET /api/v1/services — returns { services, lifeEvents, total } or null */
  async getAllServices(): Promise<{ services: unknown[]; total: number } | null> {
    return this.fetchJson("/api/v1/services");
  }

  /** GET /api/v1/life-events — returns { lifeEvents, total } or null */
  async getLifeEvents(): Promise<{ lifeEvents: unknown[]; total: number } | null> {
    return this.fetchJson("/api/v1/life-events");
  }

  /**
   * Get a specific artefact (manifest, policy, stateModel, consent) from a service.
   * Fetches the full service and extracts the requested artefact.
   */
  async getServiceArtefact(
    id: string,
    type: "manifest" | "policy" | "stateModel" | "consent",
  ): Promise<Record<string, unknown> | null> {
    const service = await this.getService(id);
    if (!service) return null;
    const artefact = service[type];
    return artefact && typeof artefact === "object" ? (artefact as Record<string, unknown>) : null;
  }

  /** Core fetch with TTL cache, dedup, timeout, and graceful error handling */
  private async fetchJson<T>(path: string): Promise<T | null> {
    const key = path;

    // Check cache
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;
    if (cached && Date.now() - cached.ts < this.ttl) {
      return cached.data;
    }

    // Deduplicate concurrent requests
    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T | null>;
    }

    const promise = this.doFetch<T>(key);
    this.inflight.set(key, promise);

    try {
      return await promise;
    } finally {
      this.inflight.delete(key);
    }
  }

  private async doFetch<T>(path: string): Promise<T | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const url = `${this.baseUrl}${path}`;
      const init: RequestInit = {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      };

      // Use service binding fetcher if available, otherwise global fetch
      const doFetch = this.fetcher
        ? this.fetcher.fetch.bind(this.fetcher)
        : globalThis.fetch;
      const res = await doFetch(url, init);
      clearTimeout(timer);

      if (!res.ok) return null;

      const data = (await res.json()) as T;
      this.cache.set(path, { data, ts: Date.now() });
      return data;
    } catch {
      // Network error, timeout, abort — all return null for graceful fallback
      return null;
    }
  }
}

/** Resolve STUDIO_API_URL and optional service binding from env */
async function resolveStudioConfig(): Promise<{ url?: string; fetcher?: Fetcher }> {
  // On Cloudflare Workers with OpenNext, check for service binding + vars first
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { env } = getCloudflareContext() as any;
    const url = env?.STUDIO_API_URL as string | undefined;
    const fetcher = env?.STUDIO as Fetcher | undefined;
    if (url || fetcher) return { url, fetcher };
  } catch {
    // Not on Cloudflare — fall through to process.env
  }
  // Local dev: use process.env
  if (process.env.STUDIO_API_URL) {
    return { url: process.env.STUDIO_API_URL };
  }
  return {};
}

/** Singleton ServiceClient — only created if STUDIO_API_URL is set */
let _client: ServiceClient | null | undefined;
let _resolvedUrl: string | undefined;

export async function getServiceClient(): Promise<ServiceClient | null> {
  const { url, fetcher } = await resolveStudioConfig();
  if (!url) return null;

  // Return cached client if URL hasn't changed
  if (_client && _resolvedUrl === url) return _client;

  _resolvedUrl = url;
  _client = new ServiceClient(url, { fetcher });
  const mode = fetcher ? "service binding" : "public URL";
  console.log(`[ServiceClient] Connecting to Studio at ${url} (${mode})`);
  return _client;
}
