import { readFile } from "node:fs/promises";

export const BENCHMARK_CATEGORIES = [
  "technology",
  "entertainment",
  "sports",
] as const;

export const BENCHMARK_CASE_KINDS = [
  "same-event",
  "related-subevent",
  "hard-negative",
  "uncertainty",
  "numeric-fact",
  "developing-story",
] as const;

export const BENCHMARK_LABEL_STATUSES = [
  "provisional",
  "accepted",
  "rejected",
] as const;

export type BenchmarkCategory = (typeof BENCHMARK_CATEGORIES)[number];
export type BenchmarkCaseKind = (typeof BENCHMARK_CASE_KINDS)[number];
export type BenchmarkLabelStatus = (typeof BENCHMARK_LABEL_STATUSES)[number];

export interface BenchmarkArticle {
  id: string;
  category: BenchmarkCategory;
  sourceId: string;
  title: string;
  canonicalUrl: string;
  observedDate: string;
  verification: "url-observed" | "page-fetched" | "extraction-ready";
  contentType: string;
  entities: string[];
  uncertainty: "none" | "rumor" | "allegation" | "estimate" | "sensitive";
}

export interface BenchmarkLabelProvenance {
  status: BenchmarkLabelStatus;
  method: "project-seed" | "human-review";
  reviewedBy: string[];
  reviewedAt?: string;
  notes: string;
}

export interface BenchmarkCase {
  id: string;
  kind: BenchmarkCaseKind;
  articleIds: string[];
  expectedRelation:
    | "same-event"
    | "related-not-merge"
    | "different-event"
    | "preserve-uncertainty"
    | "preserve-numeric-facts"
    | "preserve-timeline";
  expectedClusterId?: string;
  evaluationFocus: string;
  knownUncertainty: string;
  labelProvenance: BenchmarkLabelProvenance;
}

export interface BenchmarkManifest {
  schemaVersion: "2.0.0";
  datasetVersion: string;
  generatedAt: string;
  legalBoundary: string;
  articles: BenchmarkArticle[];
  cases: BenchmarkCase[];
}

export interface BenchmarkInventory {
  articleCount: number;
  caseCount: number;
  categories: Record<BenchmarkCategory, number>;
  caseKinds: Record<BenchmarkCaseKind, number>;
  labelStatuses: Record<BenchmarkLabelStatus, number>;
  multiSourceSameEventCases: number;
  hardNegativeCases: number;
  uncertaintyCases: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  value: unknown,
  path: string,
  issues: string[],
): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${path} must be a non-empty string`);
    return false;
  }
  return true;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateBenchmarkManifest(value: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return ["manifest must be an object"];
  }

  if (value.schemaVersion !== "2.0.0") {
    issues.push("schemaVersion must be 2.0.0");
  }
  requireString(value.datasetVersion, "datasetVersion", issues);
  requireString(value.generatedAt, "generatedAt", issues);
  requireString(value.legalBoundary, "legalBoundary", issues);

  if (!Array.isArray(value.articles)) {
    issues.push("articles must be an array");
  }
  if (!Array.isArray(value.cases)) {
    issues.push("cases must be an array");
  }
  if (!Array.isArray(value.articles) || !Array.isArray(value.cases)) {
    return issues;
  }

  const articleIds: string[] = [];
  const canonicalUrls: string[] = [];
  const articlesById = new Map<string, Record<string, unknown>>();

  value.articles.forEach((article, index) => {
    const path = `articles[${index}]`;
    if (!isRecord(article)) {
      issues.push(`${path} must be an object`);
      return;
    }

    if (requireString(article.id, `${path}.id`, issues)) {
      articleIds.push(article.id);
      articlesById.set(article.id, article);
    }
    if (!BENCHMARK_CATEGORIES.includes(article.category as BenchmarkCategory)) {
      issues.push(`${path}.category is unsupported`);
    }
    requireString(article.sourceId, `${path}.sourceId`, issues);
    requireString(article.title, `${path}.title`, issues);
    if (requireString(article.canonicalUrl, `${path}.canonicalUrl`, issues)) {
      canonicalUrls.push(article.canonicalUrl);
      if (!isHttpsUrl(article.canonicalUrl)) {
        issues.push(`${path}.canonicalUrl must be HTTPS`);
      }
    }
    if (requireString(article.observedDate, `${path}.observedDate`, issues) && !isIsoDate(article.observedDate)) {
      issues.push(`${path}.observedDate must use YYYY-MM-DD`);
    }
    if (!["url-observed", "page-fetched", "extraction-ready"].includes(String(article.verification))) {
      issues.push(`${path}.verification is unsupported`);
    }
    requireString(article.contentType, `${path}.contentType`, issues);
    if (!Array.isArray(article.entities) || article.entities.some((entity) => typeof entity !== "string" || entity.trim().length === 0)) {
      issues.push(`${path}.entities must contain non-empty strings`);
    }
    if (!["none", "rumor", "allegation", "estimate", "sensitive"].includes(String(article.uncertainty))) {
      issues.push(`${path}.uncertainty is unsupported`);
    }
  });

  if (!hasUniqueValues(articleIds)) {
    issues.push("article IDs must be unique");
  }
  if (!hasUniqueValues(canonicalUrls)) {
    issues.push("canonical URLs must be unique");
  }

  const caseIds: string[] = [];
  value.cases.forEach((benchmarkCase, index) => {
    const path = `cases[${index}]`;
    if (!isRecord(benchmarkCase)) {
      issues.push(`${path} must be an object`);
      return;
    }
    if (requireString(benchmarkCase.id, `${path}.id`, issues)) {
      caseIds.push(benchmarkCase.id);
    }
    if (!BENCHMARK_CASE_KINDS.includes(benchmarkCase.kind as BenchmarkCaseKind)) {
      issues.push(`${path}.kind is unsupported`);
    }
    if (!Array.isArray(benchmarkCase.articleIds) || benchmarkCase.articleIds.length === 0) {
      issues.push(`${path}.articleIds must be a non-empty array`);
    } else {
      if (!hasUniqueValues(benchmarkCase.articleIds.map(String))) {
        issues.push(`${path}.articleIds must be unique`);
      }
      for (const articleId of benchmarkCase.articleIds) {
        if (typeof articleId !== "string" || !articlesById.has(articleId)) {
          issues.push(`${path}.articleIds references unknown article ${String(articleId)}`);
        }
      }
    }
    if (![
      "same-event",
      "related-not-merge",
      "different-event",
      "preserve-uncertainty",
      "preserve-numeric-facts",
      "preserve-timeline",
    ].includes(String(benchmarkCase.expectedRelation))) {
      issues.push(`${path}.expectedRelation is unsupported`);
    }
    requireString(benchmarkCase.evaluationFocus, `${path}.evaluationFocus`, issues);
    requireString(benchmarkCase.knownUncertainty, `${path}.knownUncertainty`, issues);

    if (!isRecord(benchmarkCase.labelProvenance)) {
      issues.push(`${path}.labelProvenance must be an object`);
      return;
    }
    const provenance = benchmarkCase.labelProvenance;
    if (!BENCHMARK_LABEL_STATUSES.includes(provenance.status as BenchmarkLabelStatus)) {
      issues.push(`${path}.labelProvenance.status is unsupported`);
    }
    if (!["project-seed", "human-review"].includes(String(provenance.method))) {
      issues.push(`${path}.labelProvenance.method is unsupported`);
    }
    if (!Array.isArray(provenance.reviewedBy) || provenance.reviewedBy.some((reviewer) => typeof reviewer !== "string" || reviewer.trim().length === 0)) {
      issues.push(`${path}.labelProvenance.reviewedBy must be a string array`);
    }
    requireString(provenance.notes, `${path}.labelProvenance.notes`, issues);

    if (provenance.status === "accepted") {
      if (provenance.method !== "human-review") {
        issues.push(`${path} accepted labels require human-review provenance`);
      }
      if (!Array.isArray(provenance.reviewedBy) || provenance.reviewedBy.length === 0) {
        issues.push(`${path} accepted labels require at least one reviewer`);
      }
      if (typeof provenance.reviewedAt !== "string" || Number.isNaN(Date.parse(provenance.reviewedAt))) {
        issues.push(`${path} accepted labels require reviewedAt`);
      }
    }
  });

  if (!hasUniqueValues(caseIds)) {
    issues.push("case IDs must be unique");
  }

  return issues;
}

export function buildBenchmarkInventory(
  manifest: BenchmarkManifest,
): BenchmarkInventory {
  const categories = Object.fromEntries(
    BENCHMARK_CATEGORIES.map((category) => [category, 0]),
  ) as Record<BenchmarkCategory, number>;
  const caseKinds = Object.fromEntries(
    BENCHMARK_CASE_KINDS.map((kind) => [kind, 0]),
  ) as Record<BenchmarkCaseKind, number>;
  const labelStatuses = Object.fromEntries(
    BENCHMARK_LABEL_STATUSES.map((status) => [status, 0]),
  ) as Record<BenchmarkLabelStatus, number>;
  const articleById = new Map(manifest.articles.map((article) => [article.id, article]));

  for (const article of manifest.articles) {
    categories[article.category] += 1;
  }
  for (const benchmarkCase of manifest.cases) {
    caseKinds[benchmarkCase.kind] += 1;
    labelStatuses[benchmarkCase.labelProvenance.status] += 1;
  }

  const multiSourceSameEventCases = manifest.cases.filter((benchmarkCase) => {
    if (benchmarkCase.kind !== "same-event") {
      return false;
    }
    const sources = benchmarkCase.articleIds
      .map((id) => articleById.get(id)?.sourceId)
      .filter((sourceId): sourceId is string => Boolean(sourceId));
    return new Set(sources).size >= 2;
  }).length;

  return {
    articleCount: manifest.articles.length,
    caseCount: manifest.cases.length,
    categories,
    caseKinds,
    labelStatuses,
    multiSourceSameEventCases,
    hardNegativeCases: caseKinds["hard-negative"],
    uncertaintyCases: caseKinds.uncertainty,
  };
}

export async function loadBenchmarkManifest(
  path: string,
): Promise<BenchmarkManifest> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  const issues = validateBenchmarkManifest(parsed);
  if (issues.length > 0) {
    throw new Error(`Invalid benchmark manifest:\n- ${issues.join("\n- ")}`);
  }
  return parsed as BenchmarkManifest;
}
