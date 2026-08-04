import { and, eq } from "drizzle-orm";
import {
  drizzle,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";

import {
  articleSources,
  articleVersions,
  articles,
} from "./schema.ts";
import * as schema from "./schema.ts";
import {
  persistArticleSnapshot,
  type ArticleIdentity,
  type ArticlePersistenceRepository,
  type ArticlePersistenceTransaction,
  type ArticleSnapshot,
  type NewArticleHead,
  type NewArticleVersion,
  type PersistArticleResult,
  type StoredArticleHead,
  type UpdateArticleHead,
  type ArticleSourceLink,
} from "./persistence.ts";

export type TonyNewsDatabase = NodePgDatabase<typeof schema>;

export interface ArticleRepositoryHandle {
  database: TonyNewsDatabase;
  repository: ArticlePersistenceRepository;
  close(): Promise<void>;
}

export interface PoolRepositoryOptions {
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface PersistRetryOptions {
  maxAttempts?: number;
  delayMs?: number;
}

interface PostgreSqlErrorShape {
  code?: string;
  constraint?: string;
  table?: string;
}

type UniqueViolationError = PostgreSqlErrorShape & { code: "23505" };

function assertPostgresConnectionString(value: string): string {
  const trimmed = value.trim();
  if (!/^postgres(?:ql)?:\/\//i.test(trimmed)) {
    throw new Error("PostgreSQL connection string must use postgres:// or postgresql://");
  }
  return trimmed;
}

function isPostgreSqlErrorShape(value: unknown): value is PostgreSqlErrorShape {
  return typeof value === "object" && value !== null;
}

export function isUniqueViolation(
  error: unknown,
): error is UniqueViolationError {
  return isPostgreSqlErrorShape(error) && error.code === "23505";
}

export function uniqueViolationConstraint(error: unknown): string | undefined {
  if (!isUniqueViolation(error)) return undefined;
  return typeof error.constraint === "string" ? error.constraint : undefined;
}

function optionalArticleHeadValues(input: NewArticleHead): {
  author?: string;
  publishedAt?: Date;
  sourceUpdatedAt?: Date;
} {
  const values: {
    author?: string;
    publishedAt?: Date;
    sourceUpdatedAt?: Date;
  } = {};
  if (input.author) values.author = input.author;
  if (input.publishedAt) values.publishedAt = input.publishedAt;
  if (input.sourceUpdatedAt) values.sourceUpdatedAt = input.sourceUpdatedAt;
  return values;
}

function optionalArticleVersionValues(input: NewArticleVersion): {
  author?: string;
  publishedAt?: Date;
  sourceUpdatedAt?: Date;
  extractionSelector?: string;
  qualityWarnings?: string[];
  rawArtifactKey?: string;
} {
  const values: {
    author?: string;
    publishedAt?: Date;
    sourceUpdatedAt?: Date;
    extractionSelector?: string;
    qualityWarnings?: string[];
    rawArtifactKey?: string;
  } = {};
  if (input.author) values.author = input.author;
  if (input.publishedAt) values.publishedAt = input.publishedAt;
  if (input.sourceUpdatedAt) values.sourceUpdatedAt = input.sourceUpdatedAt;
  if (input.extractionSelector) {
    values.extractionSelector = input.extractionSelector;
  }
  if (input.qualityWarnings) {
    values.qualityWarnings = [...input.qualityWarnings];
  }
  if (input.rawArtifactKey) values.rawArtifactKey = input.rawArtifactKey;
  return values;
}

function toStoredArticleHead(row: {
  id: string;
  currentContentHash: string;
  currentVersionNumber: number;
}): StoredArticleHead {
  return {
    id: row.id,
    currentContentHash: row.currentContentHash,
    currentVersionNumber: row.currentVersionNumber,
  };
}

function createRepository(database: TonyNewsDatabase): ArticlePersistenceRepository {
  return {
    transaction: async <T>(
      operation: (transaction: ArticlePersistenceTransaction) => Promise<T>,
    ): Promise<T> =>
      database.transaction(async (databaseTransaction) => {
        const transaction: ArticlePersistenceTransaction = {
          findArticleForUpdate: async (
            identity: ArticleIdentity,
          ): Promise<StoredArticleHead | undefined> => {
            if (identity.sourceArticleId) {
              const sourceRows = await databaseTransaction
                .select({
                  id: articles.id,
                  currentContentHash: articles.currentContentHash,
                  currentVersionNumber: articles.currentVersionNumber,
                })
                .from(articleSources)
                .innerJoin(articles, eq(articleSources.articleId, articles.id))
                .where(
                  and(
                    eq(articleSources.sourceId, identity.sourceId),
                    eq(articleSources.sourceArticleId, identity.sourceArticleId),
                  ),
                )
                .limit(1)
                .for("update");

              const sourceRow = sourceRows[0];
              if (sourceRow) return toStoredArticleHead(sourceRow);
            }

            const canonicalRows = await databaseTransaction
              .select({
                id: articles.id,
                currentContentHash: articles.currentContentHash,
                currentVersionNumber: articles.currentVersionNumber,
              })
              .from(articles)
              .where(eq(articles.canonicalUrl, identity.canonicalUrl))
              .limit(1)
              .for("update");

            const canonicalRow = canonicalRows[0];
            return canonicalRow
              ? toStoredArticleHead(canonicalRow)
              : undefined;
          },

          insertArticle: async (
            input: NewArticleHead,
          ): Promise<StoredArticleHead> => {
            const rows = await databaseTransaction
              .insert(articles)
              .values({
                canonicalUrl: input.canonicalUrl,
                title: input.title,
                authorStatus: input.authorStatus,
                currentContentHash: input.currentContentHash,
                currentVersionNumber: input.currentVersionNumber,
                firstSeenAt: input.firstSeenAt,
                lastSeenAt: input.lastSeenAt,
                ...optionalArticleHeadValues(input),
              })
              .returning({
                id: articles.id,
                currentContentHash: articles.currentContentHash,
                currentVersionNumber: articles.currentVersionNumber,
              });

            const row = rows[0];
            if (!row) throw new Error("PostgreSQL did not return the inserted article");
            return toStoredArticleHead(row);
          },

          upsertArticleSourceLink: async (
            input: ArticleSourceLink,
          ): Promise<void> => {
            await databaseTransaction
              .insert(articleSources)
              .values({
                articleId: input.articleId,
                sourceId: input.sourceId,
                sourceArticleId: input.sourceArticleId ?? null,
                firstSeenAt: input.observedAt,
                lastSeenAt: input.observedAt,
              })
              .onConflictDoUpdate({
                target: [articleSources.articleId, articleSources.sourceId],
                set: {
                  sourceArticleId: input.sourceArticleId ?? null,
                  lastSeenAt: input.observedAt,
                },
              });
          },

          insertArticleVersion: async (
            input: NewArticleVersion,
          ): Promise<void> => {
            await databaseTransaction.insert(articleVersions).values({
              articleId: input.articleId,
              versionNumber: input.versionNumber,
              contentHash: input.contentHash,
              title: input.title,
              authorStatus: input.authorStatus,
              normalizedText: input.normalizedText,
              textLength: input.textLength,
              paragraphCount: input.paragraphCount,
              extractionStrategy: input.extractionStrategy,
              qualityDecision: input.qualityDecision,
              ...optionalArticleVersionValues(input),
            });
          },

          updateArticleHead: async (input: UpdateArticleHead): Promise<void> => {
            await databaseTransaction
              .update(articles)
              .set({
                canonicalUrl: input.canonicalUrl,
                title: input.title,
                author: input.author ?? null,
                authorStatus: input.authorStatus,
                publishedAt: input.publishedAt ?? null,
                sourceUpdatedAt: input.sourceUpdatedAt ?? null,
                currentContentHash: input.currentContentHash,
                currentVersionNumber: input.currentVersionNumber,
                lastSeenAt: input.lastSeenAt,
                updatedAt: input.lastSeenAt,
              })
              .where(eq(articles.id, input.articleId));
          },
        };

        return operation(transaction);
      }),
  };
}

export function createPoolArticleRepository(
  connectionString: string,
  options: PoolRepositoryOptions = {},
): ArticleRepositoryHandle {
  const pool = new Pool({
    connectionString: assertPostgresConnectionString(connectionString),
    max: options.maxConnections ?? 5,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 10_000,
  });
  const database = drizzle(pool, { schema });

  return {
    database,
    repository: createRepository(database),
    close: async () => pool.end(),
  };
}

export async function createHyperdriveArticleRepository(
  connectionString: string,
): Promise<ArticleRepositoryHandle> {
  const client = new Client({
    connectionString: assertPostgresConnectionString(connectionString),
  });
  await client.connect();
  const database = drizzle(client, { schema });

  return {
    database,
    repository: createRepository(database),
    close: async () => client.end(),
  };
}

function delay(durationMs: number): Promise<void> {
  return durationMs > 0
    ? new Promise((resolve) => setTimeout(resolve, durationMs))
    : Promise.resolve();
}

export async function persistArticleSnapshotWithRetry(
  repository: ArticlePersistenceRepository,
  snapshot: ArticleSnapshot,
  options: PersistRetryOptions = {},
): Promise<PersistArticleResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const delayMs = options.delayMs ?? 10;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("persist retry maxAttempts must be a positive integer");
  }
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error("persist retry delayMs must be non-negative");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await persistArticleSnapshot(repository, snapshot);
    } catch (error: unknown) {
      lastError = error;
      if (!isUniqueViolation(error) || attempt === maxAttempts) throw error;
      await delay(delayMs * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Article persistence retry exhausted");
}
