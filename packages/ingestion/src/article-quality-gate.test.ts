import assert from "node:assert/strict";
import test from "node:test";

import {
  decideArticleQuality,
  fetchAndInspectArticle,
  type ArticleTarget,
} from "./article-normalized.ts";

const vnExpressTarget: ArticleTarget = {
  id: "quality-vne",
  publisher: "VnExpress",
  category: "technology",
  url: "https://vnexpress.net/example.html",
};

test("quality decision blocks broad page fallback", () => {
  assert.equal(
    decideArticleQuality(true, ["broad-page-paragraph-fallback"]),
    "fallback-required",
  );
  assert.equal(decideArticleQuality(true, []), "ready");
  assert.equal(decideArticleQuality(false, []), "failed");
});

test("publisher-as-author is removed and represented as author unknown", async () => {
  const result = await fetchAndInspectArticle(vnExpressTarget, {
    fetchImpl: async () =>
      new Response(
        `<html><head>
          <meta property="og:title" content="Quality fixture">
          <meta name="author" content="VnExpress">
        </head><body><article>
          <p>${"Nội dung chính đủ dài để vượt ngưỡng kiểm thử. ".repeat(8)}</p>
        </article></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      ),
  });

  assert.equal(result.ok, true);
  assert.equal(result.authorStatus, "unknown");
  assert.equal(result.author, undefined);
  assert.equal(result.qualityDecision, "ready");
  assert.deepEqual(result.qualityWarnings, [
    "publisher-reported-as-author",
  ]);
});

test("high-volume page fallback is marked fallback-required", async () => {
  const paragraphs = Array.from(
    { length: 31 },
    (_, index) =>
      `<p>Đoạn ${index + 1} đủ dài để mô phỏng phần văn bản được quét từ toàn trang báo.</p>`,
  ).join("");

  const result = await fetchAndInspectArticle(
    {
      id: "quality-tto",
      publisher: "Tuổi Trẻ",
      category: "technology",
      url: "https://tuoitre.vn/example.htm",
    },
    {
      fetchImpl: async () =>
        new Response(
          `<html><head><meta property="og:title" content="Fallback fixture"></head><body>${paragraphs}</body></html>`,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        ),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.qualityDecision, "fallback-required");
  assert.deepEqual(result.qualityWarnings, [
    "broad-page-paragraph-fallback",
    "high-paragraph-count",
  ]);
});
