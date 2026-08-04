import assert from "node:assert/strict";
import test from "node:test";

import {
  BrowserRunBudget,
  fetchBrowserMarkdown,
  toBrowserMarkdownMetrics,
} from "./browser-run.ts";
import type { ArticleTarget } from "./article-normalized.ts";

const target: ArticleTarget = {
  id: "fixture-tto-browser",
  publisher: "Tuổi Trẻ",
  category: "technology",
  url: "https://tuoitre.vn/example.htm",
};

const config = {
  accountId: "account-123",
  apiToken: "secret-token",
  apiBaseUrl: "https://api.cloudflare.test/client/v4",
};

test("calls the markdown endpoint with a validated article URL", async () => {
  let requestedUrl = "";
  let authorization = "";
  let body = "";

  const result = await fetchBrowserMarkdown(target, config, {
    budget: new BrowserRunBudget(1),
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      body = String(init?.body ?? "");
      return Response.json({
        success: true,
        result: { markdown: "Nội dung markdown hợp lệ ".repeat(20) },
      });
    },
  });

  assert.equal(
    requestedUrl,
    "https://api.cloudflare.test/client/v4/accounts/account-123/browser-rendering/markdown",
  );
  assert.equal(authorization, "Bearer secret-token");
  assert.deepEqual(JSON.parse(body), { url: "https://tuoitre.vn/example.htm" });
  assert.ok(result.textLength >= 250);
  assert.equal(result.contentHash.length, 64);
});

test("supports a string result envelope and strips markdown from metrics", async () => {
  const result = await fetchBrowserMarkdown(target, config, {
    fetchImpl: async () =>
      Response.json({ success: true, result: "Markdown trực tiếp ".repeat(25) }),
  });

  const metrics = toBrowserMarkdownMetrics(result);
  assert.equal("markdown" in metrics, false);
  assert.equal(metrics.textLength, result.textLength);
});

test("rejects an article URL outside the publisher allowlist before fetch", async () => {
  let called = false;

  await assert.rejects(
    fetchBrowserMarkdown(
      { ...target, url: "https://example.com/article" },
      config,
      {
        fetchImpl: async () => {
          called = true;
          return Response.json({ success: true, result: "x".repeat(300) });
        },
      },
    ),
    /not allowed/,
  );

  assert.equal(called, false);
});

test("enforces the per-run Browser Run request budget", async () => {
  const budget = new BrowserRunBudget(1);
  const fetchImpl: typeof fetch = async () =>
    Response.json({ success: true, result: "Nội dung ".repeat(40) });

  await fetchBrowserMarkdown(target, config, { budget, fetchImpl });
  await assert.rejects(
    fetchBrowserMarkdown(target, config, { budget, fetchImpl }),
    /budget exhausted/,
  );
  assert.equal(budget.usedRequests, 1);
});

test("does not include the API token in provider errors", async () => {
  await assert.rejects(
    fetchBrowserMarkdown(target, config, {
      fetchImpl: async () =>
        Response.json(
          { success: false, errors: [{ message: "permission denied" }] },
          { status: 403 },
        ),
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /permission denied/);
      assert.equal(error.message.includes(config.apiToken), false);
      return true;
    },
  );
});
