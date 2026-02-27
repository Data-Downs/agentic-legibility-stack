/**
 * Embedded full-artefact service data.
 *
 * These are the 4 services with complete manifest/policy/state-model/consent
 * artefacts from data/services/. They are embedded here so they can be seeded
 * on Cloudflare Workers where filesystem access is unavailable.
 *
 * Each entry includes a graphId mapping — when the manifest ID differs from
 * the graph node ID, the graphId is used as the DB primary key so the full
 * entry replaces the graph-only entry during seeding.
 */

export interface FullServiceData {
  /** Directory name (e.g. "apply-universal-credit") */
  dirName: string;
  /** Graph node ID to replace, or null if no graph equivalent */
  graphId: string | null;
  manifest: Record<string, unknown>;
  policy: Record<string, unknown>;
  stateModel: Record<string, unknown>;
  consent: Record<string, unknown>;
}

export const FULL_SERVICES: FullServiceData[] = [
  {
    dirName: "apply-universal-credit",
    graphId: "dwp-universal-credit",
    manifest: {
      id: "dwp.apply-universal-credit",
      version: "1.0.0",
      name: "Apply for Universal Credit",
      description: "Apply for Universal Credit — income-related benefit for working-age people",
      department: "DWP",
      jurisdiction: "England, Wales, Scotland",
      input_schema: {
        type: "object",
        properties: {
          national_insurance_number: { type: "string" },
          date_of_birth: { type: "string", format: "date" },
          housing_status: { type: "string" },
          employment_status: { type: "string" },
          household_income: { type: "number" },
          household_members: { type: "array" },
          bank_details: { type: "object" },
        },
        required: ["national_insurance_number", "date_of_birth"],
      },
      output_schema: {
        type: "object",
        properties: {
          claim_reference: { type: "string" },
          journal_url: { type: "string" },
          first_payment_date: { type: "string", format: "date" },
          estimated_amount: { type: "number" },
        },
      },
      constraints: {
        sla: "5 weeks to first payment",
        availability: "24/7 online",
      },
      eligibility_ruleset_id: "dwp.universal-credit.eligibility",
      consent_requirements: ["identity-verification", "income-sharing", "housing-status"],
      evidence_requirements: ["identity-verified", "bank-account-verified"],
      redress: {
        complaint_url: "https://www.gov.uk/government/organisations/department-for-work-pensions/about/complaints-procedure",
        appeal_process: "Mandatory reconsideration, then appeal to tribunal",
        ombudsman: "Parliamentary and Health Service Ombudsman",
      },
      audit_requirements: {
        retention_period: "6 years after claim ends",
        data_controller: "DWP",
        lawful_basis: "Legal obligation",
      },
      handoff: {
        escalation_phone: "0800 328 5644",
        opening_hours: "Mon-Fri 8am-6pm",
        department_queue: "new-claims",
      },
      promoted: true,
    },
    policy: {
      id: "dwp.universal-credit.eligibility",
      version: "1.0.0",
      rules: [
        {
          id: "age-range",
          description: "Applicant must be 18 or over and under State Pension age",
          condition: { field: "age", operator: ">=", value: 18 },
          reason_if_failed: "You must be at least 18 to claim Universal Credit",
          evidence_source: "identity-verified",
        },
        {
          id: "under-pension-age",
          description: "Applicant must be under State Pension age",
          condition: { field: "age", operator: "<=", value: 66 },
          reason_if_failed: "You are at or over State Pension age. You may be eligible for Pension Credit instead.",
          alternative_service: "dwp.pension-credit",
        },
        {
          id: "uk-resident",
          description: "Applicant must be living in the UK",
          condition: { field: "jurisdiction", operator: "in", value: ["England", "Wales", "Scotland"] },
          reason_if_failed: "You must live in England, Scotland, or Wales to claim Universal Credit",
        },
        {
          id: "low-savings",
          description: "Applicant's savings must be under £16,000",
          condition: { field: "savings", operator: "<=", value: 16000 },
          reason_if_failed: "Your savings exceed £16,000. You are not eligible for Universal Credit.",
        },
        {
          id: "has-bank-account",
          description: "Applicant must have a bank account for payments",
          condition: { field: "bank_account", operator: "exists" },
          reason_if_failed: "You need a bank, building society, or credit union account to receive UC payments",
        },
      ],
      explanation_template: "Universal Credit eligibility: {outcome}",
      edge_cases: [
        {
          id: "domestic-abuse",
          description: "Applicant mentions domestic abuse or coercive control",
          detection: "safeguarding_flag",
          action: "Immediate handoff to specialist support. Do not continue automated process.",
        },
        {
          id: "homeless",
          description: "Applicant has no fixed address",
          detection: "no_fixed_address",
          action: "Can still apply. Link with Jobcentre Plus for address support.",
        },
        {
          id: "self-employed",
          description: "Applicant is self-employed",
          detection: "self_employed",
          action: "Minimum income floor may apply after 12 months. Additional evidence required.",
        },
      ],
    },
    stateModel: {
      id: "dwp.universal-credit.states",
      version: "1.0.0",
      states: [
        { id: "not-started", type: "initial" },
        { id: "identity-verified" },
        { id: "eligibility-checked" },
        { id: "consent-given" },
        { id: "personal-details-collected" },
        { id: "housing-details-collected" },
        { id: "income-details-collected" },
        { id: "bank-details-verified" },
        { id: "claim-submitted", receipt: true },
        { id: "awaiting-interview" },
        { id: "claim-active", type: "terminal", receipt: true },
        { id: "rejected", type: "terminal", receipt: true },
        { id: "handed-off", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
        { from: "not-started", to: "eligibility-checked", trigger: "check-eligibility" },
        { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
        { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent", condition: "eligible" },
        { from: "eligibility-checked", to: "rejected", trigger: "reject", condition: "not-eligible" },
        { from: "eligibility-checked", to: "handed-off", trigger: "handoff", condition: "edge-case" },
        { from: "consent-given", to: "personal-details-collected", trigger: "collect-personal-details" },
        { from: "personal-details-collected", to: "housing-details-collected", trigger: "collect-housing-details" },
        { from: "housing-details-collected", to: "income-details-collected", trigger: "collect-income-details" },
        { from: "income-details-collected", to: "bank-details-verified", trigger: "verify-bank-details" },
        { from: "bank-details-verified", to: "claim-submitted", trigger: "submit-claim" },
        { from: "claim-submitted", to: "awaiting-interview", trigger: "schedule-interview" },
        { from: "awaiting-interview", to: "claim-active", trigger: "activate-claim" },
        { from: "awaiting-interview", to: "rejected", trigger: "reject-after-interview" },
      ],
    },
    consent: {
      id: "dwp.universal-credit.consent",
      version: "1.0.0",
      grants: [
        {
          id: "identity-verification",
          description: "Verify your identity using GOV.UK One Login",
          data_shared: ["full_name", "date_of_birth", "national_insurance_number"],
          source: "one-login",
          purpose: "DWP must verify your identity before processing your claim",
          duration: "session",
          required: true,
        },
        {
          id: "income-sharing",
          description: "Share your income and employment information with DWP",
          data_shared: ["employment_status", "employer_name", "income_amount", "income_frequency"],
          source: "hmrc-rti",
          purpose: "DWP uses your income data to calculate your Universal Credit entitlement",
          duration: "until-revoked",
          required: true,
        },
        {
          id: "housing-status",
          description: "Share your housing details for housing cost calculations",
          data_shared: ["tenure_type", "rent_amount", "landlord_name", "property_address"],
          source: "citizen-provided",
          purpose: "To calculate any housing element of your Universal Credit",
          duration: "until-revoked",
          required: true,
        },
        {
          id: "bank-account-verification",
          description: "Verify your bank account for receiving payments",
          data_shared: ["sort_code", "account_number", "account_holder_name"],
          source: "citizen-provided",
          purpose: "UC payments will be made to this account",
          duration: "until-revoked",
          required: true,
        },
      ],
      revocation: {
        mechanism: "Contact DWP UC helpline or revoke through your UC journal online",
        effect: "Revoking income-sharing consent will suspend your claim until reinstated",
      },
      delegation: {
        agent_identity: "GOV.UK AI Agent",
        scopes: ["read-personal-data", "submit-to-dwp", "check-eligibility"],
        limitations: "Agent cannot verify bank details on your behalf. Agent cannot commit to interview times. Agent will hand off for any safeguarding concerns.",
      },
    },
  },
  {
    dirName: "check-state-pension",
    graphId: "dwp-state-pension",
    manifest: {
      id: "dwp.check-state-pension",
      version: "1.0.0",
      name: "Check State Pension Forecast",
      description: "Check your State Pension forecast — see how much you could get and when",
      department: "DWP",
      jurisdiction: "England, Wales, Scotland",
      input_schema: {
        type: "object",
        properties: {
          national_insurance_number: { type: "string" },
          date_of_birth: { type: "string", format: "date" },
        },
        required: ["national_insurance_number"],
      },
      output_schema: {
        type: "object",
        properties: {
          forecast_amount_weekly: { type: "number" },
          state_pension_age: { type: "number" },
          state_pension_date: { type: "string", format: "date" },
          qualifying_years: { type: "number" },
          years_to_contribute: { type: "number" },
        },
      },
      constraints: {
        sla: "Immediate (read-only lookup)",
        availability: "24/7 online",
      },
      eligibility_ruleset_id: "dwp.state-pension.eligibility",
      consent_requirements: ["identity-verification"],
      evidence_requirements: ["identity-verified"],
      redress: {
        complaint_url: "https://www.gov.uk/government/organisations/department-for-work-pensions/about/complaints-procedure",
        appeal_process: "Contact the Pension Service",
        ombudsman: "Parliamentary and Health Service Ombudsman",
      },
      audit_requirements: {
        retention_period: "1 year",
        data_controller: "DWP",
        lawful_basis: "Public task",
      },
      handoff: {
        escalation_phone: "0800 731 0469",
        opening_hours: "Mon-Fri 8am-6pm",
        department_queue: "pension-enquiries",
      },
    },
    policy: {
      id: "dwp.state-pension.eligibility",
      version: "1.0.0",
      rules: [
        {
          id: "has-ni-number",
          description: "Citizen must have a National Insurance number",
          condition: { field: "national_insurance_number", operator: "exists" },
          reason_if_failed: "You need a National Insurance number to check your State Pension forecast",
        },
        {
          id: "uk-ni-record",
          description: "Citizen must have UK National Insurance contributions",
          condition: { field: "jurisdiction", operator: "in", value: ["England", "Wales", "Scotland"] },
          reason_if_failed: "State Pension forecasts are based on UK National Insurance contributions",
        },
      ],
      explanation_template: "State Pension forecast eligibility: {outcome}",
      edge_cases: [
        {
          id: "lived-abroad",
          description: "Citizen has lived or worked abroad",
          detection: "overseas_work_history",
          action: "May have contributions from other countries. Check reciprocal agreements.",
        },
        {
          id: "contracted-out",
          description: "Citizen was contracted out of additional State Pension",
          detection: "contracted_out",
          action: "Contracted-out deductions may apply. Show adjusted forecast.",
        },
      ],
    },
    stateModel: {
      id: "dwp.state-pension.states",
      version: "1.0.0",
      states: [
        { id: "not-started", type: "initial" },
        { id: "identity-verified" },
        { id: "eligibility-checked" },
        { id: "consent-given" },
        { id: "forecast-retrieved", receipt: true },
        { id: "completed", type: "terminal", receipt: true },
        { id: "handed-off", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
        { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
        { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent" },
        { from: "eligibility-checked", to: "handed-off", trigger: "handoff", condition: "edge-case" },
        { from: "consent-given", to: "forecast-retrieved", trigger: "retrieve-forecast" },
        { from: "forecast-retrieved", to: "completed", trigger: "complete" },
      ],
    },
    consent: {
      id: "dwp.state-pension.consent",
      version: "1.0.0",
      grants: [
        {
          id: "identity-verification",
          description: "Verify your identity to access your pension record",
          data_shared: ["full_name", "date_of_birth", "national_insurance_number"],
          source: "one-login",
          purpose: "DWP must verify your identity before showing your pension forecast",
          duration: "session",
          required: true,
        },
      ],
      revocation: {
        mechanism: "Session-based — consent expires when you close the session",
        effect: "No ongoing data sharing. Forecast data is not stored.",
      },
      delegation: {
        agent_identity: "GOV.UK AI Agent",
        scopes: ["read-personal-data", "read-pension-forecast"],
        limitations: "Agent can only read your forecast. It cannot make changes to your pension record or National Insurance contributions.",
      },
    },
  },
  {
    dirName: "renew-driving-licence",
    graphId: null, // No matching graph node
    manifest: {
      id: "dvla.renew-driving-licence",
      version: "1.0.0",
      name: "Renew Driving Licence",
      description: "Renew a full UK driving licence (photocard)",
      department: "DVLA",
      jurisdiction: "England, Wales, Scotland",
      input_schema: {
        type: "object",
        properties: {
          driving_licence_number: { type: "string" },
          national_insurance_number: { type: "string" },
          addresses_last_3_years: { type: "array" },
          photo: { type: "string", format: "uri" },
        },
        required: ["driving_licence_number"],
      },
      output_schema: {
        type: "object",
        properties: {
          application_reference: { type: "string" },
          expected_delivery_date: { type: "string", format: "date" },
          fee_charged: { type: "number" },
        },
      },
      constraints: {
        sla: "10 working days",
        fee: { amount: 14, currency: "GBP" },
        availability: "24/7 online",
      },
      eligibility_ruleset_id: "dvla.renew-licence.eligibility",
      consent_requirements: ["identity-verification", "photo-sharing", "address-confirmation"],
      evidence_requirements: ["driving-licence-credential", "identity-verified"],
      redress: {
        complaint_url: "https://www.gov.uk/complain-about-dvla",
        appeal_process: "Contact DVLA directly",
        ombudsman: "Parliamentary and Health Service Ombudsman",
      },
      audit_requirements: {
        retention_period: "7 years",
        data_controller: "DVLA",
        lawful_basis: "Public task",
      },
      handoff: {
        escalation_phone: "0300 790 6801",
        opening_hours: "Mon-Fri 8am-7pm, Sat 8am-2pm",
        department_queue: "licence-renewals",
      },
      promoted: true,
    },
    policy: {
      id: "dvla.renew-licence.eligibility",
      version: "1.0.0",
      rules: [
        {
          id: "age-minimum",
          description: "Applicant must be at least 16 years old",
          condition: { field: "age", operator: ">=", value: 16 },
          reason_if_failed: "You must be at least 16 years old to hold a driving licence",
          evidence_source: "identity-verified",
        },
        {
          id: "has-licence",
          description: "Applicant must have an existing driving licence",
          condition: { field: "driving_licence_number", operator: "exists" },
          reason_if_failed: "You need an existing driving licence to renew. Apply for a new licence instead.",
          alternative_service: "dvla.apply-provisional-licence",
        },
        {
          id: "uk-resident",
          description: "Applicant must be a UK resident",
          condition: { field: "jurisdiction", operator: "in", value: ["England", "Wales", "Scotland"] },
          reason_if_failed: "This service is for UK residents (England, Wales, Scotland) only",
        },
        {
          id: "not-revoked",
          description: "Licence must not be currently revoked",
          condition: { field: "licence_status", operator: "!=", value: "revoked" },
          reason_if_failed: "Your licence has been revoked. Contact DVLA for reinstatement.",
          triggers_handoff: true,
        },
      ],
      explanation_template: "Driving licence renewal eligibility: {outcome}",
      edge_cases: [
        {
          id: "medical-condition",
          description: "Applicant has a medical condition that may affect driving",
          detection: "medical_conditions",
          action: "Route to medical assessment. DVLA form C1 required.",
        },
        {
          id: "over-70",
          description: "Applicant is over 70 (different renewal cycle)",
          detection: "over_70",
          action: "Over-70 renewal is free but requires medical self-declaration.",
        },
      ],
    },
    stateModel: {
      id: "dvla.renew-licence.states",
      version: "1.0.0",
      states: [
        { id: "not-started", type: "initial" },
        { id: "identity-verified" },
        { id: "eligibility-checked" },
        { id: "consent-given" },
        { id: "details-confirmed" },
        { id: "photo-submitted" },
        { id: "payment-made", receipt: true },
        { id: "application-submitted", receipt: true },
        { id: "completed", type: "terminal", receipt: true },
        { id: "rejected", type: "terminal", receipt: true },
        { id: "handed-off", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "not-started", to: "identity-verified", trigger: "verify-identity" },
        { from: "identity-verified", to: "eligibility-checked", trigger: "check-eligibility" },
        { from: "eligibility-checked", to: "consent-given", trigger: "grant-consent", condition: "eligible" },
        { from: "eligibility-checked", to: "rejected", trigger: "reject", condition: "not-eligible" },
        { from: "eligibility-checked", to: "handed-off", trigger: "handoff", condition: "edge-case" },
        { from: "consent-given", to: "details-confirmed", trigger: "confirm-details" },
        { from: "details-confirmed", to: "photo-submitted", trigger: "submit-photo" },
        { from: "photo-submitted", to: "payment-made", trigger: "make-payment" },
        { from: "payment-made", to: "application-submitted", trigger: "submit-application" },
        { from: "application-submitted", to: "completed", trigger: "complete" },
      ],
    },
    consent: {
      id: "dvla.renew-licence.consent",
      version: "1.0.0",
      grants: [
        {
          id: "identity-verification",
          description: "Verify your identity using your GOV.UK One Login credentials",
          data_shared: ["full_name", "date_of_birth", "national_insurance_number"],
          source: "one-login",
          purpose: "To confirm you are who you say you are before processing the renewal",
          duration: "session",
          required: true,
        },
        {
          id: "photo-sharing",
          description: "Share your passport photo with DVLA for the new licence",
          data_shared: ["passport_photo"],
          source: "hmpo-passport-office",
          purpose: "DVLA will use your most recent passport photo for the new licence card",
          duration: "session",
          required: true,
        },
        {
          id: "address-confirmation",
          description: "Confirm your current address for the licence and DVLA records",
          data_shared: ["address_line_1", "address_line_2", "city", "postcode"],
          source: "citizen-provided",
          purpose: "The new licence will be posted to this address and it will appear on the licence",
          duration: "session",
          required: true,
        },
      ],
      revocation: {
        mechanism: "Contact DVLA or revoke through your GOV.UK account",
        effect: "Application will be cancelled if consent is revoked before completion",
      },
      delegation: {
        agent_identity: "GOV.UK AI Agent",
        scopes: ["read-personal-data", "submit-to-dvla"],
        limitations: "Agent cannot make payment on your behalf. Agent cannot change your address without your explicit confirmation.",
      },
    },
  },
  {
    dirName: "become-a-robot",
    graphId: null, // No matching graph node — fictional service
    manifest: {
      id: "department-of-interspecies-fun.become-a-robot",
      name: "Become A Robot",
      department: "Department of Interspecies Fun",
      description: "Let's you apply to be a robot",
      version: "1.0.0",
      jurisdiction: "England",
      input_schema: {
        type: "object",
        properties: {
          Name: { type: "string" },
          "Robot type": { type: "string" },
          Age: { type: "number" },
        },
      },
      output_schema: {
        type: "object",
        properties: {
          "Robot Label": { type: "string" },
        },
      },
      constraints: {
        sla: "1 working day",
        fee: { amount: 1000, currency: "GBP" },
        availability: "online",
      },
      redress: {
        complaint_url: "www.idontlikerobots.com",
        appeal_process: "email us",
        ombudsman: "Robotic Rights Comittee",
      },
      audit_requirements: {
        retention_period: "1000000 years",
        data_controller: "Yoda",
        lawful_basis: "Interstellar Law",
      },
      handoff: {
        escalation_phone: "0800 888 000",
        opening_hours: "Mon - Fri 9.00 - 9.01",
        department_queue: "Very Long",
      },
      promoted: true,
    },
    policy: {
      id: "",
      version: "1.0.0",
      rules: [
        {
          id: "rule-1",
          description: "Over 4",
          condition: { field: "age", operator: ">=", value: 4 },
          reason_if_failed: "Kids can't be robots",
        },
      ],
      explanation_template: "How to Apply",
      edge_cases: [
        {
          id: "edge-1",
          description: "If you are already a robot",
          action: "You can't become a robot again",
        },
      ],
    },
    stateModel: {
      id: "",
      version: "1.0.0",
      states: [
        { id: "Applying", type: "initial", receipt: true },
        { id: "Accepted", type: "terminal", receipt: true },
      ],
      transitions: [
        { from: "Applying", to: "Accepted", trigger: "accept-application" },
      ],
    },
    consent: {
      id: "",
      version: "1.0.0",
      grants: [
        {
          id: "grant-1",
          description: "Verify your identity using GOV.UK One Login",
          data_shared: ["Name"],
          source: "Details",
          purpose: "Check you exist",
          duration: "session",
          required: true,
        },
      ],
      revocation: {
        mechanism: "Contact the Department of Robotics or revoke through your GOV.UK account",
        effect: "Your robot transformation application will be cancelled and any scanned biometrics deleted",
      },
      delegation: {
        agent_identity: "GOV.UK AI Agent",
        scopes: ["read-personal-data", "submit-to-robotics-dept", "check-eligibility", "make payment"],
        limitations: "Agent cannot authorise the final neural upload. Agent cannot choose your robot chassis model without explicit confirmation",
      },
    },
  },
];
