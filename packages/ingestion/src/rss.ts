import type {
  NewsCategory,
  SourceDefinition,
} from "./source-registry.ts";

export interface RssItem {
  title: string;
  link: string;
  publishedAt?: string;
  guid?: string;
}

export interface ParsedFeed {
  format: "rss" | "atom";
  title?: string;
  items: RssItem[];
}

export interface FeedInspectionResult {
  sourceId: string;
  publisher: string;
  category: NewsCategory;
  feedUrl: string;
  ok: boolean;
  durationMs: number;
  httpStatus?: number;
  contentType?: string;
  itemCount?: number;
  latestPublishedAt?: string;
  error?: string;
}

const ENTITY_MAP: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: "\"",
};

function decodeXmlEntities(value: string): string {
  return value.replace(
    /&(#x?[0-9a-f]+|amp|apos|gt|lt|quot);/gi,
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

function cleanText(value: string): string {
  return decodeXmlEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstTagValue(block: string, tagNames: readonly string[]): string | undefined {
  for (const tagName of tagNames) {
    const tag = escapeRegExp(tagName);
    const match = block.match(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
    );

    if (match?.[1]) {
      const cleaned = cleanText(match[1]);
      if (cleaned) {
        return cleaned;
      }
    }
  }

  return undefined;
}

function atomLink(block: string): string | undefined {
  const alternate = block.match(
    /<link\b(?=[^>]*\brel=["']alternate["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*\/?>/i,
  );
  if (alternate?.[1]) {
    return decodeXmlEntities(alternate[1]).trim();
  }

  const anyLink = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  return anyLink?.[1] ? decodeXmlEntities(anyLink[1]).trim() : undefined;
}

function parseItem(block: string, format: "rss" | "atom"): RssItem | undefined {
  const title = firstTagValue(block, ["title"]);
  const link =
    format === "atom"
      ? atomLink(block) ?? firstTagValue(block, ["link"])
      : firstTagValue(block, ["link"]);

  if (!title || !link) {
    return undefined;
  }

  return {
    title,
    link,
    publishedAt: firstTagValue(block, ["pubDate", "published", "updated", "dc:date"]),
    guid: firstTagValue(block, ["guid", "id"]),
  };
}

function extractBlocks(xml: string, tagName: "item" | "entry"): string[] {
  const blocks: string[] = [];
  const pattern = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    "gi",
  );

  for (const match of xml.matchAll(pattern)) {
    if (match[1]) {
      blocks.push(match[1]);
    }
  }

  return blocks;
}

export function parseRssFeed(xml: string): ParsedFeed {
  const trimmed = xml.trim();

  if (!trimmed.startsWith("<")) {
    throw new Error("Feed response is not XML");
  }

  const format: "rss" | "atom" = /<feed(?:\s|>)/i.test(trimmed)
    ? "atom"
    : /<rss(?:\s|>)|<rdf:RDF(?:\s|>)/i.test(trimmed)
      ? "rss"
      : (() => {
          throw new Error("Unsupported XML feed root");
        })();

  const itemTag = format === "atom" ? "entry" : "item";
  const items = extractBlocks(trimmed, itemTag)
    .map((block) => parseItem(block, format))
    .filter((item): item is RssItem => item !== undefined);

  if (items.length === 0) {
    throw new Error(`No valid ${itemTag} entries found`);
  }

  const channelOrFeed =
    trimmed.match(/<channel(?:\s[^>]*)?>([\s\S]*?)<\/channel>/i)?.[1] ??
    trimmed.match(/<feed(?:\s[^>]*)?>([\s\S]*?)<\/feed>/i)?.[1] ??
    "";

  return {
    format,
    title: firstTagValue(channelOrFeed, ["title"]),
    items,
  };
}

function latestPublishedAt(items: readonly RssItem[]): string | undefined {
  const validDates = items
    .map((item) => item.publishedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ raw: value, time: Date.parse(value) }))
    .filter((candidate) => Number.isFinite(candidate.time))
    .sort((left, right) => right.time - left.time);

  return validDates[0]?.raw;
}

export async function fetchAndInspectFeed(
  source: SourceDefinition,
  options: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<FeedInspectionResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(source.feedUrl, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
        "user-agent": "TonyNews-Phase0-RSS-Smoke/0.1 (+https://github.com/hungtvb/tony-news)",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? undefined;
    const xml = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (contentType && !/xml|rss|atom/i.test(contentType)) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }

    const feed = parseRssFeed(xml);
    const latest = latestPublishedAt(feed.items);

    return {
      sourceId: source.id,
      publisher: source.publisher,
      category: source.category,
      feedUrl: source.feedUrl,
      ok: true,
      durationMs: Math.round(performance.now() - startedAt),
      httpStatus: response.status,
      ...(contentType ? { contentType } : {}),
      itemCount: feed.items.length,
      ...(latest ? { latestPublishedAt: latest } : {}),
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Timed out after ${timeoutMs}ms`
        : error instanceof Error
          ? error.message
          : String(error);

    return {
      sourceId: source.id,
      publisher: source.publisher,
      category: source.category,
      feedUrl: source.feedUrl,
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}
