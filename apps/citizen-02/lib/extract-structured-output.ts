export interface ExtractedFact {
  key: string;
  value: unknown;
  confidence: "high" | "medium" | "low";
  source_snippet: string;
}

export interface LLMTaskField {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "currency" | "date" | "number" | "confirm" | "select";
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  prefill?: string;
  required?: boolean;
}

const VALID_FIELD_TYPES = new Set(["text", "email", "tel", "currency", "date", "number", "confirm", "select"]);

export interface LLMStructuredOutput {
  title?: string;
  tasks?: Array<{
    description: string;
    detail: string;
    type: "agent" | "user";
    dueDate?: string;
    dataNeeded?: string[];
    options?: Array<{ value: string; label: string }>;
    fields?: LLMTaskField[];
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

      if (Array.isArray(task.options)) {
        const validOptions = task.options
          .filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null)
          .filter((o) => typeof o.value === "string" && typeof o.label === "string"
            && o.value.toString().trim().length > 0 && o.label.toString().trim().length > 0)
          .slice(0, 5)
          .map((o) => ({ value: String(o.value).trim(), label: String(o.label).trim() }));
        if (validOptions.length > 0) {
          entry.options = validOptions;
        }
      }

      if (Array.isArray(task.fields)) {
        const validFields: LLMTaskField[] = [];
        for (const f of task.fields.slice(0, 8)) {
          if (typeof f !== "object" || f === null) continue;
          const field = f as Record<string, unknown>;
          const key = typeof field.key === "string" ? field.key.trim() : "";
          const label = typeof field.label === "string" ? field.label.trim() : "";
          const ftype = typeof field.type === "string" ? field.type.trim() : "";
          if (!key || !label || !VALID_FIELD_TYPES.has(ftype)) continue;
          const parsed: LLMTaskField = { key, label, type: ftype as LLMTaskField["type"] };
          if (typeof field.placeholder === "string") parsed.placeholder = field.placeholder.trim();
          if (typeof field.prefill === "string") parsed.prefill = field.prefill.trim();
          if (typeof field.required === "boolean") parsed.required = field.required;
          if (ftype === "select" && Array.isArray(field.options)) {
            const selOpts: Array<{ value: string; label: string }> = [];
            for (const so of field.options.slice(0, 6)) {
              if (typeof so !== "object" || so === null) continue;
              const sopt = so as Record<string, unknown>;
              const sv = typeof sopt.value === "string" ? sopt.value.trim() : "";
              const sl = typeof sopt.label === "string" ? sopt.label.trim() : "";
              if (sv && sl) selOpts.push({ value: sv, label: sl });
            }
            if (selOpts.length > 0) parsed.options = selOpts;
          }
          validFields.push(parsed);
        }
        if (validFields.length > 0) {
          entry.fields = validFields;
        }
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
