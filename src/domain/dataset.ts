import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  Candidate,
  Challenge,
  Company,
  CompanyPage,
  Dataset,
  Patent,
  Project,
  Publication,
  Researcher,
  SourceType,
} from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = resolve(HERE, "../../data/data");

const readJson = <T>(file: string): T => JSON.parse(readFileSync(resolve(DATA_DIR, file), "utf8"));

const readJsonl = <T>(file: string): T[] =>
  readFileSync(resolve(DATA_DIR, file), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);

const STOPWORDS = new Set(
  `a an and are as at be been but by can could do does for from has have how i if in into is it its
   more most need needs not of on or our so than that the their them then there these they this to
   was we were what when where which who why will with would you your us use used using new one two`
    .split(/\s+/)
    .filter(Boolean),
);

/** Lowercase, strip diacritics, drop stopwords and very short tokens. */
export const tokenize = (text: string): string[] => {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return normalized
    .split(/[^a-z0-9\u0400-\u04ff]+/u)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
};

export interface DatasetOptions {
  /** Cap how many researchers are indexed. Useful for a fast local demo. */
  researcherLimit?: number;
  companyLimit?: number;
}

export const loadDataset = (options: DatasetOptions = {}): Dataset => {
  const researcherFile = readJson<{ researchers: Researcher[] }>("researchers.json");
  const companyFile = readJson<{ companies: Company[] }>("companies.json");
  const projectFile = readJson<{ projects: Project[] }>("projects.json");
  const patentFile = readJson<{ patents: Patent[] }>("patents.json");

  const researchers = researcherFile.researchers.slice(0, options.researcherLimit ?? undefined);
  const companies = companyFile.companies.slice(0, options.companyLimit ?? undefined);

  const publications = new Map<string, Publication>();
  for (const publication of readJsonl<Publication>("publications.jsonl")) {
    publications.set(publication.id, publication);
  }

  const companyPages = new Map<string, CompanyPage[]>();
  for (const page of readJsonl<CompanyPage>("company-pages.jsonl")) {
    const list = companyPages.get(page.company_id) ?? [];
    list.push(page);
    companyPages.set(page.company_id, list);
  }

  const byResearcherId = new Map(researchers.map((r) => [r.id, r]));
  const byCompanyId = new Map(companies.map((c) => [c.id, c]));

  const byChallengeId = new Map<string, { company: Company; challenge: Challenge }>();
  for (const company of companies) {
    for (const challenge of company.challenges) {
      byChallengeId.set(challenge.id, { company, challenge });
    }
  }

  return {
    researchers,
    companies,
    publications,
    projects: new Map(projectFile.projects.map((p) => [p.id, p])),
    patents: new Map(patentFile.patents.map((p) => [p.id, p])),
    companyPages,
    byResearcherId,
    byCompanyId,
    byChallengeId,
  };
};

/* -------------------------------------------------------------------------- */
/* Candidate retrieval                                                         */
/* -------------------------------------------------------------------------- */

/** Field weights for the researcher index. Keywords are the strongest signal. */
const WEIGHTS = {
  keyword: 3,
  field: 2.5,
  department: 1.5,
  faculty: 1,
  notes: 1,
} as const;

export class ResearcherIndex {
  private readonly postings = new Map<string, Map<string, number>>();
  private readonly docCount: number;
  private readonly researcherTerms = new Map<string, string[]>();

  constructor(researchers: Researcher[]) {
    this.docCount = researchers.length;

    for (const researcher of researchers) {
      const terms = new Map<string, number>();
      const add = (text: string, weight: number) => {
        for (const token of tokenize(text)) {
          terms.set(token, (terms.get(token) ?? 0) + weight);
        }
      };

      researcher.keywords.forEach((k) => add(k, WEIGHTS.keyword));
      researcher.fields.forEach((f) => add(f, WEIGHTS.field));
      add(researcher.department, WEIGHTS.department);
      add(researcher.faculty, WEIGHTS.faculty);
      add(`${researcher.notes} ${researcher.open_to.join(" ")}`, WEIGHTS.notes);

      this.researcherTerms.set(researcher.id, [...terms.keys()]);
      for (const [term, weight] of terms) {
        let posting = this.postings.get(term);
        if (!posting) {
          posting = new Map();
          this.postings.set(term, posting);
        }
        posting.set(researcher.id, weight);
      }
    }
  }

  /**
   * Deterministic, model-free retrieval. This runs before any inference: 153
   * companies x 1,047 researchers is 160k pairs, which is far too many to put
   * in front of a model. Retrieval narrows the field; agents do the judging.
   */
  candidatesFor(company: Company, challenge: Challenge, limit: number): Candidate[] {
    const query = tokenize(`${challenge.text} ${challenge.detail} ${company.tech.join(" ")} ${company.sector}`);
    const unique = [...new Set(query)];
    const scores = new Map<string, { score: number; terms: Set<string> }>();

    for (const term of unique) {
      const posting = this.postings.get(term);
      if (!posting) continue;
      // Inverse document frequency, so "AI" contributes less than "anodising".
      const idf = Math.log(1 + this.docCount / posting.size);

      for (const [researcherId, weight] of posting) {
        const entry = scores.get(researcherId) ?? { score: 0, terms: new Set<string>() };
        entry.score += weight * idf;
        entry.terms.add(term);
        scores.set(researcherId, entry);
      }
    }

    return [...scores.entries()]
      .map(([researcherId, entry]) => ({
        companyId: company.id,
        challengeId: challenge.id,
        researcherId,
        score: Number(entry.score.toFixed(3)),
        sharedTerms: [...entry.terms].slice(0, 8),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  termsFor(researcherId: string): string[] {
    return this.researcherTerms.get(researcherId) ?? [];
  }
}

/* -------------------------------------------------------------------------- */
/* Source lookup — the evidence base behind every claim                        */
/* -------------------------------------------------------------------------- */

export interface SourceRecord {
  type: SourceType;
  id: string;
  /** One-line human label, safe to print in a trace or a proposal footer. */
  label: string;
  /** Owner ids, so the Critic can ask "is this claim about the right person?" */
  about: string[];
}

export const lookupSource = (dataset: Dataset, id: string): SourceRecord | undefined => {
  const researcher = dataset.byResearcherId.get(id);
  if (researcher) {
    return {
      type: "researcher",
      id,
      label: `${researcher.name} (${researcher.title}, ${researcher.faculty})`,
      about: [researcher.id],
    };
  }

  const publication = dataset.publications.get(id);
  if (publication) {
    const owners = dataset.researchers.filter((r) => r.publications.includes(id)).map((r) => r.id);
    return { type: "publication", id, label: publication.title, about: owners };
  }

  const project = dataset.projects.get(id);
  if (project) {
    const owners = dataset.researchers.filter((r) => r.projects.includes(id)).map((r) => r.id);
    return { type: "project", id, label: project.title, about: owners };
  }

  const patent = dataset.patents.get(id);
  if (patent) {
    const owners = dataset.researchers.filter((r) => r.patents.includes(id)).map((r) => r.id);
    return { type: "patent", id, label: patent.title, about: owners };
  }

  const challenge = dataset.byChallengeId.get(id);
  if (challenge) {
    return {
      type: "challenge",
      id,
      label: `${challenge.company.name}: ${challenge.challenge.text.slice(0, 90)}`,
      about: [challenge.company.id],
    };
  }

  const company = dataset.byCompanyId.get(id);
  if (company) {
    return { type: "company", id, label: `${company.name} (${company.sector})`, about: [company.id] };
  }

  return undefined;
};

export const describeResearcher = (researcher: Researcher, dataset: Dataset): string => {
  const publicationTitles = researcher.publications
    .slice(0, 3)
    .map((id) => dataset.publications.get(id)?.title)
    .filter((title): title is string => Boolean(title));

  return [
    `${researcher.name} — ${researcher.title}, ${researcher.department}, ${researcher.faculty}`,
    `Fields: ${researcher.fields.join("; ")}`,
    `Keywords: ${researcher.keywords.join(", ")}`,
    researcher.publications.length ? `Recent work: ${publicationTitles.join(" | ")}` : "No publications on record.",
    `Open to: ${researcher.open_to.join("; ")}`,
    `Industry: ${researcher.industry_experience || "none on record"}`,
  ].join("\n");
};

export const describeChallenge = (company: Company, challenge: Challenge): string =>
  [
    `${company.name} — ${company.sector}, ${company.employees} employees, ${company.location}`,
    `Tech: ${company.tech.join(", ")}`,
    `Challenge ${challenge.id}: ${challenge.text}`,
    challenge.detail,
    `R&D capacity: ${company.rd_capacity}`,
  ].join("\n");
