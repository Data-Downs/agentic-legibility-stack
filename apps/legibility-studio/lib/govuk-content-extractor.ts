/**
 * GOV.UK Content Extractor
 *
 * Takes a govuk_url → extracts path → calls GovukContentAdapter →
 * returns clean text with section structure.
 *
 * Handles multi-page guides (details.parts[]) and single-page answers (details.body).
 */

import { getGovukContentAdapter } from "./adapter-init";
import type { GovukContentOutput } from "@als/adapters";

export interface ExtractedContent {
  title: string;
  description: string;
  documentType: string;
  sections: Array<{ heading: string; body: string }>;
  fullText: string;
}

/**
 * Strip HTML tags from a string, preserving text content.
 * Also normalises whitespace.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n## $1\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract path from a GOV.UK URL.
 */
function extractPath(govukUrl: string): string {
  try {
    const url = new URL(govukUrl);
    return url.pathname;
  } catch {
    return govukUrl.startsWith("/") ? govukUrl : `/${govukUrl}`;
  }
}

/**
 * Fetch and extract content from a GOV.UK page.
 */
export async function extractGovukContent(
  govukUrl: string
): Promise<ExtractedContent | null> {
  const adapter = getGovukContentAdapter();
  const path = extractPath(govukUrl);

  const result = await adapter.execute({
    type: "govuk-content",
    input: { path },
  });

  if (!result.success || !result.output) {
    console.warn(`[GovukExtractor] Failed to fetch ${path}: ${result.error}`);
    return null;
  }

  const output = result.output as GovukContentOutput;
  const details = output.details || {};
  const sections: Array<{ heading: string; body: string }> = [];

  // Multi-page guide (e.g. /pip, /universal-credit)
  if (Array.isArray(details.parts)) {
    for (const part of details.parts as Array<{ title: string; body: string; slug: string }>) {
      const body = stripHtml(part.body || "");
      if (body) {
        sections.push({ heading: part.title || part.slug, body });
      }
    }
  }

  // Single-page with body (e.g. /register-birth, transaction pages)
  if (details.body && typeof details.body === "string") {
    const body = stripHtml(details.body);
    if (body) {
      sections.push({ heading: "Overview", body });
    }
  }

  // Transaction pages with introductory_paragraph
  if (details.introductory_paragraph && typeof details.introductory_paragraph === "string") {
    const body = stripHtml(details.introductory_paragraph);
    if (body && !sections.some((s) => s.body.includes(body.slice(0, 50)))) {
      sections.unshift({ heading: "Introduction", body });
    }
  }

  // More information section
  if (details.more_information && typeof details.more_information === "string") {
    const body = stripHtml(details.more_information);
    if (body) {
      sections.push({ heading: "More information", body });
    }
  }

  // External related links (useful for understanding scope)
  if (details.external_related_links && Array.isArray(details.external_related_links)) {
    const links = (details.external_related_links as Array<{ title: string; url: string }>)
      .map((l) => `- ${l.title}: ${l.url}`)
      .join("\n");
    if (links) {
      sections.push({ heading: "Related links", body: links });
    }
  }

  // If no sections extracted, fall back to description
  if (sections.length === 0 && output.description) {
    sections.push({ heading: "Overview", body: output.description });
  }

  const fullText = sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");

  return {
    title: output.title,
    description: output.description,
    documentType: output.documentType,
    sections,
    fullText,
  };
}
