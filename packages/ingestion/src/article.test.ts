import assert from "node:assert/strict";
import test from "node:test";

import {
  extractNormalizedArticle,
  fetchAndInspectArticle,
  validateArticleUrl,
  type ArticleTarget,
} from "./article.ts";

const target: ArticleTarget = {
  id: "fixture-vne",
  publisher: "VnExpress",
  category: "technology",
  url: "https://vnexpress.net/example-article.html",
};

test("extracts normalized article from JSON-LD articleBody", () => {
  const body = [
    "Đây là đoạn nội dung đầu tiên đủ dài để mô phỏng một bài báo thật trong bộ kiểm thử.",
    "Đoạn thứ hai tiếp tục cung cấp dữ kiện và đảm bảo nội dung vượt qua ngưỡng chất lượng tối thiểu.",
    "Đoạn cuối xác nhận bộ trích xuất có thể tạo hash ổn định mà không phụ thuộc vào giao diện trang.",
  ].join(" ");

  const article = extractNormalizedArticle(
    target,
    `<!doctype html>
      <html>
        <head>
          <link rel="canonical" href="https://vnexpress.net/example-article.html">
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              "headline": "Tiêu đề thử nghiệm",
              "datePublished": "2026-08-04T07:00:00+07:00",
              "dateModified": "2026-08-04T07:30:00+07:00",
              "author": [{"@type": "Person", "name": "Tác giả A"}],
              "articleBody": ${JSON.stringify(body)}
            }
          </script>
        </head>
      </html>`,
  );

  assert.equal(article.title, "Tiêu đề thử nghiệm");
  assert.equal(article.author, "Tác giả A");
  assert.equal(article.extractionStrategy, "json-ld-article-body");
  assert.equal(article.publishedAt, "2026-08-04T07:00:00+07:00");
  assert.equal(article.updatedAt, "2026-08-04T07:30:00+07:00");
  assert.equal(article.contentHash.length, 64);
  assert.ok(article.text.length >= 250);
});

test("falls back to Open Graph metadata and article paragraphs", () => {
  const article = extractNormalizedArticle(
    {
      ...target,
      publisher: "Tuổi Trẻ",
      url: "https://tuoitre.vn/example.htm",
    },
    `<!doctype html>
      <html>
        <head>
          <meta property="og:title" content="Tiêu đề từ Open Graph">
          <meta property="og:url" content="https://tuoitre.vn/example.htm">
          <meta property="article:published_time" content="2026-08-04T06:00:00+07:00">
          <meta name="author" content="Tác giả B">
        </head>
        <body>
          <article>
            <p>Đoạn một có đủ độ dài để được xem là nội dung chính thay vì một nhãn điều hướng ngắn.</p>
            <p>Đoạn hai bổ sung thêm thông tin quan trọng và tiếp tục làm tăng độ dài tổng thể của bài viết.</p>
            <p>Đoạn ba mô tả bối cảnh, số liệu và chi tiết cần thiết để vượt qua ngưỡng chất lượng.</p>
            <p>Đoạn bốn kết thúc fixture bằng một nội dung rõ ràng, không chứa quảng cáo hay lời kêu gọi đăng ký.</p>
          </article>
        </body>
      </html>`,
  );

  assert.equal(article.title, "Tiêu đề từ Open Graph");
  assert.equal(article.author, "Tác giả B");
  assert.equal(article.extractionStrategy, "article-paragraphs");
  assert.equal(article.paragraphCount, 4);
  assert.ok(article.text.includes("Đoạn bốn"));
});

test("rejects disallowed or insecure article URLs", () => {
  assert.throws(
    () => validateArticleUrl("VnExpress", "http://vnexpress.net/article"),
    /must use HTTPS/,
  );

  assert.throws(
    () => validateArticleUrl("VnExpress", "https://example.com/article"),
    /not allowed/,
  );
});

test("fails closed when main text is too short", () => {
  assert.throws(
    () =>
      extractNormalizedArticle(
        target,
        "<html><head><title>Short</title></head><body><p>Too short.</p></body></html>",
      ),
    /minimum quality threshold/,
  );
});

test("fetch inspection returns metrics without returning article text", async () => {
  const longBody = "Nội dung kiểm thử ".repeat(40);

  const result = await fetchAndInspectArticle(target, {
    fetchImpl: async () =>
      new Response(
        `<html><head>
          <script type="application/ld+json">
            {
              "@type": "NewsArticle",
              "headline": "Fetched title",
              "articleBody": ${JSON.stringify(longBody)}
            }
          </script>
        </head></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        },
      ),
  });

  assert.equal(result.ok, true);
  assert.equal(result.title, "Fetched title");
  assert.ok((result.textLength ?? 0) >= 250);
  assert.equal("text" in result, false);
});

test("rejects cross-domain redirects", async () => {
  const result = await fetchAndInspectArticle(target, {
    fetchImpl: async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/redirected" },
      }),
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /not allowed/);
});
