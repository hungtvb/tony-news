import assert from "node:assert/strict";
import test from "node:test";

import { parseRssFeed } from "./rss.ts";
import {
  PHASE_0_SOURCES,
  validateSourceRegistry,
} from "./source-registry.ts";

test("source registry contains nine valid unique feeds", () => {
  assert.equal(PHASE_0_SOURCES.length, 9);
  assert.deepEqual(validateSourceRegistry(PHASE_0_SOURCES), []);
});

test("parses RSS 2.0 items with CDATA and entities", () => {
  const feed = parseRssFeed(`<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <title>Tony &amp; News</title>
        <item>
          <title><![CDATA[Google & AI]]></title>
          <link>https://example.com/google-ai</link>
          <guid>article-1</guid>
          <pubDate>Mon, 03 Aug 2026 08:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>`);

  assert.equal(feed.format, "rss");
  assert.equal(feed.title, "Tony & News");
  assert.equal(feed.items.length, 1);
  assert.deepEqual(feed.items[0], {
    title: "Google & AI",
    link: "https://example.com/google-ai",
    guid: "article-1",
    publishedAt: "Mon, 03 Aug 2026 08:00:00 GMT",
  });
});

test("parses Atom alternate links", () => {
  const feed = parseRssFeed(`<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Example Atom</title>
      <entry>
        <title>Story title</title>
        <link rel="alternate" href="https://example.com/story" />
        <id>story-1</id>
        <updated>2026-08-03T10:00:00Z</updated>
      </entry>
    </feed>`);

  assert.equal(feed.format, "atom");
  assert.equal(feed.items[0]?.link, "https://example.com/story");
  assert.equal(feed.items[0]?.guid, "story-1");
});

test("rejects HTML masquerading as a feed", () => {
  assert.throws(
    () => parseRssFeed("<html><body>not a feed</body></html>"),
    /Unsupported XML feed root/,
  );
});

test("rejects feeds without usable article entries", () => {
  assert.throws(
    () =>
      parseRssFeed(
        "<rss version='2.0'><channel><title>Empty</title></channel></rss>",
      ),
    /No valid item entries found/,
  );
});
