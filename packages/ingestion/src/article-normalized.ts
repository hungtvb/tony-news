import { createHash } from "node:crypto";

import {
  extractNormalizedArticle as extractBaseArticle,
  validateArticleUrl,
  type ArticleExtractionStrategy as BaseArticleExtractionStrategy,
  type ArticleInspectionResult as BaseInspectionResult,
  type ArticleTarget,
  type NormalizedArticle as BaseNormalizedArticle,
  type Publisher,
} from "./article.ts";
import { extractPublisherContent } from "./publisher-adapters.ts";

export type ArticleExtractionStrategy =
  | BaseArticleExtractionStrategy
  | "publisher-container";

export interface NormalizedArticle
  extends Omit<BaseNormalizedArticle, "extractionStrategy"> {
  extractionStrategy: ArticleExtractionStrategy;
  extractionSelector?: string;
}

export type { ArticleTarget, Publisher };
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

export interface ArticleInspectionResult
  extends Omit<BaseInspectionResult, "extractionStrategy"> {
  extractionStrategy?: ArticleExtractionStrategy;
  extractionSelector?: string;
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
    if (decoded === current) break;
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

function normalizeArticleFromBase(
  target: ArticleTarget,
  html: string,
  baseArticle: BaseNormalizedArticle,
): NormalizedArticle {
  const publisherContent = extractPublisherContent(target.publisher, html);
  const text = publisherContent?.text ?? baseArticle.text;
  const normalized: NormalizedArticle = {
    ...baseArticle,
    title: normalizeExtractedText(baseArticle.title),
    text,
    contentHash: createHash("sha256").update(text).digest("hex"),
    paragraphCount:
      publisherContent?.paragraphCount ?? baseArticle.paragraphCount,
    extractionStrategy:
      publisherContent?.strategy ?? baseArticle.extractionStrategy,
  };

  if (publisherContent) {
    normalized.extractionSelector = publisherContent.selector;
  }

  const author = normalizedOptional(baseArticle.author);
  if (author && !isPublisherAuthor(target.publisher, author)) {
    normalized.author = author;
  } else {
    delete normalized.author;
  }

  return normalized;
}

export function extractNormalizedArticle(
  target: ArticleTarget,
  html: string,
): NormalizedArticle {
  return normalizeArticleFromBase(target, html, extractBaseArticle(target, html));
}

function collectQualityWarnings(
  result: Pick<
    ArticleInspectionResult,
    "extractionStrategy" | "paragraphCount"
  >,
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
  if (!ok) return "failed";

  if (
    warnings.includes("broad-page-paragraph-fallback") ||
    warnings.includes("high-paragraph-count")
  ) {
    return "fallback-required";
  }

  // A publisher-as-author value is discarded and represented as author_unknown.
  // It remains a diagnostic warning but does not block content processing.
  return "ready";
}

async function fetchWithValidatedRedirects(
  target: ArticleTarget,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<Response> {
  let currentUrl = validateArticleUrl(target.publisher, target.url).toString();

  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetchImpl(currentUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9",
        "user-agent":
          "TonyNews-Phase0-Article-Smoke/0.1 (+https://github.com/hungtvb/tony-news)",
      },
      redirect: "manual",
      signal,
    });

    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location) {
      throw new Error(`Redirect ${response.status} did not include Location`);
    }

    currentUrl = validateArticleUrl(
      target.publisher,
      new URL(location, currentUrl).toString(),
    ).toString();
  }

  throw new Error("Article fetch exceeded redirect limit");
}

export async function fetchAndInspectArticle(
  target: ArticleTarget,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<ArticleInspectionResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let httpStatus: number | undefined;

  try {
    const response = await fetchWithValidatedRedirects(
      target,
      fetchImpl,
      controller.signal,
    );
    httpStatus = response.status;
    const contentType = response.headers.get("content-type");
    const html = await response.text();

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (contentType && !/html|xhtml/i.test(contentType)) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }

    const baseArticle = extractBaseArticle(target, html);
    const rawAuthor = normalizedOptional(baseArticle.author);
    const publisherAsAuthor = Boolean(
      rawAuthor && isPublisherAuthor(target.publisher, rawAuthor),
    );
    const article = normalizeArticleFromBase(target, html, baseArticle);

    const result: ArticleInspectionResult = {
      targetId: target.id,
      publisher: target.publisher,
      category: target.category,
      requestedUrl: target.url,
      ok: true,
      durationMs: Math.round(performance.now() - startedAt),
      httpStatus: response.status,
      canonicalUrl: article.canonicalUrl,
      title: article.title,
      textLength: article.text.length,
      paragraphCount: article.paragraphCount,
      extractionStrategy: article.extractionStrategy,
      contentHash: article.contentHash,
      authorStatus: article.author ? "reported" : "unknown",
      qualityDecision: "ready",
    };

    if (article.author) result.author = article.author;
    if (article.publishedAt) result.publishedAt = article.publishedAt;
    if (article.updatedAt) result.updatedAt = article.updatedAt;
    if (article.extractionSelector) {
      result.extractionSelector = article.extractionSelector;
    }

    const warnings = collectQualityWarnings(result, publisherAsAuthor);
    if (warnings.length > 0) result.qualityWarnings = warnings;
    result.qualityDecision = decideArticleQuality(true, warnings);

    return result;
  } catch (error: unknown) {
    const result: ArticleInspectionResult = {
      targetId: target.id,
      publisher: target.publisher,
      category: target.category,
      requestedUrl: target.url,
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      authorStatus: "unknown",
      qualityDecision: "failed",
      error:
        error instanceof Error && error.name === "AbortError"
          ? `Timed out after ${timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error),
    };

    if (httpStatus !== undefined) result.httpStatus = httpStatus;
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
