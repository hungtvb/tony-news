import { createHash } from "node:crypto";

import type { NewsCategory } from "./source-registry.ts";

export type Publisher = "VnExpress" | "Tuổi Trẻ" | "Thanh Niên";

export interface ArticleTarget {
  id: string;
  publisher: Publisher;
  category: NewsCategory;
  url: string;
}

export type ArticleExtractionStrategy =
  | "json-ld-article-body"
  | "article-paragraphs"
  | "page-paragraphs";

export interface NormalizedArticle {
  requestedUrl: string;
  canonicalUrl: string;
  title: string;
  text: string;
  contentHash: string;
  paragraphCount: number;
  extractionStrategy: ArticleExtractionStrategy;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
}

export interface ArticleInspectionResult {
  targetId: string;
  publisher: Publisher;
  category: NewsCategory;
  requestedUrl: string;
  ok: boolean;
  durationMs: number;
  httpStatus?: number;
  canonicalUrl?: string;
  title?: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
  textLength?: number;
  paragraphCount?: number;
  extractionStrategy?: ArticleExtractionStrategy;
  contentHash?: string;
  error?: string;
}

const ALLOWED_HOSTS: Readonly<Record<Publisher, readonly string[]>> = {
  VnExpress: ["vnexpress.net", "www.vnexpress.net"],
  "Tuổi Trẻ": ["tuoitre.vn", "www.tuoitre.vn"],
  "Thanh Niên": ["thanhnien.vn", "www.thanhnien.vn"],
};

const HTML_ENTITY_MAP: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x?[0-9a-f]+|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, token: string) => {
      if (token.startsWith("#x") || token.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(token.slice(2), 16));
      }

      if (token.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(token.slice(1), 10));
      }

      return HTML_ENTITY_MAP[token.toLowerCase()] ?? entity;
    },
  );
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlFragmentToText(fragment: string): string {
  const withoutUnsafeBlocks = fragment
    .replace(/<(script|style|noscript|svg|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const withLineBreaks = withoutUnsafeBlocks
    .replace(/<(br|hr)\b[^>]*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|blockquote|section)>/gi, "\n");

  return normalizeWhitespace(
    decodeHtmlEntities(withLineBreaks.replace(/<[^>]+>/g, " ")),
  );
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g;

  for (const match of tag.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    const value = match[3];

    if (name && value !== undefined) {
      attributes[name] = decodeHtmlEntities(value.trim());
    }
  }

  return attributes;
}

function metaContent(html: string, names: readonly string[]): string | undefined {
  const wanted = new Set(names.map((name) => name.toLowerCase()));

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const key = (attributes.property ?? attributes.name ?? attributes.itemprop)?.toLowerCase();
    const content = attributes.content;

    if (key && content && wanted.has(key)) {
      return normalizeWhitespace(content);
    }
  }

  return undefined;
}

function canonicalLink(html: string): string | undefined {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const rel = attributes.rel?.toLowerCase();

    if (rel?.split(/\s+/).includes("canonical") && attributes.href) {
      return attributes.href;
    }
  }

  return undefined;
}

function documentTitle(html: string): string | undefined {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? htmlFragmentToText(match[1]) : undefined;
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenJsonLd(item));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const graph = record["@graph"];
  return [record, ...flattenJsonLd(graph)];
}

function jsonLdObjects(html: string): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];

  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = match[2]
      ?.replace(/^\s*<!\[CDATA\[/, "")
      .replace(/\]\]>\s*$/, "")
      .trim();

    if (!raw) {
      continue;
    }

    try {
      objects.push(...flattenJsonLd(JSON.parse(raw)));
    } catch {
      // A malformed JSON-LD block must not prevent other extraction fallbacks.
    }
  }

  return objects;
}

function jsonLdTypeMatches(value: unknown): boolean {
  const types = Array.isArray(value) ? value : [value];
  return types.some(
    (type) =>
      typeof type === "string" &&
      ["article", "newsarticle", "reportagenewsarticle"].includes(
        type.toLowerCase(),
      ),
  );
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return normalizeWhitespace(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = firstString(item);
      if (candidate) {
        return candidate;
      }
    }
  }

  return undefined;
}

function authorName(value: unknown): string | undefined {
  if (typeof value === "string") {
    return normalizeWhitespace(value);
  }

  if (Array.isArray(value)) {
    const names = value
      .map((item) => authorName(item))
      .filter((item): item is string => Boolean(item));

    return names.length > 0 ? names.join(", ") : undefined;
  }

  if (value && typeof value === "object") {
    return firstString((value as Record<string, unknown>).name);
  }

  return undefined;
}

function mainEntityUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return firstString(record["@id"] ?? record.url);
  }

  return undefined;
}

interface JsonLdArticleCandidate {
  headline?: string;
  articleBody?: string;
  canonicalUrl?: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
}

function jsonLdArticle(html: string): JsonLdArticleCandidate | undefined {
  const candidates = jsonLdObjects(html).filter((record) =>
    jsonLdTypeMatches(record["@type"]),
  );

  for (const record of candidates) {
    const candidate: JsonLdArticleCandidate = {};
    const headline = firstString(record.headline ?? record.name);
    const articleBody = firstString(record.articleBody);
    const canonicalUrl =
      firstString(record.url) ?? mainEntityUrl(record.mainEntityOfPage);
    const author = authorName(record.author);
    const publishedAt = firstString(record.datePublished);
    const updatedAt = firstString(record.dateModified);

    if (headline) candidate.headline = headline;
    if (articleBody) candidate.articleBody = articleBody;
    if (canonicalUrl) candidate.canonicalUrl = canonicalUrl;
    if (author) candidate.author = author;
    if (publishedAt) candidate.publishedAt = publishedAt;
    if (updatedAt) candidate.updatedAt = updatedAt;

    if (headline || articleBody) {
      return candidate;
    }
  }

  return undefined;
}

function extractParagraphs(fragment: string): string[] {
  const paragraphs: string[] = [];

  for (const match of fragment.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    if (!match[1]) {
      continue;
    }

    const text = htmlFragmentToText(match[1]);

    if (
      text.length >= 30 &&
      !/^(xem thêm|đọc thêm|theo dõi|chia sẻ|đăng ký|nguồn:)/i.test(text)
    ) {
      paragraphs.push(text);
    }
  }

  return paragraphs;
}

function chooseMainText(
  html: string,
  jsonLd: JsonLdArticleCandidate | undefined,
): {
  text: string;
  paragraphCount: number;
  strategy: ArticleExtractionStrategy;
} {
  if (jsonLd?.articleBody) {
    const text = normalizeWhitespace(decodeHtmlEntities(jsonLd.articleBody));
    if (text.length >= 250) {
      return {
        text,
        paragraphCount: text.split(/\n{2,}/).filter(Boolean).length || 1,
        strategy: "json-ld-article-body",
      };
    }
  }

  const articleFragment = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (articleFragment) {
    const paragraphs = extractParagraphs(articleFragment);
    const text = normalizeWhitespace(paragraphs.join("\n\n"));

    if (text.length >= 250) {
      return {
        text,
        paragraphCount: paragraphs.length,
        strategy: "article-paragraphs",
      };
    }
  }

  const paragraphs = extractParagraphs(html);
  const text = normalizeWhitespace(paragraphs.join("\n\n"));

  if (text.length >= 250) {
    return {
      text,
      paragraphCount: paragraphs.length,
      strategy: "page-paragraphs",
    };
  }

  throw new Error("Main article text did not meet the minimum quality threshold");
}

export function validateArticleUrl(
  publisher: Publisher,
  value: string,
): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid article URL: ${value}`);
  }

  if (url.protocol !== "https:") {
    throw new Error("Article URL must use HTTPS");
  }

  const allowedHosts = ALLOWED_HOSTS[publisher];
  if (!allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error(
      `Host ${url.hostname} is not allowed for publisher ${publisher}`,
    );
  }

  return url;
}

function normalizeCanonicalUrl(
  publisher: Publisher,
  requestedUrl: string,
  candidate: string | undefined,
): string {
  if (!candidate) {
    return requestedUrl;
  }

  try {
    return validateArticleUrl(
      publisher,
      new URL(candidate, requestedUrl).toString(),
    ).toString();
  } catch {
    return requestedUrl;
  }
}

export function extractNormalizedArticle(
  target: ArticleTarget,
  html: string,
): NormalizedArticle {
  const requestedUrl = validateArticleUrl(target.publisher, target.url).toString();
  const structured = jsonLdArticle(html);
  const title =
    structured?.headline ??
    metaContent(html, ["og:title", "twitter:title"]) ??
    documentTitle(html);

  if (!title) {
    throw new Error("Article title could not be extracted");
  }

  const canonicalCandidate =
    structured?.canonicalUrl ??
    canonicalLink(html) ??
    metaContent(html, ["og:url"]);
  const mainText = chooseMainText(html, structured);

  const article: NormalizedArticle = {
    requestedUrl,
    canonicalUrl: normalizeCanonicalUrl(
      target.publisher,
      requestedUrl,
      canonicalCandidate,
    ),
    title,
    text: mainText.text,
    contentHash: createHash("sha256").update(mainText.text).digest("hex"),
    paragraphCount: mainText.paragraphCount,
    extractionStrategy: mainText.strategy,
  };

  const author =
    structured?.author ??
    metaContent(html, ["author", "article:author", "parsely-author"]);
  const publishedAt =
    structured?.publishedAt ??
    metaContent(html, [
      "article:published_time",
      "datepublished",
      "pubdate",
      "publishdate",
    ]);
  const updatedAt =
    structured?.updatedAt ??
    metaContent(html, ["article:modified_time", "datemodified"]);

  if (author) article.author = author;
  if (publishedAt) article.publishedAt = publishedAt;
  if (updatedAt) article.updatedAt = updatedAt;

  return article;
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

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

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

  try {
    const response = await fetchWithValidatedRedirects(
      target,
      fetchImpl,
      controller.signal,
    );
    const html = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }

    const article = extractNormalizedArticle(target, html);
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
    };

    if (article.author) result.author = article.author;
    if (article.publishedAt) result.publishedAt = article.publishedAt;
    if (article.updatedAt) result.updatedAt = article.updatedAt;

    return result;
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);

    return {
      targetId: target.id,
      publisher: target.publisher,
      category: target.category,
      requestedUrl: target.url,
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
