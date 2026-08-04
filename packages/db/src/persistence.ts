export type PersistArticleOutcome =
  | "created"
  | "unchanged"
  | "version-appended";

export interface ArticleIdentity {
  sourceId: string;
  canonicalUrl: string;
  sourceArticleId?: string;
}

export interface ArticleSnapshot extends ArticleIdentity {
  title: string;
  author?: string;
  authorStatus: "reported" | "unknown";
  publishedAt?: Date;
  sourceUpdatedAt?: Date;
  contentHash: string;
  normalizedText: string;
  textLength: number;
  paragraphCount: number;
  extractionStrategy: string;
  extractionSelector?: string;
  qualityDecision: "ready" | "review" | "fallback-required" | "failed";
  qualityWarnings?: string[];
  rawArtifactKey?: string;
  observedAt: Date;
}

export interface StoredArticleHead {
  id: string;
  currentContentHash: string;
  currentVersionNumber: number;
}

export interface NewArticleHead extends ArticleIdentity {
  title: string;
  author?: string;
  authorStatus: ArticleSnapshot["authorStatus"];
  publishedAt?: Date;
  sourceUpdatedAt?: Date;
  currentContentHash: string;
  currentVersionNumber: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface NewArticleVersion {
  articleId: string;
  versionNumber: number;
  contentHash: string;
  title: string;
  author?: string;
  authorStatus: ArticleSnapshot["authorStatus"];
  publishedAt?: Date;
  sourceUpdatedAt?: Date;
  normalizedText: string;
  textLength: number;
  paragraphCount: number;
  extractionStrategy: string;
  extractionSelector?: string;
  qualityDecision: ArticleSnapshot["qualityDecision"];
  qualityWarnings?: string[];
  rawArtifactKey?: string;
}

export interface UpdateArticleHead {
  articleId: string;
  title: string;
  author?: string;
  authorStatus: ArticleSnapshot["authorStatus"];
  publishedAt?: Date;
  sourceUpdatedAt?: Date;
  currentContentHash: string;
  currentVersionNumber: number;
  lastSeenAt: Date;
}

export interface ArticlePersistenceTransaction {
  findArticleForUpdate(identity: ArticleIdentity): Promise<StoredArticleHead | undefined>;
  insertArticle(input: NewArticleHead): Promise<StoredArticleHead>;
  insertArticleVersion(input: NewArticleVersion): Promise<void>;
  updateArticleHead(input: UpdateArticleHead): Promise<void>;
  touchArticle(articleId: string, observedAt: Date): Promise<void>;
}

export interface ArticlePersistenceRepository {
  transaction<T>(
    operation: (transaction: ArticlePersistenceTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface PersistArticleResult {
  outcome: PersistArticleOutcome;
  articleId: string;
  versionNumber: number;
}

function optionalFields(snapshot: ArticleSnapshot): {
  author?: string;
  publishedAt?: Date;
  sourceUpdatedAt?: Date;
  extractionSelector?: string;
  qualityWarnings?: string[];
  rawArtifactKey?: string;
} {
  const result: {
    author?: string;
    publishedAt?: Date;
    sourceUpdatedAt?: Date;
    extractionSelector?: string;
    qualityWarnings?: string[];
    rawArtifactKey?: string;
  } = {};

  if (snapshot.author) result.author = snapshot.author;
  if (snapshot.publishedAt) result.publishedAt = snapshot.publishedAt;
  if (snapshot.sourceUpdatedAt) result.sourceUpdatedAt = snapshot.sourceUpdatedAt;
  if (snapshot.extractionSelector) {
    result.extractionSelector = snapshot.extractionSelector;
  }
  if (snapshot.qualityWarnings) {
    result.qualityWarnings = [...snapshot.qualityWarnings];
  }
  if (snapshot.rawArtifactKey) result.rawArtifactKey = snapshot.rawArtifactKey;

  return result;
}

function identityFields(identity: ArticleIdentity): ArticleIdentity {
  const result: ArticleIdentity = {
    sourceId: identity.sourceId,
    canonicalUrl: identity.canonicalUrl,
  };
  if (identity.sourceArticleId) result.sourceArticleId = identity.sourceArticleId;
  return result;
}

function versionInput(
  articleId: string,
  versionNumber: number,
  snapshot: ArticleSnapshot,
): NewArticleVersion {
  return {
    articleId,
    versionNumber,
    contentHash: snapshot.contentHash,
    title: snapshot.title,
    authorStatus: snapshot.authorStatus,
    normalizedText: snapshot.normalizedText,
    textLength: snapshot.textLength,
    paragraphCount: snapshot.paragraphCount,
    extractionStrategy: snapshot.extractionStrategy,
    qualityDecision: snapshot.qualityDecision,
    ...optionalFields(snapshot),
  };
}

export async function persistArticleSnapshot(
  repository: ArticlePersistenceRepository,
  snapshot: ArticleSnapshot,
): Promise<PersistArticleResult> {
  if (snapshot.qualityDecision !== "ready") {
    throw new Error(
      `Article snapshot must be quality-ready before persistence: ${snapshot.qualityDecision}`,
    );
  }

  return repository.transaction(async (transaction) => {
    const identity = identityFields(snapshot);
    const existing = await transaction.findArticleForUpdate(identity);

    if (!existing) {
      const article = await transaction.insertArticle({
        ...identity,
        title: snapshot.title,
        authorStatus: snapshot.authorStatus,
        currentContentHash: snapshot.contentHash,
        currentVersionNumber: 1,
        firstSeenAt: snapshot.observedAt,
        lastSeenAt: snapshot.observedAt,
        ...optionalFields(snapshot),
      });

      await transaction.insertArticleVersion(
        versionInput(article.id, 1, snapshot),
      );

      return {
        outcome: "created",
        articleId: article.id,
        versionNumber: 1,
      };
    }

    if (existing.currentContentHash === snapshot.contentHash) {
      await transaction.touchArticle(existing.id, snapshot.observedAt);
      return {
        outcome: "unchanged",
        articleId: existing.id,
        versionNumber: existing.currentVersionNumber,
      };
    }

    const nextVersionNumber = existing.currentVersionNumber + 1;
    await transaction.insertArticleVersion(
      versionInput(existing.id, nextVersionNumber, snapshot),
    );
    await transaction.updateArticleHead({
      articleId: existing.id,
      title: snapshot.title,
      authorStatus: snapshot.authorStatus,
      currentContentHash: snapshot.contentHash,
      currentVersionNumber: nextVersionNumber,
      lastSeenAt: snapshot.observedAt,
      ...optionalFields(snapshot),
    });

    return {
      outcome: "version-appended",
      articleId: existing.id,
      versionNumber: nextVersionNumber,
    };
  });
}
