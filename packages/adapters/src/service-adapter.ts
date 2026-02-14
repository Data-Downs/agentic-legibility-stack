/**
 * ServiceAdapter — The interface ALL external service adapters must implement.
 *
 * Adapters abstract away the specifics of calling an external API.
 * The CapabilityInvoker resolves adapters from manifests and routes
 * calls through them, ensuring zero direct API usage outside adapters.
 */

export interface AdapterConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
  [key: string]: unknown;
}

export interface AdapterRequest {
  input: unknown;
  context: {
    sessionId: string;
    traceId: string;
    userId?: string;
  };
}

export interface AdapterResponse {
  success: boolean;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ServiceAdapter {
  /** Unique adapter type identifier */
  readonly type: string;

  /** Initialize the adapter with config */
  initialize(config: AdapterConfig): void;

  /** Execute a request through this adapter */
  execute(request: AdapterRequest): Promise<AdapterResponse>;

  /** Check if the adapter is ready to handle requests */
  isReady(): boolean;

  /** Gracefully shut down the adapter */
  shutdown(): Promise<void>;
}
