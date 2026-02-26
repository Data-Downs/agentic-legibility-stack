/**
 * Types for the UK Government Service Graph.
 *
 * Adapted from the colleague's graph-data.ts — describes 108 services,
 * their relationships, and 16 life-event entry points.
 */

export type ServiceType =
  | 'benefit'
  | 'entitlement'
  | 'obligation'
  | 'registration'
  | 'application'
  | 'legal_process'
  | 'document'
  | 'grant';

export type EligibilityFactor =
  | 'age'
  | 'income'
  | 'employment'
  | 'disability'
  | 'terminal_illness'
  | 'ni_record'
  | 'caring'
  | 'residency'
  | 'geography'
  | 'family'
  | 'relationship_status'
  | 'asset'
  | 'property'
  | 'bereavement'
  | 'immigration'
  | 'citizenship'
  | 'dependency';

export interface EligibilityInfo {
  summary: string;
  universal: boolean;
  criteria: { factor: EligibilityFactor; description: string }[];
  keyQuestions: string[];
  autoQualifiers?: string[];
  exclusions?: string[];
  means_tested: boolean;
  evidenceRequired?: string[];
}

export interface ServiceNode {
  id: string;
  name: string;
  dept: string;
  deptKey: string;
  deadline: string | null;
  desc: string;
  govuk_url: string;
  serviceType: ServiceType;
  proactive: boolean;
  gated: boolean;
  eligibility: EligibilityInfo;
}

export interface Edge {
  from: string;
  to: string;
  type: 'REQUIRES' | 'ENABLES';
}

export interface LifeEvent {
  id: string;
  icon: string;
  name: string;
  desc: string;
  entryNodes: string[];
}
