import process from "node:process";

import {
  fetchAndInspectArticle,
  type ArticleTarget,
} from "../../../packages/ingestion/src/article-normalized.ts";
import {
  BrowserRunBudget,
  fetchBrowserMarkdown,
  toBrowserMarkdownMetrics,
} from "../../../packages/ingestion/src/browser-run.ts";

const TARGET: ArticleTarget = {
  id: "tto-google-earth-ai-browser-run",
  publisher: "Tuổi Trẻ",
  category: "technology",
  url: "https://tuoitre.vn/google-tam-dung-ai-tao-anh-tren-google-earth-vi-lo-anh-ve-tinh-gia-100260801212001232.htm",
};

async function main(): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    console.log(
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          status: "skipped",
          reason: "missing-cloudflare-browser-run-credentials",
          requiredSecrets: [
            "CLOUDFLARE_ACCOUNT_ID",
            "CLOUDFLARE_API_TOKEN",
          ],
          contentPolicy: "metrics-only-no-markdown-or-article-text",
        },
        null,
        2,
      ),
    );
    return;
  }

  const direct = await fetchAndInspectArticle(TARGET);
  const browser = await fetchBrowserMarkdown(
    TARGET,
    { accountId, apiToken },
    { budget: new BrowserRunBudget(1) },
  );
  const browserMetrics = toBrowserMarkdownMetrics(browser);

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        status: "completed",
        contentPolicy: "metrics-only-no-markdown-or-article-text",
        targetId: TARGET.id,
        direct: {
          ok: direct.ok,
          textLength: direct.textLength,
          paragraphCount: direct.paragraphCount,
          extractionStrategy: direct.extractionStrategy,
          extractionSelector: direct.extractionSelector,
          qualityDecision: direct.qualityDecision,
          qualityWarnings: direct.qualityWarnings ?? [],
          durationMs: direct.durationMs,
          contentHash: direct.contentHash,
        },
        browserRun: browserMetrics,
        comparison: {
          lengthRatio:
            direct.textLength && direct.textLength > 0
              ? Number((browserMetrics.textLength / direct.textLength).toFixed(3))
              : null,
          sameContentHash: direct.contentHash === browserMetrics.contentHash,
          requestCount: 1,
          browserSeconds:
            "not-exposed-by-markdown-quick-action-response; verify in Cloudflare usage analytics",
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        status: "failed",
        contentPolicy: "metrics-only-no-markdown-or-article-text",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
