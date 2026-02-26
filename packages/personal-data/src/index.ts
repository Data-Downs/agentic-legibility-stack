export { VerifiedStore } from "./verified-store";
export { IncidentalStore } from "./incidental-store";
export { ConsentLedger } from "./consent-ledger";
export { SubmittedStore } from "./submitted-store";
export { InferredStore, normalizeKey } from "./inferred-store";
export type { MergeResult, MergeOutcome } from "./inferred-store";
export { ServiceAccessStore } from "./service-access-store";
export type {
  PersonalDataProfile,
  VerifiedData,
  IncidentalData,
  IncidentalField,
  HouseholdMember,
  ConsentRecord,
  ThreeTierProfile,
  SubmittedField,
  SubmittedData,
  InferredFact,
  InferredData as InferredDataType,
  ServiceAccessGrant,
  ServiceAccessMap,
} from "./data-model";
