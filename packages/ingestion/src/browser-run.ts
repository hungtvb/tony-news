import { createHash } from "node:crypto";

import {
  validateArticleUrl,
  type ArticleTarget,
} from "./article-normalized.ts";

export interface BrowserRunConfig {
  accountId: string;
  apiToken: string;
  apiBaseUrl?: string;
  timeoutMs?: number;
}

export interface BrowserMarkdownResult {
  requestedUrl: string;
  markdown: string;
  textLength: number;
  contentHash: string;
  durationMs: number;
}

export interface BrowserMarkdownMetrics {
  requestedUrl: string;
  textLength: number;
  contentHash: string;
  durationMs: number;
}

export class BrowserRunBudget {
  readonly maxRequests: number;
  #usedRequests = 0;

  constructor(maxRequests: number) {
    if (!Number.isInteger(maxRequests) || maxRequests < 0) {
      throw new Error("Browser Run maxRequests must be a non-negative integer");
    }
    this.maxRequests = maxRequests;
  }

  get usedRequests(): number {
    return this.#usedRequests;
  }

  consume(): void {
    if (this.#usedRequests >= this.maxRequests) {
      throw new Error(
        `Browser Run request budget exhausted (${this.#usedRequests}/${this.maxRequests})`,
      );
    }
    this.#usedRequests += 1;
  }
}

interface CloudflareEnvelope {
  success?: boolean;
  result?: unknown;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
}

function requiredSecret(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name} is required`);
  return trimmed;
}

function extractMarkdown(result: unknown): string | undefined {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return undefined;

  const record = result as Record<string, unknown>;
  if (typeof record.markdown === "string") return record.markdown;
  if (typeof record.content === "string") return record.content;
  return undefined;
}

function errorSummary(envelope: CloudflareEnvelope | undefined): string {
  const errors = envelope?.errors ?? envelope?.messages ?? [];
  const messages = errors
    .map((error) => error.message?.trim())
    .filter((message): message is string => Boolean(message));
  return messages.length > 0 ? messages.join("; ").slice(0, 500) : "unknown error";
}

export function toBrowserMarkdownMetrics(
  result: BrowserMarkdownResult,
): BrowserMarkdownMetrics {
  return {
    requestedUrl: result.requestedUrl,
    textLength: result.textLength,
    contentHash: result.contentHash,
    durationMs: result.durationMs,
  };
}

export async function fetchBrowserMarkdown(
  target: ArticleTarget,
  config: BrowserRunConfig,
  options: {
    fetchImpl?: typeof fetch;
    budget?: BrowserRunBudget;
  } = {},
): Promise<BrowserMarkdownResult> {
  const requestedUrl = validateArticleUrl(target.publisher, target.url).toString();
  const accountId = requiredSecret(config.accountId, "CLOUDFLARE_ACCOUNT_ID");
  const apiToken = requiredSecret(config.apiToken, "CLOUDFLARE_API_TOKEN");
  const apiBaseUrl = (config.apiBaseUrl ?? "https://api.cloudflare.com/client/v4").replace(
    /\/$/,
    "",
  );
  const timeoutMs = config.timeoutMs ?? 30_000;
  const fetchImpl = options.fetchImpl ?? fetch;

  // Reject over-budget calls before creating timers or network resources.
  options.budget?.consume();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetchImpl(
      `${apiBaseUrl}/accounts/${encodeURIComponent(accountId)}/browser-rendering/markdown`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ url: requestedUrl }),
        signal: controller.signal,
      },
    );

    const raw = await response.text();
    let envelope: CloudflareEnvelope | undefined;

    try {
      envelope = JSON.parse(raw) as CloudflareEnvelope;
    } catch {
      throw new Error(`Browser Run returned non-JSON response (HTTP ${response.status})`);
    }

    if (!response.ok || envelope.success === false) {
      throw new Error(
        `Browser Run markdown failed (HTTP ${response.status}): ${errorSummary(envelope)}`,
      );
    }

    const markdown = extractMarkdown(envelope.result);
    if (!markdown) throw new Error("Browser Run response did not contain markdown");

    const normalized = markdown.replace(/\r/g, "").trim();
    if (normalized.length < 250) {
      throw new Error("Browser Run markdown did not meet the minimum quality threshold");
    }

    return {
      requestedUrl,
      markdown: normalized,
      textLength: normalized.length,
      contentHash: createHash("sha256").update(normalized).digest("hex"),
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Browser Run markdown timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
