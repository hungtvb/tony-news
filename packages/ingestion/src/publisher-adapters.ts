import type { Publisher } from "./article.ts";

export interface PublisherContentResult {
  text: string;
  paragraphCount: number;
  strategy: "publisher-container";
  selector: string;
}

interface ContainerRule {
  tagName: "article" | "div";
  requiredClasses: readonly string[];
  selector: string;
}

const RULES: Readonly<Partial<Record<Publisher, ContainerRule>>> = {
  VnExpress: {
    tagName: "article",
    requiredClasses: ["fck_detail"],
    selector: "article.fck_detail",
  },
  "Tuổi Trẻ": {
    tagName: "div",
    requiredClasses: ["detail-content", "afcbc-body"],
    selector: "div.detail-content.afcbc-body",
  },
};

const ENTITY_MAP: Readonly<Record<string, string>> = {
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
      return ENTITY_MAP[token.toLowerCase()] ?? entity;
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
  const withoutNoise = fragment
    .replace(/<(script|style|noscript|svg|form|button)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  return normalizeWhitespace(
    decodeHtmlEntities(
      withoutNoise
        .replace(/<(br|hr)\b[^>]*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|blockquote)>/gi, "\n")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function classTokens(openingTag: string): string[] {
  const match = openingTag.match(/\bclass\s*=\s*(["'])(.*?)\1/i);
  return match?.[2]?.split(/\s+/).filter(Boolean) ?? [];
}

function hasRequiredClasses(
  openingTag: string,
  requiredClasses: readonly string[],
): boolean {
  const tokens = new Set(classTokens(openingTag));
  return requiredClasses.every((required) => tokens.has(required));
}

export function extractBalancedElementByClasses(
  html: string,
  rule: ContainerRule,
): string | undefined {
  const openingPattern = new RegExp(`<${rule.tagName}\\b[^>]*>`, "gi");

  for (const match of html.matchAll(openingPattern)) {
    if (!hasRequiredClasses(match[0], rule.requiredClasses)) continue;

    const startIndex = match.index ?? 0;
    const contentStart = startIndex + match[0].length;
    const tokenPattern = new RegExp(`<\\/?${rule.tagName}\\b[^>]*>`, "gi");
    tokenPattern.lastIndex = contentStart;
    let depth = 1;

    for (const token of html.matchAll(tokenPattern)) {
      const tokenIndex = token.index ?? 0;
      if (tokenIndex < contentStart) continue;

      if (token[0].startsWith("</")) {
        depth -= 1;
        if (depth === 0) return html.slice(contentStart, tokenIndex);
      } else if (!token[0].endsWith("/>")) {
        depth += 1;
      }
    }
  }

  return undefined;
}

function stripKnownNoise(fragment: string): string {
  const noisyClass =
    /(?:VCSortableInPreviewMode|detail__related|detail__qc|box-related|box-tinlienquan|content-readmore|readmore-body-box|ads|advertisement)/i;
  let output = fragment;

  for (const match of fragment.matchAll(/<(div|section|aside)\b[^>]*>/gi)) {
    if (!noisyClass.test(match[0])) continue;

    const tagName = (match[1] ?? "div") as "div" | "section" | "aside";
    const className = classTokens(match[0]);
    if (className.length === 0) continue;

    const rule: ContainerRule = {
      tagName: tagName === "aside" || tagName === "section" ? "div" : tagName,
      requiredClasses: [className[0] ?? ""],
      selector: "noise",
    };

    if (tagName !== "div") continue;
    const inner = extractBalancedElementByClasses(output, rule);
    if (inner) output = output.replace(inner, " ");
  }

  return output;
}

function extractParagraphs(fragment: string): string[] {
  const paragraphs: string[] = [];

  for (const match of stripKnownNoise(fragment).matchAll(
    /<p\b[^>]*>([\s\S]*?)<\/p>/gi,
  )) {
    if (!match[1]) continue;
    const text = htmlFragmentToText(match[1]);

    if (
      text.length >= 30 &&
      !/^(xem thêm|đọc thêm|theo dõi|chia sẻ|đăng ký|nguồn:|tin liên quan)/i.test(
        text,
      )
    ) {
      paragraphs.push(text);
    }
  }

  return paragraphs;
}

export function extractPublisherContent(
  publisher: Publisher,
  html: string,
): PublisherContentResult | undefined {
  const rule = RULES[publisher];
  if (!rule) return undefined;

  const fragment = extractBalancedElementByClasses(html, rule);
  if (!fragment) return undefined;

  const paragraphs = extractParagraphs(fragment);
  const text = normalizeWhitespace(paragraphs.join("\n\n"));
  if (text.length < 250 || paragraphs.length < 2) return undefined;

  return {
    text,
    paragraphCount: paragraphs.length,
    strategy: "publisher-container",
    selector: rule.selector,
  };
}
