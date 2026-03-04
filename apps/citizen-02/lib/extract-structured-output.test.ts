import { describe, it, expect } from "vitest";
import { extractStructuredOutput } from "./extract-structured-output";

describe("extractStructuredOutput", () => {
  it("returns null parsed and original text when no JSON block found", () => {
    const text = "Hello, this is a plain response with no JSON.";
    const result = extractStructuredOutput(text);
    expect(result.parsed).toBeNull();
    expect(result.cleanText).toBe(text);
  });

  it("extracts the last fenced JSON block and strips it from cleanText", () => {
    const text = [
      "Here is some text.",
      "```json",
      '{"title": "Test Title"}',
      "```",
      "More text after.",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed).not.toBeNull();
    expect(result.parsed!.title).toBe("Test Title");
    expect(result.cleanText).not.toContain("```json");
    expect(result.cleanText).toContain("Here is some text.");
    expect(result.cleanText).toContain("More text after.");
  });

  it("uses the last JSON block when multiple are present", () => {
    const text = [
      "```json",
      '{"title": "First"}',
      "```",
      "Middle text.",
      "```json",
      '{"title": "Second"}',
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.title).toBe("Second");
    // First block should remain in cleanText
    expect(result.cleanText).toContain("First");
  });

  it("returns parsed null but still strips block when JSON is malformed", () => {
    const text = [
      "Before.",
      "```json",
      "{not valid json!!!}",
      "```",
      "After.",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed).toBeNull();
    expect(result.cleanText).not.toContain("```json");
    expect(result.cleanText).toContain("Before.");
    expect(result.cleanText).toContain("After.");
  });

  it("caps tasks at 3", () => {
    const tasks = Array.from({ length: 5 }, (_, i) => ({
      description: `Task ${i}`,
      detail: `Detail ${i}`,
      type: "user",
    }));
    const text = [
      "Response.",
      "```json",
      JSON.stringify({ tasks }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.tasks).toHaveLength(3);
  });

  it("truncates description to 60 chars and detail to 150 chars", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "A".repeat(100),
          detail: "B".repeat(200),
          type: "agent",
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.tasks![0].description).toHaveLength(60);
    expect(result.parsed!.tasks![0].detail).toHaveLength(150);
  });

  it("validates dueDate format — accepts valid ISO date", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Do thing",
          detail: "Detail here",
          type: "user",
          dueDate: "2026-03-15",
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.tasks![0].dueDate).toBe("2026-03-15");
  });

  it("rejects invalid dueDate format", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Do thing",
          detail: "Detail here",
          type: "user",
          dueDate: "March 15",
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.tasks![0].dueDate).toBeUndefined();
  });

  it("filters non-string dataNeeded entries", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Do thing",
          detail: "Detail here",
          type: "user",
          dataNeeded: ["email", 42, "phone", "", null],
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.tasks![0].dataNeeded).toEqual(["email", "phone"]);
  });

  it("skips tasks with missing required fields", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [
          { description: "Valid", detail: "Detail", type: "agent" },
          { description: "", detail: "Detail", type: "user" },
          { description: "No type", detail: "Detail", type: "invalid" },
          { description: "No detail", detail: "", type: "user" },
        ],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.tasks).toHaveLength(1);
    expect(result.parsed!.tasks![0].description).toBe("Valid");
  });

  it("validates extractedFacts with defaults", () => {
    const text = [
      "```json",
      JSON.stringify({
        extractedFacts: [
          { key: "name", value: "Alice", confidence: "high", source_snippet: "She said Alice" },
          { key: "age", value: 30 }, // missing confidence → defaults to medium
          { key: "", value: "ignored" }, // empty key → skipped
          { key: "missing_value" }, // undefined value → skipped
        ],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.extractedFacts).toHaveLength(2);
    expect(result.parsed!.extractedFacts![0].confidence).toBe("high");
    expect(result.parsed!.extractedFacts![1].confidence).toBe("medium");
  });

  it("caps extractedFacts at 5", () => {
    const facts = Array.from({ length: 8 }, (_, i) => ({
      key: `fact${i}`,
      value: i,
      confidence: "high",
      source_snippet: "src",
    }));
    const text = [
      "```json",
      JSON.stringify({ extractedFacts: facts }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.extractedFacts).toHaveLength(5);
  });

  it("truncates source_snippet to 200 chars", () => {
    const text = [
      "```json",
      JSON.stringify({
        extractedFacts: [{
          key: "test",
          value: true,
          confidence: "low",
          source_snippet: "X".repeat(300),
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.extractedFacts![0].source_snippet).toHaveLength(200);
  });

  it("parses stateTransition", () => {
    const text = [
      "```json",
      JSON.stringify({ stateTransition: "  awaiting_evidence  " }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.stateTransition).toBe("awaiting_evidence");
  });

  it("ignores empty title and stateTransition", () => {
    const text = [
      "```json",
      JSON.stringify({ title: "  ", stateTransition: "" }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.title).toBeUndefined();
    expect(result.parsed!.stateTransition).toBeUndefined();
  });

  // ── Options parsing tests ──

  it("parses task options from JSON block", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Who is this for?",
          detail: "Choose a person",
          type: "user",
          options: [
            { value: "self", label: "Myself" },
            { value: "other", label: "Someone else" },
          ],
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.tasks![0].options).toEqual([
      { value: "self", label: "Myself" },
      { value: "other", label: "Someone else" },
    ]);
  });

  it("filters out invalid options (missing value or label)", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Pick one",
          detail: "Choose wisely",
          type: "user",
          options: [
            { value: "a", label: "Good" },
            { value: "", label: "Empty value" },
            { value: "b" },
            { label: "No value" },
            42,
            null,
            { value: "c", label: "Also good" },
          ],
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.tasks![0].options).toEqual([
      { value: "a", label: "Good" },
      { value: "c", label: "Also good" },
    ]);
  });

  it("caps options at 5", () => {
    const options = Array.from({ length: 8 }, (_, i) => ({
      value: `v${i}`,
      label: `Option ${i}`,
    }));
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Pick one",
          detail: "Choose wisely",
          type: "user",
          options,
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.tasks![0].options).toHaveLength(5);
  });

  // ── Fields parsing tests ──

  it("parses valid fields correctly", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Provide LISA details",
          detail: "Enter your LISA info",
          type: "user",
          fields: [
            { key: "account_holder", label: "Account holder", type: "text", prefill: "Thomas" },
            { key: "property_price", label: "Property price", type: "currency", placeholder: "350000" },
            { key: "first_time_buyer", label: "First-time buyer", type: "confirm" },
          ],
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    const fields = result.parsed!.tasks![0].fields!;
    expect(fields).toHaveLength(3);
    expect(fields[0]).toEqual({ key: "account_holder", label: "Account holder", type: "text", prefill: "Thomas" });
    expect(fields[1]).toEqual({ key: "property_price", label: "Property price", type: "currency", placeholder: "350000" });
    expect(fields[2]).toEqual({ key: "first_time_buyer", label: "First-time buyer", type: "confirm" });
  });

  it("caps fields at 8", () => {
    const fields = Array.from({ length: 12 }, (_, i) => ({
      key: `field_${i}`,
      label: `Field ${i}`,
      type: "text",
    }));
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Many fields",
          detail: "Too many fields",
          type: "user",
          fields,
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    expect(result.parsed!.tasks![0].fields).toHaveLength(8);
  });

  it("rejects fields with invalid type", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Bad fields",
          detail: "Invalid type",
          type: "user",
          fields: [
            { key: "valid", label: "Valid", type: "text" },
            { key: "invalid", label: "Invalid", type: "slider" },
            { key: "also_valid", label: "Also Valid", type: "email" },
          ],
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    const fields = result.parsed!.tasks![0].fields!;
    expect(fields).toHaveLength(2);
    expect(fields[0].key).toBe("valid");
    expect(fields[1].key).toBe("also_valid");
  });

  it("rejects fields missing key or label", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Bad fields",
          detail: "Missing props",
          type: "user",
          fields: [
            { key: "", label: "No key", type: "text" },
            { key: "no_label", label: "", type: "text" },
            { key: "valid", label: "Valid", type: "text" },
          ],
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    const fields = result.parsed!.tasks![0].fields!;
    expect(fields).toHaveLength(1);
    expect(fields[0].key).toBe("valid");
  });

  it("parses select field options", () => {
    const text = [
      "```json",
      JSON.stringify({
        tasks: [{
          description: "Choose provider",
          detail: "Select ISA provider",
          type: "user",
          fields: [
            {
              key: "provider",
              label: "ISA provider",
              type: "select",
              options: [
                { value: "hl", label: "Hargreaves Lansdown" },
                { value: "aj", label: "AJ Bell" },
              ],
            },
          ],
        }],
      }),
      "```",
    ].join("\n");
    const result = extractStructuredOutput(text);
    const field = result.parsed!.tasks![0].fields![0];
    expect(field.type).toBe("select");
    expect(field.options).toEqual([
      { value: "hl", label: "Hargreaves Lansdown" },
      { value: "aj", label: "AJ Bell" },
    ]);
  });
});
