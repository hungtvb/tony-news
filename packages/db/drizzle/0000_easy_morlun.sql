CREATE TYPE "public"."article_quality_decision" AS ENUM('ready', 'review', 'fallback-required', 'failed');--> statement-breakpoint
CREATE TYPE "public"."article_author_status" AS ENUM('reported', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."source_endpoint_type" AS ENUM('rss', 'api', 'html');--> statement-breakpoint
CREATE TYPE "public"."ingestion_run_kind" AS ENUM('source-poll', 'article-fetch', 'article-process', 'story-match', 'story-summarize');--> statement-breakpoint
CREATE TYPE "public"."ingestion_run_status" AS ENUM('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."news_category" AS ENUM('technology', 'entertainment', 'sports', 'other');--> statement-breakpoint
CREATE TYPE "public"."processing_failure_category" AS ENUM('network', 'timeout', 'rate-limit', 'invalid-feed', 'invalid-html', 'extraction', 'validation', 'persistence', 'provider', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('active', 'paused', 'disabled');--> statement-breakpoint
CREATE TABLE "article_sources" (
	"article_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"source_article_id" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_sources_article_source_pk" PRIMARY KEY("article_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "article_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content_hash" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"author_status" "article_author_status" DEFAULT 'unknown' NOT NULL,
	"published_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"normalized_text" text NOT NULL,
	"text_length" integer NOT NULL,
	"paragraph_count" integer NOT NULL,
	"extraction_strategy" text NOT NULL,
	"extraction_selector" text,
	"quality_decision" "article_quality_decision" NOT NULL,
	"quality_warnings" jsonb,
	"raw_artifact_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_versions_version_positive_chk" CHECK ("article_versions"."version_number" > 0),
	CONSTRAINT "article_versions_text_length_nonnegative_chk" CHECK ("article_versions"."text_length" >= 0),
	CONSTRAINT "article_versions_paragraph_count_nonnegative_chk" CHECK ("article_versions"."paragraph_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"author_status" "article_author_status" DEFAULT 'unknown' NOT NULL,
	"published_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"current_content_hash" text NOT NULL,
	"current_version_number" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_current_version_positive_chk" CHECK ("articles"."current_version_number" > 0),
	CONSTRAINT "articles_canonical_url_https_chk" CHECK ("articles"."canonical_url" like 'https://%')
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ingestion_run_kind" NOT NULL,
	"status" "ingestion_run_status" DEFAULT 'queued' NOT NULL,
	"idempotency_key" text NOT NULL,
	"trace_id" text NOT NULL,
	"source_id" text,
	"article_id" uuid,
	"processing_version" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"input" jsonb,
	"metrics" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingestion_runs_attempt_positive_chk" CHECK ("ingestion_runs"."attempt" > 0),
	CONSTRAINT "ingestion_runs_max_attempts_valid_chk" CHECK ("ingestion_runs"."max_attempts" >= "ingestion_runs"."attempt")
);
--> statement-breakpoint
CREATE TABLE "processing_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_run_id" uuid NOT NULL,
	"category" "processing_failure_category" NOT NULL,
	"retryable" boolean DEFAULT false NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"type" "source_endpoint_type" NOT NULL,
	"url" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_endpoints_https_chk" CHECK ("source_endpoints"."url" like 'https://%')
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher" text NOT NULL,
	"category" "news_category" NOT NULL,
	"status" "source_status" DEFAULT 'active' NOT NULL,
	"poll_interval_seconds" integer DEFAULT 900 NOT NULL,
	"legal_status" text DEFAULT 'poc-only' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_poll_interval_positive_chk" CHECK ("sources"."poll_interval_seconds" > 0)
);
--> statement-breakpoint
ALTER TABLE "article_sources" ADD CONSTRAINT "article_sources_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_sources" ADD CONSTRAINT "article_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_failures" ADD CONSTRAINT "processing_failures_ingestion_run_id_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_endpoints" ADD CONSTRAINT "source_endpoints_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_sources_source_article_id_uq" ON "article_sources" USING btree ("source_id","source_article_id") WHERE "article_sources"."source_article_id" is not null;--> statement-breakpoint
CREATE INDEX "article_sources_source_last_seen_idx" ON "article_sources" USING btree ("source_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "article_sources_article_idx" ON "article_sources" USING btree ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "article_versions_article_version_uq" ON "article_versions" USING btree ("article_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "article_versions_article_hash_uq" ON "article_versions" USING btree ("article_id","content_hash");--> statement-breakpoint
CREATE INDEX "article_versions_article_created_idx" ON "article_versions" USING btree ("article_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_canonical_url_uq" ON "articles" USING btree ("canonical_url");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_last_seen_idx" ON "articles" USING btree ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_runs_idempotency_key_uq" ON "ingestion_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ingestion_runs_status_created_idx" ON "ingestion_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ingestion_runs_source_kind_idx" ON "ingestion_runs" USING btree ("source_id","kind");--> statement-breakpoint
CREATE INDEX "ingestion_runs_article_kind_idx" ON "ingestion_runs" USING btree ("article_id","kind");--> statement-breakpoint
CREATE INDEX "processing_failures_run_idx" ON "processing_failures" USING btree ("ingestion_run_id");--> statement-breakpoint
CREATE INDEX "processing_failures_category_retryable_idx" ON "processing_failures" USING btree ("category","retryable");--> statement-breakpoint
CREATE UNIQUE INDEX "source_endpoints_source_url_uq" ON "source_endpoints" USING btree ("source_id","url");--> statement-breakpoint
CREATE INDEX "source_endpoints_source_type_idx" ON "source_endpoints" USING btree ("source_id","type");--> statement-breakpoint
CREATE INDEX "sources_status_idx" ON "sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sources_category_status_idx" ON "sources" USING btree ("category","status");