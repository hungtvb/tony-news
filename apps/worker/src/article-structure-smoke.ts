import process from "node:process";

interface DiagnosticTarget {
  id: string;
  publisher: "VnExpress" | "Tuổi Trẻ";
  url: string;
}

interface ContainerDiagnostic {
  selectorHint: string;
  paragraphCount: number;
  textLength: number;
}

interface TargetDiagnostic {
  targetId: string;
  publisher: DiagnosticTarget["publisher"];
  ok: boolean;
  httpStatus?: number;
  durationMs: number;
  htmlLength?: number;
  jsonLdArticleKeys?: string[];
  structuralTokens?: string[];
  bylineSelectorHints?: string[];
  contentCandidates?: ContainerDiagnostic[];
  error?: string;
}

const TARGETS: readonly DiagnosticTarget[] = [
  {
    id: "vne-google-earth-ai",
    publisher: "VnExpress",
    url: "https://vnexpress.net/ai-cua-google-earth-vua-ra-da-bi-rut-vi-tran-ngap-deepfake-5104049.html",
  },
  {
    id: "tto-google-earth-ai",
    publisher: "Tuổi Trẻ",
    url: "https://tuoitre.vn/google-tam-dung-ai-tao-anh-tren-google-earth-vi-lo-anh-ve-tinh-gia-100260801212001232.htm",
  },
];

const CONTENT_TOKEN = /(article|body|content|detail|entry|main|story|text)/i;
const BYLINE_TOKEN = /(author|byline|writer|reporter|name)/i;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function textLength(fragment: string): number {
  return decodeEntities(
    fragment
      .replace(/<(script|style|noscript|svg|form)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim().length;
}

function attributeValue(tag: string, name: "class" | "id"): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2]?.trim() || undefined;
}

function selectorHint(tagName: string, tag: string): string | undefined {
  const id = attributeValue(tag, "id");
  const className = attributeValue(tag, "class");
  const classes = className
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((value) => `.${value}`)
    .join("");

  if (id) return `${tagName.toLowerCase()}#${id}${classes ?? ""}`;
  if (classes) return `${tagName.toLowerCase()}${classes}`;
  return undefined;
}

function collectStructuralTokens(html: string): string[] {
  const tokens = new Set<string>();

  for (const match of html.matchAll(/<(article|main|section|div)\b[^>]*>/gi)) {
    const hint = selectorHint(match[1] ?? "div", match[0]);
    if (hint && CONTENT_TOKEN.test(hint)) tokens.add(hint);
  }

  return [...tokens].sort().slice(0, 60);
}

function collectBylineHints(html: string): string[] {
  const hints = new Set<string>();

  for (const match of html.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)) {
    const hint = selectorHint(match[1] ?? "div", match[0]);
    if (hint && BYLINE_TOKEN.test(hint)) hints.add(hint);
  }

  return [...hints].sort().slice(0, 30);
}

function collectContainerCandidates(html: string): ContainerDiagnostic[] {
  const results: ContainerDiagnostic[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/<(article|main|section|div)\b[^>]*>/gi)) {
    const tagName = (match[1] ?? "div").toLowerCase();
    const openingTag = match[0];
    const hint = selectorHint(tagName, openingTag);
    if (!hint || !CONTENT_TOKEN.test(hint) || seen.has(hint)) continue;

    const start = (match.index ?? 0) + openingTag.length;
    const closingIndex = html.indexOf(`</${tagName}>`, start);
    if (closingIndex === -1) continue;

    const fragment = html.slice(start, closingIndex);
    const paragraphCount = [...fragment.matchAll(/<p\b[^>]*>/gi)].length;
    const length = textLength(fragment);

    if (paragraphCount >= 2 && length >= 250) {
      results.push({ selectorHint: hint, paragraphCount, textLength: length });
      seen.add(hint);
    }
  }

  return results
    .sort((left, right) => {
      const leftScore = left.paragraphCount * 500 + left.textLength;
      const rightScore = right.paragraphCount * 500 + right.textLength;
      return rightScore - leftScore;
    })
    .slice(0, 20);
}

function flattenJson(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap((item) => flattenJson(item));
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  return [record, ...flattenJson(record["@graph"])];
}

function articleJsonLdKeys(html: string): string[] {
  const keys = new Set<string>();

  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = match[2]?.trim();
    if (!raw) continue;

    try {
      for (const record of flattenJson(JSON.parse(raw))) {
        const types = Array.isArray(record["@type"])
          ? record["@type"]
          : [record["@type"]];
        const isArticle = types.some(
          (type) => typeof type === "string" && /article/i.test(type),
        );
        if (!isArticle) continue;

        for (const key of Object.keys(record)) keys.add(key);
      }
    } catch {
      // Diagnostics must continue when one JSON-LD block is malformed.
    }
  }

  return [...keys].sort();
}

async function inspectTarget(target: DiagnosticTarget): Promise<TargetDiagnostic> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(target.url, {
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9",
        "user-agent":
          "TonyNews-Phase0-Structure-Smoke/0.1 (+https://github.com/hungtvb/tony-news)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    const html = await response.text();

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return {
      targetId: target.id,
      publisher: target.publisher,
      ok: true,
      httpStatus: response.status,
      durationMs: Math.round(performance.now() - startedAt),
      htmlLength: html.length,
      jsonLdArticleKeys: articleJsonLdKeys(html),
      structuralTokens: collectStructuralTokens(html),
      bylineSelectorHints: collectBylineHints(html),
      contentCandidates: collectContainerCandidates(html),
    };
  } catch (error: unknown) {
    return {
      targetId: target.id,
      publisher: target.publisher,
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      error:
        error instanceof Error && error.name === "AbortError"
          ? "Timed out after 20000ms"
          : error instanceof Error
            ? error.message
            : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const results: TargetDiagnostic[] = [];

  for (const target of TARGETS) results.push(await inspectTarget(target));

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        contentPolicy: "structure-only-no-article-text",
        results,
      },
      null,
      2,
    ),
  );

  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
