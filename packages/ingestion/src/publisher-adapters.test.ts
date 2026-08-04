import assert from "node:assert/strict";
import test from "node:test";

import {
  extractBalancedElementByClasses,
  extractPublisherContent,
} from "./publisher-adapters.ts";

test("extracts a balanced nested Tuổi Trẻ content container", () => {
  const html = `
    <div class="page-shell">
      <div class="detail-content afcbc-body">
        <div class="lead"><p>${"Mở đầu đủ dài ".repeat(8)}</p></div>
        <div><p>${"Nội dung chính đủ dài ".repeat(10)}</p></div>
        <div class="detail__related"><p>${"Tin liên quan không được giữ ".repeat(8)}</p></div>
      </div>
      <div class="footer"><p>${"Nội dung footer không được lấy ".repeat(8)}</p></div>
    </div>
  `;

  const fragment = extractBalancedElementByClasses(html, {
    tagName: "div",
    requiredClasses: ["detail-content", "afcbc-body"],
    selector: "div.detail-content.afcbc-body",
  });

  assert.ok(fragment?.includes("Nội dung chính"));
  assert.equal(fragment?.includes("Nội dung footer"), false);
});

test("uses the evidence-backed Tuổi Trẻ container", () => {
  const result = extractPublisherContent(
    "Tuổi Trẻ",
    `<html><body>
      <main><p>${"Boilerplate ngoài bài ".repeat(20)}</p></main>
      <div class="detail-content afcbc-body">
        <p>${"Đoạn một của bài viết ".repeat(12)}</p>
        <p>${"Đoạn hai của bài viết ".repeat(12)}</p>
        <p>${"Đoạn ba của bài viết ".repeat(12)}</p>
      </div>
    </body></html>`,
  );

  assert.equal(result?.strategy, "publisher-container");
  assert.equal(result?.selector, "div.detail-content.afcbc-body");
  assert.equal(result?.paragraphCount, 3);
  assert.equal(result?.text.includes("Boilerplate ngoài bài"), false);
});

test("uses article.fck_detail for VnExpress", () => {
  const result = extractPublisherContent(
    "VnExpress",
    `<html><body>
      <article class="fck_detail">
        <p>${"Đoạn VnExpress thứ nhất ".repeat(12)}</p>
        <p>${"Đoạn VnExpress thứ hai ".repeat(12)}</p>
      </article>
    </body></html>`,
  );

  assert.equal(result?.selector, "article.fck_detail");
  assert.equal(result?.paragraphCount, 2);
});
