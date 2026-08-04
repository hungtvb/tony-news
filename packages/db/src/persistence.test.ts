import assert from "node:assert/strict";
import test from "node:test";

import {
  persistArticleSnapshot,
  type ArticleIdentity,
  type ArticlePersistenceRepository,
  type ArticlePersistenceTransaction,
  type ArticleSnapshot,
  type ArticleSourceLink,
  type NewArticleHead,
  type NewArticleVersion,
  type StoredArticleHead,
  type UpdateArticleHead,
} from "./persistence.ts";

class InMemoryArticleRepository implements ArticlePersistenceRepository {
  readonly articles = new Map<string, NewArticleHead & StoredArticleHead>();
  readonly articleIdByCanonicalUrl = new Map<string, string>();
  readonly articleIdBySourceIdentity = new Map<string, string>();
  readonly sourceLinks = new Map<string, ArticleSourceLink>();
  readonly versions: NewArticleVersion[] = [];
  transactionCount = 0;
  #nextId = 1;

  async transaction<T>(
    operation: (transaction: ArticlePersistenceTransaction) => Promise<T>,
  ): Promise<T> {
    this.transactionCount += 1;

    const transaction: ArticlePersistenceTransaction = {
      findArticleForUpdate: async (identity) => this.find(identity),
      insertArticle: async (input) => this.insert(input),
      upsertArticleSourceLink: async (input) => this.upsertSourceLink(input),
      insertArticleVersion: async (input) => {
        const duplicate = this.versions.some(
          (version) =>
            version.articleId === input.articleId &&
            (version.versionNumber === input.versionNumber ||
              version.contentHash === input.contentHash),
        );
        if (duplicate) throw new Error("duplicate article version");
        this.versions.push(input);
      },
      updateArticleHead: async (input) => this.update(input),
    };

    return operation(transaction);
  }

  private sourceIdentity(identity: {
    sourceId: string;
    sourceArticleId?: string;
  }): string | undefined {
    return identity.sourceArticleId
      ? `${identity.sourceId}:${identity.sourceArticleId}`
      : undefined;
  }

  private find(identity: ArticleIdentity): StoredArticleHead | undefined {
    const sourceIdentity = this.sourceIdentity(identity);
    const articleId =
      (sourceIdentity
        ? this.articleIdBySourceIdentity.get(sourceIdentity)
        : undefined) ?? this.articleIdByCanonicalUrl.get(identity.canonicalUrl);
    if (!articleId) return undefined;

    const article = this.articles.get(articleId);
    if (!article) return undefined;
    return {
      id: article.id,
      currentContentHash: article.currentContentHash,
      currentVersionNumber: article.currentVersionNumber,
    };
  }

  private insert(input: NewArticleHead): StoredArticleHead {
    if (this.articleIdByCanonicalUrl.has(input.canonicalUrl)) {
      throw new Error("duplicate canonical URL");
    }

    const id = `article-${this.#nextId}`;
    this.#nextId += 1;
    const article = { ...input, id };
    this.articles.set(id, article);
    this.articleIdByCanonicalUrl.set(input.canonicalUrl, id);

    return {
      id,
      currentContentHash: input.currentContentHash,
      currentVersionNumber: input.currentVersionNumber,
    };
  }

  private upsertSourceLink(input: ArticleSourceLink): void {
    const key = `${input.articleId}:${input.sourceId}`;
    const sourceIdentity = this.sourceIdentity(input);
    const conflictingArticleId = sourceIdentity
      ? this.articleIdBySourceIdentity.get(sourceIdentity)
      : undefined;

    if (conflictingArticleId && conflictingArticleId !== input.articleId) {
      throw new Error("duplicate source identity");
    }

    const existing = this.sourceLinks.get(key);
    const link: ArticleSourceLink = {
      articleId: input.articleId,
      sourceId: input.sourceId,
      observedAt: input.observedAt,
    };
    if (input.sourceArticleId) link.sourceArticleId = input.sourceArticleId;

    if (existing?.sourceArticleId && existing.sourceArticleId !== input.sourceArticleId) {
      this.articleIdBySourceIdentity.delete(
        `${existing.sourceId}:${existing.sourceArticleId}`,
      );
    }

    this.sourceLinks.set(key, link);
    if (sourceIdentity) {
      this.articleIdBySourceIdentity.set(sourceIdentity, input.articleId);
    }
  }

  private update(input: UpdateArticleHead): void {
    const article = this.articles.get(input.articleId);
    if (!article) throw new Error("article not found");

    const conflictingArticleId = this.articleIdByCanonicalUrl.get(
      input.canonicalUrl,
    );
    if (conflictingArticleId && conflictingArticleId !== input.articleId) {
      throw new Error("duplicate canonical URL");
    }

    if (article.canonicalUrl !== input.canonicalUrl) {
      this.articleIdByCanonicalUrl.delete(article.canonicalUrl);
      this.articleIdByCanonicalUrl.set(input.canonicalUrl, input.articleId);
    }

    article.canonicalUrl = input.canonicalUrl;
    article.title = input.title;
    article.authorStatus = input.authorStatus;
    article.currentContentHash = input.currentContentHash;
    article.currentVersionNumber = input.currentVersionNumber;
    article.lastSeenAt = input.lastSeenAt;

    if (input.author) article.author = input.author;
    else delete article.author;
    if (input.publishedAt) article.publishedAt = input.publishedAt;
    else delete article.publishedAt;
    if (input.sourceUpdatedAt) article.sourceUpdatedAt = input.sourceUpdatedAt;
    else delete article.sourceUpdatedAt;
  }
}

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

test("creates an article, source link, and immutable version in one transaction", async () => {
  const repository = new InMemoryArticleRepository();
  const result = await persistArticleSnapshot(repository, snapshot());

  assert.deepEqual(result, {
    outcome: "created",
    articleId: "article-1",
    versionNumber: 1,
  });
  assert.equal(repository.transactionCount, 1);
  assert.equal(repository.articles.size, 1);
  assert.equal(repository.sourceLinks.size, 1);
  assert.equal(repository.versions.length, 1);
  assert.equal(repository.versions[0]?.contentHash, "hash-v1");
});

test("refreshes article metadata without appending an unchanged version", async () => {
  const repository = new InMemoryArticleRepository();
  await persistArticleSnapshot(repository, snapshot());

  const observedAt = new Date("2026-08-04T02:00:00Z");
  const result = await persistArticleSnapshot(
    repository,
    snapshot({
      title: "Google tạm dừng AI tạo ảnh - cập nhật metadata",
      observedAt,
    }),
  );

  assert.equal(result.outcome, "unchanged");
  assert.equal(result.versionNumber, 1);
  assert.equal(repository.articles.size, 1);
  assert.equal(repository.versions.length, 1);
  assert.equal(repository.articles.get("article-1")?.lastSeenAt, observedAt);
  assert.equal(
    repository.articles.get("article-1")?.title,
    "Google tạm dừng AI tạo ảnh - cập nhật metadata",
  );
  assert.equal(
    repository.sourceLinks.get("article-1:tto-tech")?.observedAt,
    observedAt,
  );
});

test("appends an immutable version and advances the article head", async () => {
  const repository = new InMemoryArticleRepository();
  await persistArticleSnapshot(repository, snapshot());

  const result = await persistArticleSnapshot(
    repository,
    snapshot({
      contentHash: "hash-v2",
      normalizedText: "Nội dung phiên bản hai đã được nguồn cập nhật.",
      title: "Google cập nhật quyết định về AI tạo ảnh",
      observedAt: new Date("2026-08-04T03:00:00Z"),
    }),
  );

  assert.deepEqual(result, {
    outcome: "version-appended",
    articleId: "article-1",
    versionNumber: 2,
  });
  assert.equal(repository.articles.size, 1);
  assert.equal(repository.versions.length, 2);
  assert.deepEqual(
    repository.versions.map((version) => version.contentHash),
    ["hash-v1", "hash-v2"],
  );
  assert.equal(
    repository.articles.get("article-1")?.currentContentHash,
    "hash-v2",
  );
  assert.equal(
    repository.articles.get("article-1")?.currentVersionNumber,
    2,
  );
});

test("resolves by source identity and refreshes a changed canonical URL", async () => {
  const repository = new InMemoryArticleRepository();
  await persistArticleSnapshot(repository, snapshot());

  const updatedUrl = "https://tuoitre.vn/example-updated.htm";
  const result = await persistArticleSnapshot(
    repository,
    snapshot({
      canonicalUrl: updatedUrl,
      observedAt: new Date("2026-08-04T04:00:00Z"),
    }),
  );

  assert.equal(result.outcome, "unchanged");
  assert.equal(repository.articles.size, 1);
  assert.equal(repository.versions.length, 1);
  assert.equal(repository.articles.get("article-1")?.canonicalUrl, updatedUrl);
  assert.equal(repository.articleIdByCanonicalUrl.get(updatedUrl), "article-1");
  assert.equal(
    repository.articleIdByCanonicalUrl.has("https://tuoitre.vn/example.htm"),
    false,
  );
});

test("links the same canonical article to another feed without overwriting source", async () => {
  const repository = new InMemoryArticleRepository();
  await persistArticleSnapshot(repository, snapshot());

  const result = await persistArticleSnapshot(
    repository,
    snapshot({
      sourceId: "tto-ent",
      sourceArticleId: "ent-100260801212001232",
      observedAt: new Date("2026-08-04T05:00:00Z"),
    }),
  );

  assert.equal(result.outcome, "unchanged");
  assert.equal(repository.articles.size, 1);
  assert.equal(repository.versions.length, 1);
  assert.equal(repository.sourceLinks.size, 2);
  assert.equal(
    repository.sourceLinks.get("article-1:tto-tech")?.sourceId,
    "tto-tech",
  );
  assert.equal(
    repository.sourceLinks.get("article-1:tto-ent")?.sourceId,
    "tto-ent",
  );
});

test("rejects content that has not passed extraction quality gates", async () => {
  const repository = new InMemoryArticleRepository();

  await assert.rejects(
    persistArticleSnapshot(
      repository,
      snapshot({ qualityDecision: "fallback-required" }),
    ),
    /must be quality-ready/,
  );

  assert.equal(repository.transactionCount, 0);
  assert.equal(repository.articles.size, 0);
});
