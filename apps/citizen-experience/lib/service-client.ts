/**
 * ServiceClient — fetches service data from Studio's v1 API.
 *
 * Features:
 * - TTL cache (default 60s) to avoid hammering Studio on every chat turn
 * - Request deduplication — concurrent calls for the same key share one in-flight fetch
 * - 5s timeout via AbortController for fast failure
 * - Returns null on any error (caller falls back to bundled data)
 */

interface CacheEntry<T> {
  data: T;
  ts: number;
}

interface ServiceClientOptions {
  ttl?: number;     // cache TTL in ms (default 60_000)
  timeout?: number; // fetch timeout in ms (default 5_000)
}

export class ServiceClient {
  private baseUrl: string;
  private ttl: number;
  private timeout: number;
  private cache = new Map<string, CacheEntry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(baseUrl: string, options?: ServiceClientOptions) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.ttl = options?.ttl ?? 60_000;
    this.timeout = options?.timeout ?? 5_000;
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

      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
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

/** Singleton ServiceClient — only created if STUDIO_API_URL is set */
let _client: ServiceClient | null | undefined;

export function getServiceClient(): ServiceClient | null {
  if (_client !== undefined) return _client;

  const url = process.env.STUDIO_API_URL;
  if (!url) {
    _client = null;
    return null;
  }

  _client = new ServiceClient(url);
  console.log(`[ServiceClient] Connecting to Studio at ${url}`);
  return _client;
}
