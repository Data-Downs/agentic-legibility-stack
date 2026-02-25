export interface ExtractedFact {
  key: string;
  value: unknown;
  confidence: "high" | "medium" | "low";
  source_snippet: string;
}

export interface LLMStructuredOutput {
  title?: string;
  tasks?: Array<{
    description: string;
    detail: string;
    type: "agent" | "user";
    dueDate?: string;
    dataNeeded?: string[];
  }>;
  stateTransition?: string;
  extractedFacts?: ExtractedFact[];
}

interface ExtractionResult {
  parsed: LLMStructuredOutput | null;
  cleanText: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Extract structured output from the last fenced ```json block in an LLM response.
 * Always strips the matched block from display text (even if JSON is malformed).
 * Returns { parsed: null, cleanText: original } if no block found.
 */
export function extractStructuredOutput(responseText: string): ExtractionResult {
  // Find the last ```json ... ``` block
  const fencePattern = /```json\s*\n([\s\S]*?)```/g;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = fencePattern.exec(responseText)) !== null) {
    lastMatch = match;
  }

  if (!lastMatch) {
    return { parsed: null, cleanText: responseText };
  }

  // Strip the matched block from display text regardless of parse success
  const cleanText = (
    responseText.slice(0, lastMatch.index) +
    responseText.slice(lastMatch.index + lastMatch[0].length)
  ).trim();

  // Attempt to parse JSON
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(lastMatch[1]);
  } catch {
    console.warn("Structured output: malformed JSON in fenced block, ignoring");
    return { parsed: null, cleanText };
  }

  // Validate each field independently (lenient — missing fields are fine)
  const output: LLMStructuredOutput = {};

  // Title
  if (typeof raw.title === "string" && raw.title.trim().length > 0) {
    output.title = raw.title.trim();
  }

  // State transition
  if (typeof raw.stateTransition === "string" && raw.stateTransition.trim().length > 0) {
    output.stateTransition = raw.stateTransition.trim();
  }

  // Tasks
  if (Array.isArray(raw.tasks)) {
    const validated: LLMStructuredOutput["tasks"] = [];
    for (const t of raw.tasks.slice(0, 3)) {
      if (typeof t !== "object" || t === null) continue;
      const task = t as Record<string, unknown>;

      const description = typeof task.description === "string"
        ? task.description.trim().slice(0, 60)
        : "";
      const detail = typeof task.detail === "string"
        ? task.detail.trim().slice(0, 150)
        : "";
      const type = task.type === "agent" || task.type === "user"
        ? task.type
        : null;

      if (!description || !detail || !type) continue;

      const entry: NonNullable<LLMStructuredOutput["tasks"]>[number] = {
        description,
        detail,
        type,
      };

      if (typeof task.dueDate === "string" && ISO_DATE_RE.test(task.dueDate)) {
        entry.dueDate = task.dueDate;
      }

      if (Array.isArray(task.dataNeeded)) {
        entry.dataNeeded = task.dataNeeded
          .filter((d): d is string => typeof d === "string")
          .map((d) => d.trim())
          .filter(Boolean);
      }

      validated.push(entry);
    }
    if (validated.length > 0) {
      output.tasks = validated;
    }
  }

  // Extracted facts
  if (Array.isArray(raw.extractedFacts)) {
    const validFacts: ExtractedFact[] = [];
    for (const f of raw.extractedFacts.slice(0, 5)) {
      if (typeof f !== "object" || f === null) continue;
      const fact = f as Record<string, unknown>;
      const key = typeof fact.key === "string" ? fact.key.trim() : "";
      const confidence = (fact.confidence === "high" || fact.confidence === "medium" || fact.confidence === "low")
        ? fact.confidence
        : "medium";
      const sourceSnippet = typeof fact.source_snippet === "string" ? fact.source_snippet.trim().slice(0, 200) : "";
      if (!key || fact.value === undefined) continue;
      validFacts.push({ key, value: fact.value, confidence, source_snippet: sourceSnippet });
    }
    if (validFacts.length > 0) {
      output.extractedFacts = validFacts;
    }
  }

  return { parsed: output, cleanText };
}
