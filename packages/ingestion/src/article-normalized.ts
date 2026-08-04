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

export interface ArticleInspectionResult extends BaseInspectionResult {
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

  if (author) {
    normalized.author = author;
  } else {
    delete normalized.author;
  }

  return normalized;
}

function collectQualityWarnings(
  result: BaseInspectionResult,
): ArticleQualityWarning[] {
  const warnings: ArticleQualityWarning[] = [];

  if (result.extractionStrategy === "page-paragraphs") {
    warnings.push("broad-page-paragraph-fallback");
  }

  if ((result.paragraphCount ?? 0) > 30) {
    warnings.push("high-paragraph-count");
  }

  if (
    result.author &&
    normalizeExtractedText(result.author).localeCompare(result.publisher, "vi", {
      sensitivity: "base",
    }) === 0
  ) {
    warnings.push("publisher-reported-as-author");
  }

  return warnings;
}

export async function fetchAndInspectArticle(
  target: ArticleTarget,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<ArticleInspectionResult> {
  const result = await fetchBaseArticle(target, options);
  const normalized: ArticleInspectionResult = { ...result };

  if (result.title) {
    normalized.title = normalizeExtractedText(result.title);
  }

  if (result.author) {
    normalized.author = normalizeExtractedText(result.author);
  }

  const warnings = collectQualityWarnings(normalized);
  if (warnings.length > 0) {
    normalized.qualityWarnings = warnings;
  }

  return normalized;
}
