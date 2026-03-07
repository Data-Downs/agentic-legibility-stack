// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { AnthropicAdapter } from "@als/adapters";

const adapter = new AnthropicAdapter();

function ensureAdapter() {
  if (!adapter.isReady()) {
    adapter.initialize({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
}

/**
 * POST /api/personal-data/[personaId]/document-upload
 *
 * Accepts multipart/form-data with a file (image or PDF) plus serviceId and stateId.
 * Uses Claude vision to extract structured fields from the document.
 * Returns { extracted: Record<string, string>, summary: string }.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const serviceId = formData.get("serviceId") as string | null;
    const stateId = formData.get("stateId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "application/octet-stream";

    // Build the vision content block
    const isPdf = mimeType === "application/pdf";
    const contentBlock = isPdf
      ? { type: "document" as const, source: { type: "base64" as const, media_type: mimeType, data: base64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mimeType, data: base64 } };

    const systemPrompt = `You are a UK government document data extractor. The user has uploaded a supporting document as part of a government service journey (serviceId: ${serviceId || "unknown"}, personaId: ${personaId}).

Extract ALL structured fields you can identify from this document. Common document types and their fields:

- P45 (leaving certificate): employer_name, employer_paye_ref, leaving_date, tax_code, total_pay, total_tax, ni_number, employee_name
- Photo ID (passport/driving licence): full_name, date_of_birth, document_number, expiry_date, nationality, address
- Utility bill: account_holder, address, bill_date, amount_due, supplier_name, account_number
- Bank statement: account_holder, sort_code, account_number, statement_date, balance
- Council tax bill: council_name, account_reference, property_address, band, annual_charge

Return a JSON object with exactly two keys:
1. "extracted" — an object mapping field_key (snake_case) to the extracted string value
2. "summary" — a one-sentence human-readable summary of what was extracted (e.g. "P45 from Acme Ltd showing total pay of £24,500")

Return ONLY valid JSON, no markdown fences, no explanation.`;

    ensureAdapter();

    const result = await adapter.execute({
      input: {
        systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              contentBlock,
              { type: "text", text: "Extract the structured fields from this document." },
            ],
          },
        ],
        model: "claude-sonnet-4-5-20250929",
        maxTokens: 2048,
        thinkingBudget: 1024,
      },
      context: {
        sessionId: `doc-upload-${Date.now()}`,
        traceId: `doc-upload-${personaId}-${Date.now()}`,
        userId: personaId,
      },
    });

    if (!result.success || !result.output) {
      return NextResponse.json(
        { error: result.error || "Extraction failed" },
        { status: 500 }
      );
    }

    const responseText = (result.output as { responseText: string }).responseText;

    // Parse the JSON response
    let parsed: { extracted: Record<string, string>; summary: string };
    try {
      // Strip any markdown fences if present
      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: return raw text as summary
      parsed = {
        extracted: { raw_text: responseText },
        summary: "Document processed but structured extraction was not possible.",
      };
    }

    // Add the filename as an extracted field
    parsed.extracted.document_filename = file.name;

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[DocumentUpload] POST error:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}
