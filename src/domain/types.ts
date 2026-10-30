/**
 * Domain types for the EINSTEIN matchmaker.
 *
 * Everything here is either the synthetic dataset's own shape or a first-class
 * object we put on the runtime: profiles, candidates, proposals and — the point
 * of the whole system — claims, each one tied to a citable source id.
 */

export type Language = "en" | "sr" | "sr-Cyrl";

export interface Researcher {
  id: string;
  name: string;
  title: string;
  institution: string;
  faculty: string;
  department: string;
  fields: string[];
  keywords: string[];
  bio: string;
  publications: string[];
  projects: string[];
  patents: string[];
  open_to: string[];
  industry_experience: string;
  notes: string;
  language: Language;
}

export interface Challenge {
  id: string;
  text: string;
  detail: string;
}

export interface Company {
  id: string;
  name: string;
  sector: string;
  employees: number;
  founded: number;
  location: string;
  about: string;
  products: string[];
  tech: string[];
  challenges: Challenge[];
  plans: string;
  rd_capacity: string;
  past_collaborations: string;
  language: Language;
}

export interface Publication {
  id: string;
  title: string;
  abstract: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  title: string;
  summary?: string;
  [key: string]: unknown;
}

export interface Patent {
  id: string;
  title: string;
  [key: string]: unknown;
}

export interface CompanyPage {
  company_id: string;
  kind: string;
  title: string;
  date: string;
  text: string;
}

export interface Dataset {
  researchers: Researcher[];
  companies: Company[];
  publications: Map<string, Publication>;
  projects: Map<string, Project>;
  patents: Map<string, Patent>;
  companyPages: Map<string, CompanyPage[]>;
  byResearcherId: Map<string, Researcher>;
  byCompanyId: Map<string, Company>;
  byChallengeId: Map<string, { company: Company; challenge: Challenge }>;
}

/** A citation is an id from the dataset, never a free-text reference. */
export type SourceType = "researcher" | "publication" | "project" | "patent" | "company" | "challenge";

export interface Citation {
  sourceType: SourceType;
  sourceId: string;
}

/**
 * The unit the Critic argues about. A claim is proposed by the Writer, then
 * verified or rejected against the dataset. Nothing reaches a proposal unless
 * its claims are verified.
 */
export type ClaimStatus = "proposed" | "verified" | "rejected";

export interface Claim {
  id: string;
  proposalId: string;
  /** The sentence-level assertion, e.g. "R0001 maintains a Coq proof of a register allocator." */
  text: string;
  /** Dataset ids backing the claim. Empty or unknown ids are a rejection. */
  sources: string[];
  status: ClaimStatus;
  note: string;
  revision: number;
}

export interface ResearcherProfile {
  researcherId: string;
  summary: string;
  expertise: string[];
  openTo: string[];
  industrySignals: string[];
  citations: string[];
  /** Which model/turn produced it — used by the trace. */
  producedBy: string;
}

export interface ChallengeAnalysis {
  challengeId: string;
  companyId: string;
  problem: string;
  needs: string[];
  keywords: string[];
  producedBy: string;
}

export interface Candidate {
  companyId: string;
  challengeId: string;
  researcherId: string;
  score: number;
  sharedTerms: string[];
}

export interface PairScore {
  key: string;
  companyId: string;
  challengeId: string;
  researcherId: string;
  fit: number;
  why: string;
  sharedTerms: string[];
  risks: string[];
}

export type ProposalStatus = "drafting" | "review" | "rejected" | "approved";

export interface Proposal {
  id: string;
  companyId: string;
  challengeId: string;
  researcherId: string;
  title: string;
  markdown: string;
  citations: string[];
  status: ProposalStatus;
  revision: number;
  criticNote: string;
}

export interface PortfolioEntry {
  companyId: string;
  challengeId: string;
  researcherId: string;
  proposalId: string;
  fit: number;
}

export interface LedgerEntry {
  at: number;
  kind: string;
  actor: string;
  detail: string;
}

export const pairKey = (companyId: string, challengeId: string, researcherId: string): string =>
  `${companyId}::${challengeId}::${researcherId}`;
