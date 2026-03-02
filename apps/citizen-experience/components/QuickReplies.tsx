"use client";

interface QuickRepliesProps {
  messageText: string;
  onSelect: (reply: string) => void;
  disabled?: boolean;
}

/**
 * Detects choice patterns in assistant messages and renders them as
 * tappable quick-reply buttons. Detects:
 *
 *   1. Bulleted bold:   - **Option text** (explanation)
 *   2. Numbered bold:   1. **Option text** — explanation
 *   3. Paragraph bold:  **Option text** is for people who...
 *
 * Only triggers when 2+ choices are found AND the message ends with
 * a question (so we don't render buttons for regular bold text).
 */
function extractChoices(text: string): string[] {
  const lines = text.split("\n");
  const choices: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern 1: Bulleted/numbered → **bold text**
    const bulletMatch = trimmed.match(
      /^(?:[-*•]|\d+\.)\s*\*\*(.+?)\*\*/
    );
    if (bulletMatch) {
      choices.push(bulletMatch[1].trim());
      continue;
    }

    // Pattern 2: Line starts with **bold text** (paragraph-style options)
    const paragraphMatch = trimmed.match(
      /^\*\*(.+?)\*\*/
    );
    if (paragraphMatch) {
      const label = paragraphMatch[1].trim();
      // Skip if it looks like a heading or very short emphasis (e.g., "Note:")
      if (label.length >= 3 && !label.endsWith(":")) {
        choices.push(label);
      }
    }
  }

  if (choices.length < 2) return [];

  // Only show quick replies if the message contains a question near the end
  // (last 5 non-empty lines). This avoids false positives on messages that
  // just happen to bold a few terms without presenting choices.
  const nonEmpty = lines.filter(l => l.trim());
  const tail = nonEmpty.slice(-5);
  const hasQuestion = tail.some(l => l.includes("?"));
  if (!hasQuestion) return [];

  return choices;
}

export function QuickReplies({ messageText, onSelect, disabled }: QuickRepliesProps) {
  const choices = extractChoices(messageText);

  if (choices.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 max-w-[85%]">
      {choices.map((choice, i) => (
        <button
          key={i}
          onClick={() => onSelect(choice)}
          disabled={disabled}
          className="text-sm font-medium text-govuk-blue bg-white border border-blue-300
                     px-4 py-2.5 rounded-full hover:bg-blue-50 hover:border-blue-400
                     active:bg-blue-100 transition-colors disabled:opacity-50
                     disabled:cursor-not-allowed text-left"
        >
          {choice}
        </button>
      ))}
    </div>
  );
}

export { extractChoices };
