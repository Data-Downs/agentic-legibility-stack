// ─── Field & Section Schema Types ───────────────────────────────────

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "boolean" | "textarea";
  options?: string[];
  optional?: boolean; // only show when value exists (otherwise always show)
  hint?: string;
  placeholder?: string;
}

export interface SubSectionDef {
  key: string;
  title: string;
  fields: FieldDef[];
}

export interface ObjectSectionSchema {
  kind: "object";
  key: string;
  title: string;
  fields: FieldDef[];
  subSections?: SubSectionDef[];
}

export interface ArraySectionSchema {
  kind: "array";
  key: string;
  title: string;
  itemLabel: string;
  fields: FieldDef[];
}

export type SectionSchema = ObjectSectionSchema | ArraySectionSchema;

// ─── Helper: default value for a field type ─────────────────────────

export function defaultForType(type: FieldDef["type"]): unknown {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "date":
      return "";
    case "select":
      return "";
    case "textarea":
      return "";
    default:
      return "";
  }
}

export function blankItem(fields: FieldDef[]): Record<string, unknown> {
  return Object.fromEntries(
    fields.filter((f) => !f.optional).map((f) => [f.key, defaultForType(f.type)])
  );
}

// ─── Credentials ────────────────────────────────────────────────────

export const credentialsSchema: ArraySectionSchema = {
  kind: "array",
  key: "credentials",
  title: "Credentials",
  itemLabel: "credential",
  fields: [
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        "driving-licence",
        "national-insurance",
        "proof-of-address",
        "passport",
      ],
    },
    { key: "issuer", label: "Issuer", type: "text" },
    { key: "number", label: "Number", type: "text" },
    { key: "issued", label: "Issued", type: "date" },
    { key: "expires", label: "Expires", type: "date", optional: true },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: ["valid", "expired", "pending", "revoked", "suspended"],
    },
  ],
};

// ─── Vehicles ───────────────────────────────────────────────────────

export const vehiclesSchema: ArraySectionSchema = {
  kind: "array",
  key: "vehicles",
  title: "Vehicles",
  itemLabel: "vehicle",
  fields: [
    { key: "make", label: "Make", type: "text" },
    { key: "model", label: "Model", type: "text" },
    { key: "year", label: "Year", type: "number" },
    { key: "color", label: "Colour", type: "text" },
    {
      key: "registrationNumber",
      label: "Registration Number",
      type: "text",
    },
    { key: "owner", label: "Owner", type: "text" },
    { key: "motExpiry", label: "MOT Expiry", type: "date" },
    { key: "taxExpiry", label: "Tax Expiry", type: "date" },
    { key: "insuranceExpiry", label: "Insurance Expiry", type: "date" },
    {
      key: "businessUse",
      label: "Business Use",
      type: "text",
      optional: true,
    },
    {
      key: "annualMileage",
      label: "Annual Mileage",
      type: "number",
      optional: true,
    },
    { key: "notes", label: "Notes", type: "text", optional: true },
  ],
};

// ─── Employment ─────────────────────────────────────────────────────

const employmentFields: FieldDef[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: ["Employed", "Self-employed", "Unemployed", "Retired"],
  },
  // Employed
  { key: "employer", label: "Employer", type: "text", optional: true },
  { key: "jobTitle", label: "Job Title", type: "text", optional: true },
  { key: "startDate", label: "Start Date", type: "date", optional: true },
  {
    key: "annualIncome",
    label: "Annual Income",
    type: "number",
    optional: true,
  },
  { key: "taxCode", label: "Tax Code", type: "text", optional: true },
  {
    key: "payrollNumber",
    label: "Payroll Number",
    type: "text",
    optional: true,
  },
  {
    key: "maternityLeaveStart",
    label: "Maternity Leave Start",
    type: "date",
    optional: true,
  },
  // Self-employed
  {
    key: "businessName",
    label: "Business Name",
    type: "text",
    optional: true,
  },
  {
    key: "companyNumber",
    label: "Company Number",
    type: "text",
    optional: true,
  },
  { key: "vatNumber", label: "VAT Number", type: "text", optional: true },
  {
    key: "businessType",
    label: "Business Type",
    type: "text",
    optional: true,
  },
  {
    key: "businessStartDate",
    label: "Business Start Date",
    type: "date",
    optional: true,
  },
  {
    key: "annualRevenue",
    label: "Annual Revenue",
    type: "number",
    optional: true,
  },
  {
    key: "annualExpenses",
    label: "Annual Expenses",
    type: "number",
    optional: true,
  },
  { key: "netIncome", label: "Net Income", type: "number", optional: true },
  { key: "utrNumber", label: "UTR Number", type: "text", optional: true },
  { key: "accountant", label: "Accountant", type: "text", optional: true },
  // Unemployed
  {
    key: "previousEmployer",
    label: "Previous Employer",
    type: "text",
    optional: true,
  },
  {
    key: "previousJobTitle",
    label: "Previous Job Title",
    type: "text",
    optional: true,
  },
  {
    key: "employmentEndDate",
    label: "Employment End Date",
    type: "date",
    optional: true,
  },
  { key: "endReason", label: "End Reason", type: "text", optional: true },
  {
    key: "previousIncome",
    label: "Previous Income",
    type: "number",
    optional: true,
  },
  {
    key: "yearsWorked",
    label: "Years Worked",
    type: "number",
    optional: true,
  },
  // Retired
  {
    key: "previousOccupation",
    label: "Previous Occupation",
    type: "text",
    optional: true,
  },
  {
    key: "retirementDate",
    label: "Retirement Date",
    type: "date",
    optional: true,
  },
];

export const employmentSchema: ObjectSectionSchema = {
  kind: "object",
  key: "employment",
  title: "Employment",
  fields: employmentFields,
};

export const spouseEmploymentSchema: ObjectSectionSchema = {
  kind: "object",
  key: "spouseEmployment",
  title: "Spouse Employment",
  fields: employmentFields,
};

// ─── Financials ─────────────────────────────────────────────────────

const bankAccountFields: FieldDef[] = [
  { key: "bank", label: "Bank", type: "text" },
  { key: "sortCode", label: "Sort Code", type: "text" },
  { key: "accountNumber", label: "Account Number", type: "text" },
  { key: "balance", label: "Balance", type: "number" },
];

export const financialsSchema: ObjectSectionSchema = {
  kind: "object",
  key: "financials",
  title: "Financials",
  fields: [
    {
      key: "householdIncome",
      label: "Household Income",
      type: "number",
      optional: true,
    },
    {
      key: "annualIncome",
      label: "Annual Income",
      type: "number",
      optional: true,
    },
    {
      key: "combinedAnnualIncome",
      label: "Combined Annual Income",
      type: "number",
      optional: true,
    },
    {
      key: "councilTaxBand",
      label: "Council Tax Band",
      type: "text",
      optional: true,
    },
    {
      key: "councilTaxAnnual",
      label: "Council Tax Annual",
      type: "number",
      optional: true,
    },
    {
      key: "monthlyRent",
      label: "Monthly Rent",
      type: "number",
      optional: true,
    },
    {
      key: "monthlyMortgage",
      label: "Monthly Mortgage",
      type: "number",
      optional: true,
    },
  ],
  subSections: [
    { key: "currentAccount", title: "Current Account", fields: bankAccountFields },
    { key: "savingsAccount", title: "Savings Account", fields: bankAccountFields },
    { key: "jointAccount", title: "Joint Account", fields: bankAccountFields },
    { key: "businessAccount", title: "Business Account", fields: bankAccountFields },
    { key: "personalAccount", title: "Personal Account", fields: bankAccountFields },
    {
      key: "statePension",
      title: "State Pension",
      fields: [
        { key: "weeklyAmount", label: "Weekly Amount", type: "number" },
        { key: "annualAmount", label: "Annual Amount", type: "number" },
        { key: "startDate", label: "Start Date", type: "date" },
      ],
    },
    {
      key: "privatePension",
      title: "Private Pension",
      fields: [
        { key: "provider", label: "Provider", type: "text" },
        { key: "monthlyAmount", label: "Monthly Amount", type: "number" },
        { key: "annualAmount", label: "Annual Amount", type: "number" },
        { key: "startDate", label: "Start Date", type: "date" },
      ],
    },
    {
      key: "investments",
      title: "Investments",
      fields: [
        { key: "ISA", label: "ISA", type: "number", optional: true },
        { key: "stocks", label: "Stocks", type: "number", optional: true },
        { key: "pension", label: "Pension", type: "number", optional: true },
      ],
    },
  ],
};

// ─── Housing ────────────────────────────────────────────────────────

export const housingSchema: ObjectSectionSchema = {
  kind: "object",
  key: "housing",
  title: "Housing",
  fields: [
    {
      key: "type",
      label: "Type",
      type: "select",
      options: [
        "Private rental",
        "Council rental",
        "Owner occupier",
        "Social housing",
        "Shared ownership",
      ],
    },
    { key: "landlord", label: "Landlord", type: "text", optional: true },
    { key: "leaseEnd", label: "Lease End", type: "date", optional: true },
    {
      key: "monthlyRent",
      label: "Monthly Rent",
      type: "number",
      optional: true,
    },
    {
      key: "monthlyMortgage",
      label: "Monthly Mortgage",
      type: "number",
      optional: true,
    },
    {
      key: "depositPaid",
      label: "Deposit Paid",
      type: "number",
      optional: true,
    },
    {
      key: "housingBenefitEligible",
      label: "Housing Benefit Eligible",
      type: "boolean",
      optional: true,
    },
  ],
};

// ─── Partner / Spouse ───────────────────────────────────────────────

const personFields: FieldDef[] = [
  { key: "firstName", label: "First Name", type: "text" },
  { key: "middleName", label: "Middle Name", type: "text", optional: true },
  { key: "lastName", label: "Last Name", type: "text" },
  { key: "dateOfBirth", label: "Date of Birth", type: "date" },
  {
    key: "nationalInsuranceNumber",
    label: "NI Number",
    type: "text",
    optional: true,
  },
  { key: "email", label: "Email", type: "text", optional: true },
  { key: "phone", label: "Phone", type: "text", optional: true },
  { key: "occupation", label: "Occupation", type: "text", optional: true },
];

export const partnerSchema: ObjectSectionSchema = {
  kind: "object",
  key: "partner",
  title: "Partner",
  fields: personFields,
};

export const spouseSchema: ObjectSectionSchema = {
  kind: "object",
  key: "spouse",
  title: "Spouse",
  fields: personFields,
};

// ─── Deceased ───────────────────────────────────────────────────────

export const deceasedSchema: ObjectSectionSchema = {
  kind: "object",
  key: "deceased",
  title: "Deceased",
  fields: [],
  subSections: [
    {
      key: "spouse",
      title: "Deceased Spouse",
      fields: [
        { key: "firstName", label: "First Name", type: "text" },
        {
          key: "middleName",
          label: "Middle Name",
          type: "text",
          optional: true,
        },
        { key: "lastName", label: "Last Name", type: "text" },
        { key: "dateOfBirth", label: "Date of Birth", type: "date" },
        { key: "dateOfDeath", label: "Date of Death", type: "date" },
        { key: "relationship", label: "Relationship", type: "text" },
      ],
    },
  ],
};

// ─── Pregnancy ──────────────────────────────────────────────────────

export const pregnancySchema: ObjectSectionSchema = {
  kind: "object",
  key: "pregnancy",
  title: "Pregnancy",
  fields: [
    { key: "dueDate", label: "Due Date", type: "date" },
    { key: "hospital", label: "Hospital", type: "text" },
    { key: "midwife", label: "Midwife", type: "text" },
    { key: "firstBaby", label: "First Baby", type: "boolean" },
    { key: "expectedArrival", label: "Expected Arrival", type: "text" },
  ],
};

// ─── Business Assets ────────────────────────────────────────────────

export const businessAssetsSchema: ObjectSectionSchema = {
  kind: "object",
  key: "businessAssets",
  title: "Business Assets",
  fields: [],
  subSections: [
    {
      key: "homeOffice",
      title: "Home Office",
      fields: [
        { key: "location", label: "Location", type: "text" },
        {
          key: "claimableExpenses",
          label: "Claimable Expenses",
          type: "boolean",
        },
      ],
    },
  ],
};

// ─── Health sub-schemas (used by HealthInfoSection) ─────────────────

export const healthConditionsSchema: ArraySectionSchema = {
  kind: "array",
  key: "conditions",
  title: "Conditions",
  itemLabel: "condition",
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "diagnosed", label: "Diagnosed", type: "date", optional: true },
    { key: "severity", label: "Severity", type: "text", optional: true },
    { key: "management", label: "Management", type: "text", optional: true },
    {
      key: "impactOnDailyLife",
      label: "Impact on Daily Life",
      type: "text",
      optional: true,
    },
    { key: "control", label: "Control", type: "text", optional: true },
    { key: "notes", label: "Notes", type: "text", optional: true },
  ],
};

export const healthMedicationsSchema: ArraySectionSchema = {
  kind: "array",
  key: "medications",
  title: "Medications",
  itemLabel: "medication",
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "dosage", label: "Dosage", type: "text" },
    { key: "purpose", label: "Purpose", type: "text" },
  ],
};

export const healthAppointmentsSchema: ArraySectionSchema = {
  kind: "array",
  key: "hospitalAppointments",
  title: "Hospital Appointments",
  itemLabel: "appointment",
  fields: [
    { key: "type", label: "Type", type: "text" },
    { key: "frequency", label: "Frequency", type: "text" },
    { key: "lastAppointment", label: "Last Appointment", type: "date" },
  ],
};

// ─── Benefits sub-schemas (used by BenefitsSection) ─────────────────

export const benefitsCurrentSchema: ArraySectionSchema = {
  kind: "array",
  key: "currentlyReceiving",
  title: "Currently Receiving",
  itemLabel: "benefit",
  fields: [
    { key: "type", label: "Type", type: "text" },
    { key: "amount", label: "Amount", type: "number" },
    { key: "frequency", label: "Frequency", type: "text" },
    { key: "startDate", label: "Start Date", type: "date" },
    { key: "reason", label: "Reason", type: "text", optional: true },
  ],
};

export const benefitsPreviousSchema: ArraySectionSchema = {
  kind: "array",
  key: "previousClaims",
  title: "Previous Claims",
  itemLabel: "claim",
  fields: [
    { key: "type", label: "Type", type: "text" },
    { key: "startDate", label: "Start Date", type: "date" },
    { key: "endDate", label: "End Date", type: "date" },
    { key: "reason", label: "Reason", type: "text" },
  ],
};

// ─── Children (used by FamilySection or at root) ────────────────────

export const childrenSchema: ArraySectionSchema = {
  kind: "array",
  key: "children",
  title: "Children",
  itemLabel: "child",
  fields: [
    { key: "firstName", label: "First Name", type: "text" },
    { key: "lastName", label: "Last Name", type: "text" },
    { key: "dateOfBirth", label: "Date of Birth", type: "date" },
    {
      key: "childBenefitNumber",
      label: "Child Benefit Number",
      type: "text",
      optional: true,
    },
  ],
};

// ─── All structured keys (used to filter out from JSON fallback) ────

export const ALL_STRUCTURED_KEYS = new Set([
  // Already in TYPED_KEYS
  "id",
  "name",
  "personaName",
  "description",
  "date_of_birth",
  "age",
  "national_insurance_number",
  "jurisdiction",
  "credentials",
  "employment_status",
  "income",
  "savings",
  "bank_account",
  "primaryContact",
  "address",
  "communicationStyle",
  // New structured sections
  "vehicles",
  "employment",
  "financials",
  "benefits",
  "healthInfo",
  "family",
  "housing",
  "partner",
  "spouse",
  "deceased",
  "pregnancy",
  "businessAssets",
  "spouseEmployment",
  "children",
  // Standalone fields in Identity
  "self_employed",
  "over_70",
  "no_fixed_address",
  "pension_qualifying_years",
  "employer",
]);
