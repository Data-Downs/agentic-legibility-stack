/**
 * CapabilityInvoker — THE single choke point for all service calls
 *
 * Every interaction with a government service MUST go through this class.
 * It is where:
 *   - The capability manifest is looked up
 *   - Policy rules are evaluated (stub for now)
 *   - Consent is checked (stub for now)
 *   - The invocation is traced
 *   - A receipt is generated
 *   - The actual call is made
 *   - The result is logged
 *
 * Nothing bypasses this.
 */

import type {
  InvocationContext,
  InvocationResult,
  TraceEvent,
  TraceEventType,
  Receipt,
} from "@als/schemas";

type ServiceHandler = (
  input: unknown,
  context: InvocationContext
) => Promise<unknown>;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createTraceEvent(
  type: TraceEventType,
  context: InvocationContext,
  capabilityId: string,
  payload: Record<string, unknown>
): TraceEvent {
  return {
    id: `evt_${generateId()}`,
    traceId: context.traceId,
    spanId: `span_${generateId()}`,
    timestamp: new Date().toISOString(),
    type,
    payload,
    metadata: {
      userId: context.userId,
      sessionId: context.sessionId,
      capabilityId,
    },
  };
}

export class CapabilityInvoker {
  private handlers = new Map<string, ServiceHandler>();

  /**
   * Register a handler for a capability.
   * The handler is the function that actually executes the service call.
   */
  registerHandler(capabilityId: string, handler: ServiceHandler): void {
    this.handlers.set(capabilityId, handler);
  }

  /**
   * Invoke a capability. This is the ONLY way to call a service.
   *
   * Currently acts as a pass-through wrapper with logging.
   * In later steps, this will add:
   *   - Manifest lookup (Step 4)
   *   - Trace emission (Step 5)
   *   - Policy evaluation (Step 6)
   *   - Consent checking (Step 8)
   */
  async invoke(
    capabilityId: string,
    input: unknown,
    context: InvocationContext
  ): Promise<InvocationResult> {
    const traceEvents: TraceEvent[] = [];
    const startTime = Date.now();

    // Emit capability.invoked trace event
    traceEvents.push(
      createTraceEvent("capability.invoked", context, capabilityId, {
        capabilityId,
        inputSummary: typeof input === "object" ? Object.keys(input || {}) : typeof input,
      })
    );

    console.log(
      `[CapabilityInvoker] Invoking: ${capabilityId} (session: ${context.sessionId})`
    );

    try {
      // Look up handler
      const handler = this.handlers.get(capabilityId);
      if (!handler) {
        const error = `No handler registered for capability: ${capabilityId}`;
        traceEvents.push(
          createTraceEvent("error.raised", context, capabilityId, {
            error,
          })
        );
        return {
          success: false,
          capabilityId,
          error,
          traceEvents,
        };
      }

      // Execute the handler
      const output = await handler(input, context);
      const duration = Date.now() - startTime;

      // Emit capability.result trace event
      traceEvents.push(
        createTraceEvent("capability.result", context, capabilityId, {
          success: true,
          durationMs: duration,
        })
      );

      // Generate receipt
      const receipt: Receipt = {
        id: `rcpt_${generateId()}`,
        traceId: context.traceId,
        capabilityId,
        timestamp: new Date().toISOString(),
        citizen: {
          id: context.userId || "anonymous",
        },
        action: `Invoked ${capabilityId}`,
        outcome: "success",
        details: { durationMs: duration },
      };

      traceEvents.push(
        createTraceEvent("receipt.issued", context, capabilityId, {
          receiptId: receipt.id,
        })
      );

      console.log(
        `[CapabilityInvoker] Complete: ${capabilityId} (${duration}ms)`
      );

      return {
        success: true,
        capabilityId,
        output,
        receipt,
        traceEvents,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      traceEvents.push(
        createTraceEvent("error.raised", context, capabilityId, {
          error: errorMessage,
          durationMs: duration,
        })
      );

      console.error(
        `[CapabilityInvoker] Error: ${capabilityId} — ${errorMessage}`
      );

      return {
        success: false,
        capabilityId,
        error: errorMessage,
        traceEvents,
      };
    }
  }
}
