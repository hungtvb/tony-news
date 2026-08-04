import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  after,
  before,
  beforeEach,
  describe,
  test,
} from "node:test";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import {
  createPoolArticleRepository,
  persistArticleSnapshotWithRetry,
  postgresErrorCode,
  type ArticleRepositoryHandle,
} from "./node-postgres.ts";
import type { ArticleSnapshot } from "./persistence.ts";
import {
  articleSources,
  articleVersions,
  articles,
  sources,
} from "./schema.ts";

const databaseUrl = process.env.DATABASE_URL?.trim();

function snapshot(overrides: Partial<ArticleSnapshot> = {}): ArticleSnapshot {
  return {
    sourceId: "tto-tech",
    sourceArticleId: "100260801212001232",
    canonicalUrl: "https://tuoitre.vn/example.htm",
    title: "Google tạm dừng AI tạo ảnh",
    author: "HOÀNG THI",
    authorStatus: "reported",
    publishedAt: new Date("2026-08-01T15:05:00Z"),
    sourceUpdatedAt: new Date("2026-08-01T15:49:00Z"),
    contentHash: "hash-v1",
    normalizedText: "Nội dung phiên bản một đủ dài để persistence không phụ thuộc AI.",
    textLength: 68,
    paragraphCount: 3,
    extractionStrategy: "publisher-container",
    extractionSelector: "div.detail-content.afcbc-body",
    qualityDecision: "ready",
    qualityWarnings: [],
    observedAt: new Date("2026-08-04T01:00:00Z"),
    ...overrides,
  };
}

async function rowCount(
  handle: ArticleRepositoryHandle,
  table: typeof articles | typeof articleSources | typeof articleVersions,
): Promise<number> {
  const rows = await handle.database
    .select({ value: sql<number>`count(*)::int` })
    .from(table);
  return rows[0]?.value ?? 0;
}

if (!databaseUrl) {
  test(
    "PostgreSQL integration suite requires DATABASE_URL",
    { skip: "DATABASE_URL is not configured" },
    () => undefined,
  );
} else {
  describe("Drizzle node-postgres repository", { concurrency: 1 }, () => {
    let handle: ArticleRepositoryHandle;

    before(async () => {
      handle = createPoolArticleRepository(databaseUrl, {
        maxConnections: 10,
      });
      await migrate(handle.database, {
        migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
      });
    });

    beforeEach(async () => {
      await handle.database.execute(sql`
        truncate table
          processing_failures,
          ingestion_runs,
          article_versions,
          article_sources,
          articles,
          source_endpoints,
          sources
        restart identity cascade
      `);

      await handle.database.insert(sources).values([
        {
          id: "tto-tech",
          publisher: "Tuổi Trẻ",
          category: "technology",
          pollIntervalSeconds: 900,
          legalStatus: "poc-only",
        },
        {
          id: "tto-ent",
          publisher: "Tuổi Trẻ",
          category: "entertainment",
          pollIntervalSeconds: 900,
          legalStatus: "poc-only",
        },
      ]);
    });

    after(async () => {
      await handle.close();
    });

    test("applies the migration and creates article, source link, and version", async () => {
      const result = await persistArticleSnapshotWithRetry(
        handle.repository,
        snapshot(),
      );

      assert.equal(result.outcome, "created");
      assert.equal(result.versionNumber, 1);
      assert.equal(await rowCount(handle, articles), 1);
      assert.equal(await rowCount(handle, articleSources), 1);
      assert.equal(await rowCount(handle, articleVersions), 1);
    });

    test("replays unchanged content without appending a version", async () => {
      await persistArticleSnapshotWithRetry(handle.repository, snapshot());
      const observedAt = new Date("2026-08-04T02:00:00Z");

      const result = await persistArticleSnapshotWithRetry(
        handle.repository,
        snapshot({
          title: "Google tạm dừng AI tạo ảnh - metadata mới",
          observedAt,
        }),
      );

      assert.equal(result.outcome, "unchanged");
      assert.equal(await rowCount(handle, articleVersions), 1);

      const articleRows = await handle.database.select().from(articles);
      assert.equal(articleRows[0]?.title, "Google tạm dừng AI tạo ảnh - metadata mới");
      assert.equal(articleRows[0]?.lastSeenAt.toISOString(), observedAt.toISOString());
    });

    test("appends exactly one immutable version for changed content", async () => {
      await persistArticleSnapshotWithRetry(handle.repository, snapshot());

      const result = await persistArticleSnapshotWithRetry(
        handle.repository,
        snapshot({
          contentHash: "hash-v2",
          normalizedText: "Nội dung phiên bản hai đã được nguồn cập nhật.",
          textLength: 48,
          title: "Google cập nhật quyết định về AI tạo ảnh",
          observedAt: new Date("2026-08-04T03:00:00Z"),
        }),
      );

      assert.equal(result.outcome, "version-appended");
      assert.equal(result.versionNumber, 2);
      assert.equal(await rowCount(handle, articles), 1);
      assert.equal(await rowCount(handle, articleVersions), 2);

      const versionRows = await handle.database
        .select({
          versionNumber: articleVersions.versionNumber,
          contentHash: articleVersions.contentHash,
        })
        .from(articleVersions)
        .orderBy(articleVersions.versionNumber);
      assert.deepEqual(versionRows, [
        { versionNumber: 1, contentHash: "hash-v1" },
        { versionNumber: 2, contentHash: "hash-v2" },
      ]);
    });

    test("refreshes canonical URL through stable source identity", async () => {
      await persistArticleSnapshotWithRetry(handle.repository, snapshot());
      const canonicalUrl = "https://tuoitre.vn/example-updated.htm";

      const result = await persistArticleSnapshotWithRetry(
        handle.repository,
        snapshot({
          canonicalUrl,
          observedAt: new Date("2026-08-04T04:00:00Z"),
        }),
      );

      assert.equal(result.outcome, "unchanged");
      assert.equal(await rowCount(handle, articles), 1);
      assert.equal(await rowCount(handle, articleVersions), 1);
      const articleRows = await handle.database.select().from(articles);
      assert.equal(articleRows[0]?.canonicalUrl, canonicalUrl);
    });

    test("links a second feed without duplicating article content", async () => {
      await persistArticleSnapshotWithRetry(handle.repository, snapshot());

      const result = await persistArticleSnapshotWithRetry(
        handle.repository,
        snapshot({
          sourceId: "tto-ent",
          sourceArticleId: "ent-100260801212001232",
          observedAt: new Date("2026-08-04T05:00:00Z"),
        }),
      );

      assert.equal(result.outcome, "unchanged");
      assert.equal(await rowCount(handle, articles), 1);
      assert.equal(await rowCount(handle, articleVersions), 1);
      assert.equal(await rowCount(handle, articleSources), 2);

      const sourceRows = await handle.database
        .select({ sourceId: articleSources.sourceId })
        .from(articleSources)
        .orderBy(articleSources.sourceId);
      assert.deepEqual(sourceRows, [
        { sourceId: "tto-ent" },
        { sourceId: "tto-tech" },
      ]);
    });

    test("retries concurrent first discovery without duplicate rows", async () => {
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          persistArticleSnapshotWithRetry(
            handle.repository,
            snapshot({
              observedAt: new Date(`2026-08-04T06:00:0${index}Z`),
            }),
            { maxAttempts: 5, delayMs: 20 },
          ),
        ),
      );

      assert.equal(results.filter((result) => result.outcome === "created").length, 1);
      assert.equal(results.filter((result) => result.outcome === "unchanged").length, 5);
      assert.equal(await rowCount(handle, articles), 1);
      assert.equal(await rowCount(handle, articleSources), 1);
      assert.equal(await rowCount(handle, articleVersions), 1);
    });

    test("appends a version when content reverts to a previously seen hash", async () => {
      await persistArticleSnapshotWithRetry(handle.repository, snapshot());
      await persistArticleSnapshotWithRetry(
        handle.repository,
        snapshot({
          contentHash: "hash-v2",
          normalizedText: "Nội dung phiên bản hai đã được nguồn cập nhật.",
          textLength: 48,
          observedAt: new Date("2026-08-04T06:30:00Z"),
        }),
      );

      const result = await persistArticleSnapshotWithRetry(
        handle.repository,
        snapshot({
          contentHash: "hash-v1",
          title: "Google khôi phục nội dung phiên bản trước",
          observedAt: new Date("2026-08-04T07:00:00Z"),
        }),
      );

      assert.equal(result.outcome, "version-appended");
      assert.equal(result.versionNumber, 3);
      assert.equal(await rowCount(handle, articleVersions), 3);

      const versionRows = await handle.database
        .select({
          versionNumber: articleVersions.versionNumber,
          contentHash: articleVersions.contentHash,
        })
        .from(articleVersions)
        .orderBy(articleVersions.versionNumber);
      assert.deepEqual(versionRows, [
        { versionNumber: 1, contentHash: "hash-v1" },
        { versionNumber: 2, contentHash: "hash-v2" },
        { versionNumber: 3, contentHash: "hash-v1" },
      ]);
    });

    test("rolls back article insertion when source link persistence fails", async () => {
      await assert.rejects(
        persistArticleSnapshotWithRetry(
          handle.repository,
          snapshot({
            sourceId: "missing-source",
            sourceArticleId: "missing-source-article",
          }),
        ),
        (error: unknown) => {
          assert.equal(postgresErrorCode(error), "23503");
          return true;
        },
      );

      assert.equal(await rowCount(handle, articles), 0);
      assert.equal(await rowCount(handle, articleSources), 0);
      assert.equal(await rowCount(handle, articleVersions), 0);
    });
  });
}
