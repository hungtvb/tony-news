import assert from "node:assert/strict";
import test from "node:test";

import {
  extractNormalizedArticle,
  fetchAndInspectArticle,
  normalizeExtractedText,
  type ArticleTarget,
} from "./article-normalized.ts";

const tuoiTreTarget: ArticleTarget = {
  id: "fixture-tto",
  publisher: "Tuổi Trẻ",
  category: "technology",
  url: "https://tuoitre.vn/example.htm",
};

test("decodes repeated numeric and named HTML entities", () => {
  assert.equal(
    normalizeExtractedText("Google tr&amp;#234;n Earth v&amp;#236; AI"),
    "Google trên Earth vì AI",
  );
});

test("normalizes encoded JSON-LD headline and author", () => {
  const article = extractNormalizedArticle(
    tuoiTreTarget,
    `<html><head>
      <script type="application/ld+json">
        {
          "@type": "NewsArticle",
          "headline": "Google tr&amp;#234;n Earth v&amp;#236; AI",
          "author": {"name": "HO&amp;#192;NG THI"},
          "articleBody": ${JSON.stringify("Nội dung đủ dài ".repeat(30))}
        }
      </script>
    </head></html>`,
  );

  assert.equal(article.title, "Google trên Earth vì AI");
  assert.equal(article.author, "HOÀNG THI");
});

test("flags page-wide fallback and suspicious publisher author", async () => {
  const paragraphs = Array.from(
    { length: 35 },
    (_, index) =>
      `<p>Đoạn nội dung số ${index + 1} đủ dài để được bộ trích xuất giữ lại trong fixture kiểm thử.</p>`,
  ).join("");

  const result = await fetchAndInspectArticle(
    {
      id: "fixture-vne-warning",
      publisher: "VnExpress",
      category: "technology",
      url: "https://vnexpress.net/example.html",
    },
    {
      fetchImpl: async () =>
        new Response(
          `<html><head>
            <meta property="og:title" content="Fixture warning">
            <meta name="author" content="VnExpress">
          </head><body>${paragraphs}</body></html>`,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        ),
    },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.qualityWarnings, [
    "broad-page-paragraph-fallback",
    "high-paragraph-count",
    "publisher-reported-as-author",
  ]);
});
