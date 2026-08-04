import {
  extractNormalizedArticle as extractBaseArticle,
  fetchAndInspectArticle as fetchBaseArticle,
  validateArticleUrl,
  type ArticleExtractionStrategy,
  type ArticleInspectionResult as BaseInspectionResult,
  type ArticleTarget,
  type NormalizedArticle,
  type Publisher,
} from "./article.ts";

export type {
  ArticleExtractionStrategy,
  ArticleTarget,
  NormalizedArticle,
  Publisher,
};
export { validateArticleUrl };

export type ArticleQualityWarning =
  | "broad-page-paragraph-fallback"
  | "high-paragraph-count"
  | "publisher-reported-as-author";

export type ArticleQualityDecision =
  | "ready"
  | "review"
  | "fallback-required"
  | "failed";

export type ArticleAuthorStatus = "reported" | "unknown";

export interface ArticleInspectionResult extends BaseInspectionResult {
  qualityDecision: ArticleQualityDecision;
  authorStatus: ArticleAuthorStatus;
  qualityWarnings?: ArticleQualityWarning[];
}

const ENTITY_MAP: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtmlEntitiesOnce(value: string): string {
  return value.replace(
    /&(#x?[0-9a-f]+|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, token: string) => {
      if (token.startsWith("#x") || token.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(token.slice(2), 16));
      }

      if (token.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(token.slice(1), 10));
      }

      return ENTITY_MAP[token.toLowerCase()] ?? entity;
    },
  );
}

export function normalizeExtractedText(value: string): string {
  let current = value;

  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = decodeHtmlEntitiesOnce(current);
    if (decoded === current) {
      break;
    }
    current = decoded;
  }

  return current.replace(/\s+/g, " ").trim();
}

function normalizedOptional(value: string | undefined): string | undefined {
  return value ? normalizeExtractedText(value) : undefined;
}

function isPublisherAuthor(publisher: Publisher, author: string): boolean {
  return (
    author.localeCompare(publisher, "vi", {
      sensitivity: "base",
    }) === 0
  );
}

export function extractNormalizedArticle(
  target: ArticleTarget,
  html: string,
): NormalizedArticle {
  const article = extractBaseArticle(target, html);
  const normalized: NormalizedArticle = {
    ...article,
    title: normalizeExtractedText(article.title),
  };
  const author = normalizedOptional(article.author);

  if (author && !isPublisherAuthor(target.publisher, author)) {
    normalized.author = author;
  } else {
    delete normalized.author;
  }

  return normalized;
}

function collectQualityWarnings(
  result: BaseInspectionResult,
  publisherAsAuthor: boolean,
): ArticleQualityWarning[] {
  const warnings: ArticleQualityWarning[] = [];

  if (result.extractionStrategy === "page-paragraphs") {
    warnings.push("broad-page-paragraph-fallback");
  }

  if ((result.paragraphCount ?? 0) > 30) {
    warnings.push("high-paragraph-count");
  }

  if (publisherAsAuthor) {
    warnings.push("publisher-reported-as-author");
  }

  return warnings;
}

export function decideArticleQuality(
  ok: boolean,
  warnings: readonly ArticleQualityWarning[],
): ArticleQualityDecision {
  if (!ok) {
    return "failed";
  }

  if (
    warnings.includes("broad-page-paragraph-fallback") ||
    warnings.includes("high-paragraph-count")
  ) {
    return "fallback-required";
  }

  if (warnings.length > 0) {
    return "review";
  }

  return "ready";
}

export async function fetchAndInspectArticle(
  target: ArticleTarget,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<ArticleInspectionResult> {
  const result = await fetchBaseArticle(target, options);
  const normalized: ArticleInspectionResult = {
    ...result,
    authorStatus: "unknown",
    qualityDecision: result.ok ? "ready" : "failed",
  };

  if (result.title) {
    normalized.title = normalizeExtractedText(result.title);
  }

  const author = normalizedOptional(result.author);
  const publisherAsAuthor = Boolean(
    author && isPublisherAuthor(result.publisher, author),
  );

  if (author && !publisherAsAuthor) {
    normalized.author = author;
    normalized.authorStatus = "reported";
  } else {
    delete normalized.author;
    normalized.authorStatus = "unknown";
  }

  const warnings = collectQualityWarnings(normalized, publisherAsAuthor);
  if (warnings.length > 0) {
    normalized.qualityWarnings = warnings;
  }
  normalized.qualityDecision = decideArticleQuality(result.ok, warnings);

  return normalized;
}
