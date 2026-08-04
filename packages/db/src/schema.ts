import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const newsCategoryEnum = pgEnum("news_category", [
  "technology",
  "entertainment",
  "sports",
  "other",
]);

export const sourceStatusEnum = pgEnum("source_status", [
  "active",
  "paused",
  "disabled",
]);

export const endpointTypeEnum = pgEnum("source_endpoint_type", [
  "rss",
  "api",
  "html",
]);

export const authorStatusEnum = pgEnum("article_author_status", [
  "reported",
  "unknown",
]);

export const articleQualityDecisionEnum = pgEnum(
  "article_quality_decision",
  ["ready", "review", "fallback-required", "failed"],
);

export const ingestionRunKindEnum = pgEnum("ingestion_run_kind", [
  "source-poll",
  "article-fetch",
  "article-process",
  "story-match",
  "story-summarize",
]);

export const ingestionRunStatusEnum = pgEnum("ingestion_run_status", [
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
]);

export const processingFailureCategoryEnum = pgEnum(
  "processing_failure_category",
  [
    "network",
    "timeout",
    "rate-limit",
    "invalid-feed",
    "invalid-html",
    "extraction",
    "validation",
    "persistence",
    "provider",
    "unknown",
  ],
);

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey(),
    publisher: text("publisher").notNull(),
    category: newsCategoryEnum("category").notNull(),
    status: sourceStatusEnum("status").default("active").notNull(),
    pollIntervalSeconds: integer("poll_interval_seconds")
      .default(900)
      .notNull(),
    legalStatus: text("legal_status").default("poc-only").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithTimezone("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sources_status_idx").on(table.status),
    index("sources_category_status_idx").on(table.category, table.status),
    check(
      "sources_poll_interval_positive_chk",
      sql`${table.pollIntervalSeconds} > 0`,
    ),
  ],
);

export const sourceEndpoints = pgTable(
  "source_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    type: endpointTypeEnum("type").notNull(),
    url: text("url").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithTimezone("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("source_endpoints_source_url_uq").on(
      table.sourceId,
      table.url,
    ),
    index("source_endpoints_source_type_idx").on(table.sourceId, table.type),
    check("source_endpoints_https_chk", sql`${table.url} like 'https://%'`),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title").notNull(),
    author: text("author"),
    authorStatus: authorStatusEnum("author_status").default("unknown").notNull(),
    publishedAt: timestampWithTimezone("published_at"),
    sourceUpdatedAt: timestampWithTimezone("source_updated_at"),
    currentContentHash: text("current_content_hash").notNull(),
    currentVersionNumber: integer("current_version_number")
      .default(1)
      .notNull(),
    firstSeenAt: timestampWithTimezone("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestampWithTimezone("last_seen_at").defaultNow().notNull(),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithTimezone("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("articles_canonical_url_uq").on(table.canonicalUrl),
    index("articles_published_idx").on(table.publishedAt),
    index("articles_last_seen_idx").on(table.lastSeenAt),
    check(
      "articles_current_version_positive_chk",
      sql`${table.currentVersionNumber} > 0`,
    ),
    check("articles_canonical_url_https_chk", sql`${table.canonicalUrl} like 'https://%'`),
  ],
);

export const articleSources = pgTable(
  "article_sources",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    sourceArticleId: text("source_article_id"),
    firstSeenAt: timestampWithTimezone("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestampWithTimezone("last_seen_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "article_sources_article_source_pk",
      columns: [table.articleId, table.sourceId],
    }),
    uniqueIndex("article_sources_source_article_id_uq")
      .on(table.sourceId, table.sourceArticleId)
      .where(sql`${table.sourceArticleId} is not null`),
    index("article_sources_source_last_seen_idx").on(
      table.sourceId,
      table.lastSeenAt,
    ),
    index("article_sources_article_idx").on(table.articleId),
  ],
);

export const articleVersions = pgTable(
  "article_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    contentHash: text("content_hash").notNull(),
    title: text("title").notNull(),
    author: text("author"),
    authorStatus: authorStatusEnum("author_status").default("unknown").notNull(),
    publishedAt: timestampWithTimezone("published_at"),
    sourceUpdatedAt: timestampWithTimezone("source_updated_at"),
    normalizedText: text("normalized_text").notNull(),
    textLength: integer("text_length").notNull(),
    paragraphCount: integer("paragraph_count").notNull(),
    extractionStrategy: text("extraction_strategy").notNull(),
    extractionSelector: text("extraction_selector"),
    qualityDecision: articleQualityDecisionEnum("quality_decision").notNull(),
    qualityWarnings: jsonb("quality_warnings").$type<string[]>(),
    rawArtifactKey: text("raw_artifact_key"),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("article_versions_article_version_uq").on(
      table.articleId,
      table.versionNumber,
    ),
    uniqueIndex("article_versions_article_hash_uq").on(
      table.articleId,
      table.contentHash,
    ),
    index("article_versions_article_created_idx").on(
      table.articleId,
      table.createdAt,
    ),
    check("article_versions_version_positive_chk", sql`${table.versionNumber} > 0`),
    check("article_versions_text_length_nonnegative_chk", sql`${table.textLength} >= 0`),
    check(
      "article_versions_paragraph_count_nonnegative_chk",
      sql`${table.paragraphCount} >= 0`,
    ),
  ],
);

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: ingestionRunKindEnum("kind").notNull(),
    status: ingestionRunStatusEnum("status").default("queued").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    traceId: text("trace_id").notNull(),
    sourceId: text("source_id").references(() => sources.id, {
      onDelete: "set null",
    }),
    articleId: uuid("article_id").references(() => articles.id, {
      onDelete: "set null",
    }),
    processingVersion: text("processing_version").notNull(),
    attempt: integer("attempt").default(1).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    input: jsonb("input").$type<Record<string, unknown>>(),
    metrics: jsonb("metrics").$type<Record<string, unknown>>(),
    startedAt: timestampWithTimezone("started_at"),
    finishedAt: timestampWithTimezone("finished_at"),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
    updatedAt: timestampWithTimezone("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("ingestion_runs_idempotency_key_uq").on(table.idempotencyKey),
    index("ingestion_runs_status_created_idx").on(table.status, table.createdAt),
    index("ingestion_runs_source_kind_idx").on(table.sourceId, table.kind),
    index("ingestion_runs_article_kind_idx").on(table.articleId, table.kind),
    check("ingestion_runs_attempt_positive_chk", sql`${table.attempt} > 0`),
    check(
      "ingestion_runs_max_attempts_valid_chk",
      sql`${table.maxAttempts} >= ${table.attempt}`,
    ),
  ],
);

export const processingFailures = pgTable(
  "processing_failures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ingestionRunId: uuid("ingestion_run_id")
      .notNull()
      .references(() => ingestionRuns.id, { onDelete: "cascade" }),
    category: processingFailureCategoryEnum("category").notNull(),
    retryable: boolean("retryable").default(false).notNull(),
    message: text("message").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    occurredAt: timestampWithTimezone("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    index("processing_failures_run_idx").on(table.ingestionRunId),
    index("processing_failures_category_retryable_idx").on(
      table.category,
      table.retryable,
    ),
  ],
);

export type SourceRow = typeof sources.$inferSelect;
export type NewSourceRow = typeof sources.$inferInsert;
export type ArticleRow = typeof articles.$inferSelect;
export type NewArticleRow = typeof articles.$inferInsert;
export type ArticleSourceRow = typeof articleSources.$inferSelect;
export type NewArticleSourceRow = typeof articleSources.$inferInsert;
export type ArticleVersionRow = typeof articleVersions.$inferSelect;
export type NewArticleVersionRow = typeof articleVersions.$inferInsert;
export type IngestionRunRow = typeof ingestionRuns.$inferSelect;
export type ProcessingFailureRow = typeof processingFailures.$inferSelect;
