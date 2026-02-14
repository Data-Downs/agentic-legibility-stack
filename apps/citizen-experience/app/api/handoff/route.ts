import { NextRequest, NextResponse } from "next/server";
import { HandoffManager } from "@als/runtime";
import { getTraceEmitter } from "@/lib/evidence";
import { getRegistry } from "@/lib/registry";

const handoffManager = new HandoffManager();

/**
 * POST /api/handoff
 *
 * Evaluates whether a handoff should be triggered and creates
 * a structured handoff package if so.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, citizenName, serviceId, traceId, stepsCompleted, stepsBlocked, dataCollected } = body;

    // Evaluate triggers
    const evaluation = handoffManager.evaluateTriggers(message || "");
    if (!evaluation.triggered) {
      return NextResponse.json({ triggered: false });
    }

    // Look up service manifest for routing info
    const registry = await getRegistry();
    const manifest = serviceId ? registry.lookup(serviceId) : undefined;

    // Create handoff package
    const handoffPackage = handoffManager.createPackage({
      reason: evaluation.reason!,
      description: evaluation.description!,
      agentAssessment: `Handoff triggered during interaction. Reason: ${evaluation.description}`,
      citizen: { name: citizenName || "Unknown citizen" },
      service: manifest,
      stepsCompleted: stepsCompleted || [],
      stepsBlocked: stepsBlocked || [],
      dataCollected: dataCollected || [],
      timeSpent: "Unknown",
      traceId: traceId || `trace_${Date.now()}`,
      receiptIds: [],
    });

    // Emit trace event
    const emitter = getTraceEmitter();
    const span = emitter.startSpan({
      traceId: traceId || handoffPackage.traceId,
      sessionId: `session_${Date.now()}`,
      capabilityId: serviceId,
    });
    emitter.emit("handoff.initiated", span, {
      handoffId: handoffPackage.id,
      reason: handoffPackage.reason.category,
      urgency: handoffPackage.urgency,
    });
    emitter.emit("handoff.package.created", span, {
      handoffId: handoffPackage.id,
      department: handoffPackage.routing.department,
      queue: handoffPackage.routing.suggestedQueue,
    });

    return NextResponse.json({
      triggered: true,
      handoff: handoffPackage,
    });
  } catch (error) {
    console.error("Error in handoff:", error);
    return NextResponse.json(
      { error: "Failed to process handoff" },
      { status: 500 }
    );
  }
}
