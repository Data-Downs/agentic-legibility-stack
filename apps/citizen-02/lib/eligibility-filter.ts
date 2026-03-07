/**
 * Persona-aware eligibility filtering for life event services.
 *
 * Given a service's eligibility metadata and a persona's data, determines
 * whether the persona is clearly ineligible. Conservative: only excludes
 * when there's a clear mismatch. Unknown → eligible.
 */

import type { EligibilityInfo } from "@als/service-graph";

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

/** Extract a numeric value from text near given keywords (e.g. "income up to £80,000" → 80000) */
export function extractNumberFromText(text: string, keywords: string[]): number | null {
  const lower = text.toLowerCase();
  if (!keywords.some((kw) => lower.includes(kw.toLowerCase()))) return null;
  // Match £-prefixed numbers with optional commas (e.g. £80,000 or £450000)
  const match = lower.match(/£([\d,]+)/);
  if (!match) return null;
  return parseInt(match[1].replace(/,/g, ""), 10) || null;
}

/** Calculate age from a date-of-birth string */
export function getPersonaAge(personaData: Record<string, unknown>): number | null {
  const dob =
    (personaData.primaryContact as Record<string, unknown> | undefined)?.dateOfBirth ??
    personaData.date_of_birth ??
    personaData.dateOfBirth;
  if (typeof dob !== "string") return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/** Check whether the persona owns property */
function personaOwnsProperty(personaData: Record<string, unknown>): boolean {
  const financials = personaData.financials as Record<string, unknown> | undefined;
  const properties = financials?.properties as unknown[] | undefined;
  if (properties && properties.length > 0) return true;
  const address = personaData.address as Record<string, unknown> | undefined;
  const housingStatus = address?.housingStatus as string | undefined;
  if (housingStatus && /own/i.test(housingStatus)) return true;
  const housing = personaData.housing as Record<string, unknown> | undefined;
  if (housing?.type && /owner/i.test(housing.type as string)) return true;
  return false;
}

/** Get household income from persona data */
function getHouseholdIncome(personaData: Record<string, unknown>): number | null {
  const financials = personaData.financials as Record<string, unknown> | undefined;
  if (financials?.combinedAnnualIncome) return financials.combinedAnnualIncome as number;
  if (typeof personaData.income === "number") return personaData.income;
  const emp = personaData.employment as Record<string, unknown> | undefined;
  if (emp?.annualIncome) return emp.annualIncome as number;
  return null;
}

/**
 * Check a persona's eligibility for a service based on structured eligibility metadata.
 *
 * Conservative: only returns ineligible when there's a clear data-driven mismatch.
 */
export function checkPersonaEligibility(
  eligibility: EligibilityInfo,
  personaData: Record<string, unknown>,
): EligibilityResult {
  // 1. Universal services are always eligible
  if (eligibility.universal) {
    return { eligible: true };
  }

  // 2. Check exclusions
  if (eligibility.exclusions) {
    for (const exclusion of eligibility.exclusions) {
      const lower = exclusion.toLowerCase();
      if (
        (lower.includes("existing homeowner") ||
          lower.includes("previously owned property") ||
          lower.includes("not available to existing property owner")) &&
        personaOwnsProperty(personaData)
      ) {
        return { eligible: false, reason: `Excluded: ${exclusion}` };
      }
    }
  }

  // 3. Per-factor criteria checks
  for (const criterion of eligibility.criteria) {
    const descLower = criterion.description.toLowerCase();

    switch (criterion.factor) {
      case "property": {
        if (
          (descLower.includes("first-time buyer") || descLower.includes("first home")) &&
          personaOwnsProperty(personaData)
        ) {
          return { eligible: false, reason: "Requires first-time buyer status but persona owns property" };
        }
        break;
      }

      case "age": {
        const age = getPersonaAge(personaData);
        if (age === null) break;
        // Check "under X" pattern
        const underMatch = descLower.match(/under (\d+)/);
        if (underMatch && age >= parseInt(underMatch[1], 10)) {
          return { eligible: false, reason: `Age ${age} exceeds upper limit of ${underMatch[1]}` };
        }
        // Check "before age X" pattern (e.g. "opened before age 40")
        const beforeAgeMatch = descLower.match(/before age (\d+)/);
        if (beforeAgeMatch) {
          // This is about when they opened/started, not current age — can't determine, skip
          break;
        }
        // Check "aged X to Y" or "between X and Y"
        const rangeMatch = descLower.match(/aged? (\d+)\s*(?:to|-)\s*(\d+)/);
        if (rangeMatch) {
          const lo = parseInt(rangeMatch[1], 10);
          const hi = parseInt(rangeMatch[2], 10);
          if (age < lo || age > hi) {
            return { eligible: false, reason: `Age ${age} outside range ${lo}-${hi}` };
          }
        }
        break;
      }

      case "income": {
        if (!eligibility.means_tested) break;
        const threshold = extractNumberFromText(criterion.description, ["income", "earning"]);
        if (threshold === null) break;
        const income = getHouseholdIncome(personaData);
        if (income === null) break;
        if (income > threshold) {
          return { eligible: false, reason: `Household income £${income.toLocaleString()} exceeds threshold £${threshold.toLocaleString()}` };
        }
        break;
      }

      case "asset": {
        const savingsThreshold = extractNumberFromText(criterion.description, ["saving", "asset", "capital"]);
        if (savingsThreshold === null) break;
        const savings = personaData.savings as number | undefined;
        if (savings !== undefined && savings > savingsThreshold) {
          return { eligible: false, reason: `Savings £${savings.toLocaleString()} exceed threshold £${savingsThreshold.toLocaleString()}` };
        }
        break;
      }

      // Conservative default: don't filter on factors we can't reliably check
      default:
        break;
    }
  }

  // 4. Default: eligible (conservative)
  return { eligible: true };
}
