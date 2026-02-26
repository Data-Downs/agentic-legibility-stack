/**
 * CSV Enrichment — matches CDDO Top 75 service data to our graph services.
 *
 * The CDDO Top 75 provides ground-truth metadata that GOV.UK guidance pages
 * don't contain: interaction type, login requirements, data collected, etc.
 *
 * Data is embedded as a static map keyed by GOV.UK URL path.
 * If a CSV file is later made available, this module can be extended to parse it.
 */

import type { InteractionType } from "./interaction-types";

export interface CsvEnrichment {
  interactionType: InteractionType;
  behindLogin: boolean;
  eligibilityComplexity: "simple" | "mid" | "complex" | "qualitative";
  dataCollected: string[];
  actualServiceUrl?: string;
}

/**
 * Map from GOV.UK URL path (or full URL) → enrichment data.
 * Sourced from CDDO Top 75 government services research.
 */
const ENRICHMENT_DATA: Record<string, CsvEnrichment> = {
  // ── DVLA ──
  "/renew-driving-licence": {
    interactionType: "license",
    behindLogin: true,
    eligibilityComplexity: "simple",
    dataCollected: ["driving_licence_number", "national_insurance_number", "address", "photo"],
  },
  "/tax-your-vehicle": {
    interactionType: "payment_service",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: ["vehicle_reference", "document_reference"],
  },
  "/check-vehicle-tax": {
    interactionType: "informational_hub",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: ["vehicle_registration"],
  },
  "/get-vehicle-information-from-dvla": {
    interactionType: "informational_hub",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: ["vehicle_registration"],
  },
  "/apply-first-provisional-driving-licence": {
    interactionType: "application",
    behindLogin: true,
    eligibilityComplexity: "mid",
    dataCollected: ["identity_documents", "address", "national_insurance_number", "photo"],
  },
  "/change-address-driving-licence": {
    interactionType: "register",
    behindLogin: true,
    eligibilityComplexity: "simple",
    dataCollected: ["driving_licence_number", "new_address"],
  },

  // ── DWP ──
  "/apply-universal-credit": {
    interactionType: "application",
    behindLogin: true,
    eligibilityComplexity: "complex",
    dataCollected: ["national_insurance_number", "bank_details", "housing_costs", "income", "employment_status"],
  },
  "/state-pension": {
    interactionType: "portal",
    behindLogin: true,
    eligibilityComplexity: "mid",
    dataCollected: ["national_insurance_number", "date_of_birth"],
  },
  "/pip": {
    interactionType: "application",
    behindLogin: true,
    eligibilityComplexity: "complex",
    dataCollected: ["medical_conditions", "daily_living_needs", "mobility_needs", "gp_details"],
  },
  "/carers-allowance": {
    interactionType: "application",
    behindLogin: true,
    eligibilityComplexity: "complex",
    dataCollected: ["care_recipient_details", "hours_caring", "income", "bank_details"],
  },
  "/attendance-allowance": {
    interactionType: "application",
    behindLogin: false,
    eligibilityComplexity: "complex",
    dataCollected: ["medical_conditions", "care_needs", "gp_details"],
  },
  "/child-benefit": {
    interactionType: "application",
    behindLogin: false,
    eligibilityComplexity: "mid",
    dataCollected: ["child_details", "birth_certificate", "bank_details", "national_insurance_number"],
  },

  // ── HMRC ──
  "/self-assessment-tax-returns": {
    interactionType: "payment_service",
    behindLogin: true,
    eligibilityComplexity: "complex",
    dataCollected: ["income_details", "expenses", "national_insurance_number", "utr"],
  },
  "/check-national-insurance-record": {
    interactionType: "portal",
    behindLogin: true,
    eligibilityComplexity: "simple",
    dataCollected: ["national_insurance_number"],
  },
  "/check-income-tax-current-year": {
    interactionType: "portal",
    behindLogin: true,
    eligibilityComplexity: "simple",
    dataCollected: ["national_insurance_number"],
  },

  // ── HMPO ──
  "/apply-renew-passport": {
    interactionType: "application",
    behindLogin: true,
    eligibilityComplexity: "mid",
    dataCollected: ["identity_documents", "photo", "countersignatory", "old_passport"],
  },

  // ── Home Office / UKVI ──
  "/check-uk-visa": {
    interactionType: "informational_hub",
    behindLogin: false,
    eligibilityComplexity: "qualitative",
    dataCollected: ["nationality", "purpose_of_visit"],
  },
  "/apply-to-come-to-the-uk": {
    interactionType: "application",
    behindLogin: true,
    eligibilityComplexity: "complex",
    dataCollected: ["passport", "biometrics", "financial_evidence", "sponsor_details"],
  },
  "/settled-status-eu-citizens-families": {
    interactionType: "application",
    behindLogin: true,
    eligibilityComplexity: "complex",
    dataCollected: ["identity_documents", "proof_of_residence", "national_insurance_number"],
  },

  // ── GRO ──
  "/register-birth": {
    interactionType: "register",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: ["parents_details", "birth_details", "address"],
  },
  "/register-a-death": {
    interactionType: "register",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: ["deceased_details", "cause_of_death", "informant_details"],
  },

  // ── DVSA ──
  "/book-driving-test": {
    interactionType: "appointment_booker",
    behindLogin: true,
    eligibilityComplexity: "simple",
    dataCollected: ["provisional_licence_number", "theory_test_pass"],
  },
  "/book-theory-test": {
    interactionType: "appointment_booker",
    behindLogin: true,
    eligibilityComplexity: "simple",
    dataCollected: ["provisional_licence_number"],
  },

  // ── MOJ ──
  "/apply-for-probate": {
    interactionType: "application",
    behindLogin: true,
    eligibilityComplexity: "mid",
    dataCollected: ["death_certificate", "will", "estate_value", "applicant_details"],
  },
  "/get-a-divorce": {
    interactionType: "application",
    behindLogin: true,
    eligibilityComplexity: "mid",
    dataCollected: ["marriage_certificate", "spouse_details", "grounds"],
  },

  // ── Student Finance ──
  "/student-finance": {
    interactionType: "portal",
    behindLogin: true,
    eligibilityComplexity: "complex",
    dataCollected: ["university_details", "household_income", "bank_details"],
  },

  // ── Local Gov / Council Tax ──
  "/council-tax": {
    interactionType: "payment_service",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: ["property_address", "bank_details"],
  },

  // ── DfE / Teaching ──
  "/get-into-teaching": {
    interactionType: "informational_hub",
    behindLogin: false,
    eligibilityComplexity: "qualitative",
    dataCollected: [],
  },

  // ── Electoral ──
  "/register-to-vote": {
    interactionType: "register",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: ["name", "address", "date_of_birth", "national_insurance_number", "nationality"],
  },

  // ── Environment Agency ──
  "/fishing-licences": {
    interactionType: "license",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: ["name", "date_of_birth", "address"],
    actualServiceUrl: "https://get-fishing-licence.service.gov.uk",
  },

  // ── NHS ──
  "/nhs-login": {
    interactionType: "portal",
    behindLogin: true,
    eligibilityComplexity: "simple",
    dataCollected: ["nhs_number", "date_of_birth"],
  },

  // ── Companies House ──
  "/set-up-limited-company": {
    interactionType: "task_list",
    behindLogin: true,
    eligibilityComplexity: "mid",
    dataCollected: ["company_name", "directors", "shareholders", "registered_address"],
  },

  // ── FCDO ──
  "/foreign-travel-advice": {
    interactionType: "informational_hub",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: [],
  },

  // ── Prison visits ──
  "/prison-visits": {
    interactionType: "appointment_booker",
    behindLogin: true,
    eligibilityComplexity: "mid",
    dataCollected: ["prisoner_number", "visitor_details", "relationship"],
  },

  // ── DfT ──
  "/check-mot-status": {
    interactionType: "informational_hub",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: ["vehicle_registration"],
  },
  "/check-mot-history": {
    interactionType: "informational_hub",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: ["vehicle_registration"],
  },

  // ── Blue Badge ──
  "/apply-blue-badge": {
    interactionType: "application",
    behindLogin: false,
    eligibilityComplexity: "complex",
    dataCollected: ["medical_conditions", "mobility_assessment", "photo", "proof_of_address"],
  },

  // ── Tell Us Once ──
  "/after-a-death/organisations-you-need-to-contact-and-டell-us-once": {
    interactionType: "register",
    behindLogin: true,
    eligibilityComplexity: "simple",
    dataCollected: ["death_certificate_reference", "deceased_details"],
  },
  "/after-a-death": {
    interactionType: "task_list",
    behindLogin: false,
    eligibilityComplexity: "simple",
    dataCollected: [],
  },

  // ── HMRC Tax Credits ──
  "/tax-credits": {
    interactionType: "application",
    behindLogin: true,
    eligibilityComplexity: "complex",
    dataCollected: ["income", "children", "childcare_costs", "working_hours"],
  },
};

/**
 * Look up CSV enrichment for a service by its govuk_url.
 * Tries exact path match, then falls back to partial match.
 */
export function getEnrichment(govukUrl: string | null | undefined): CsvEnrichment | null {
  if (!govukUrl) return null;

  // Extract path from full URL
  let path: string;
  try {
    const url = new URL(govukUrl);
    path = url.pathname;
  } catch {
    path = govukUrl.startsWith("/") ? govukUrl : `/${govukUrl}`;
  }

  // Remove trailing slash
  path = path.replace(/\/$/, "");

  // Exact match
  if (ENRICHMENT_DATA[path]) return ENRICHMENT_DATA[path];

  // Try first path segment (e.g. /pip/how-to-claim → /pip)
  const firstSegment = "/" + path.split("/").filter(Boolean)[0];
  if (ENRICHMENT_DATA[firstSegment]) return ENRICHMENT_DATA[firstSegment];

  return null;
}

/**
 * Build a map of serviceId → enrichment for all services that have matches.
 */
export function buildEnrichmentMap(
  services: Array<{ id: string; govukUrl?: string | null }>
): Map<string, CsvEnrichment> {
  const map = new Map<string, CsvEnrichment>();
  for (const svc of services) {
    const enrichment = getEnrichment(svc.govukUrl);
    if (enrichment) {
      map.set(svc.id, enrichment);
    }
  }
  return map;
}
