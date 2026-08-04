# ADR-0004: PostgreSQL persistence and immutable article versions

- Status: Accepted for Phase 0
- Date: 2026-08-04
- Related issue: #7

## Context

RSS discovery and direct article extraction now produce quality-gated article snapshots. The next boundary must make repeated ingestion safe, preserve source updates, and remain operational when AI providers are unavailable.

News articles can change without changing their URL. Conversely, a publisher can change a canonical URL while retaining a stable source article identifier. The same canonical article can also appear in multiple publisher feeds or categories. Overwriting article content or storing only one feed source would lose evidence used by future clustering, citation validation, and summary review.

## Decision

1. PostgreSQL is the source of truth for source configuration, article identity, immutable article versions, ingestion runs, and typed failures.
2. Drizzle ORM defines the TypeScript schema; Drizzle Kit generates committed SQL migrations and metadata.
3. `articles` stores one mutable canonical head:
   - current canonical URL and metadata;
   - current content hash and version number;
   - first/last observation timestamps.
4. `article_sources` stores many-to-many discovery links:
   - composite key `(article_id, source_id)`;
   - optional stable publisher `source_article_id`;
   - per-source first/last observation timestamps;
   - partial unique `(source_id, source_article_id)` when an ID exists.
5. `article_versions` is append-only at the domain boundary:
   - unique `(article_id, version_number)`;
   - non-adjacent versions may repeat a content hash when a publisher restores previously published content;
   - normalized text, extraction evidence, quality decision, and optional raw-artifact reference.
6. Persistence runs inside one repository transaction:
   - no existing identity → create article, source link, and version 1;
   - same content hash → upsert the source link and refresh article head/last-seen metadata without another version;
   - changed content hash → upsert the source link, append the next immutable version, then advance the head, even when that hash appeared in an older non-current version.
7. Article lookup prefers stable `(source_id, source_article_id)` links when available, then falls back to canonical URL.
8. A stable source identity may refresh a changed canonical URL without creating a content version when the content hash is unchanged.
9. Multiple feeds may link to the same canonical article without overwriting each other or creating duplicate article versions.
10. Only extraction output with `qualityDecision: ready` enters article persistence automatically.
11. AI availability is not part of the persistence transaction. AI processing consumes persisted article versions later.
12. Ingestion runs use a unique idempotency key, explicit status transitions, trace IDs, processing versions, attempt counters, and typed retryable failures.

## Database objects

Phase 0 migration creates:

- `sources`
- `source_endpoints`
- `articles`
- `article_sources`
- `article_versions`
- `ingestion_runs`
- `processing_failures`

It also creates the supporting PostgreSQL enums, foreign keys, partial/composite unique indexes, operational indexes, HTTPS checks, and positive-counter checks.

## Migration policy

- Schema changes must run `pnpm db:generate`.
- Generated SQL and Drizzle metadata are committed.
- CI regenerates migrations and checks both tracked changes and untracked files under `packages/db/drizzle`.
- Migration files must not be manually rewritten after generation except for an explicitly reviewed corrective migration.

## Verification

The domain contract remains covered by deterministic unit tests. The concrete Drizzle/node-postgres repository is also exercised against PostgreSQL 17 in CI. The combined suites prove:

- first ingestion creates one article, one source link, and one version;
- repeated unchanged ingestion does not create a duplicate version;
- metadata and canonical identity can refresh without changing the version;
- changed content appends exactly one immutable version and advances the head;
- content restored to a previously observed non-current hash appends a new immutable version;
- the same canonical article discovered through another feed creates another `article_sources` link but not another article/version;
- concurrent first discovery is re-read/retried without duplicate rows;
- article, provenance, and version writes roll back together when a transaction fails;
- non-ready extraction output is rejected before opening a transaction;
- ingestion status transitions and retry decisions are validated.

CI applies migrations from an empty PostgreSQL database, enforces a frozen pnpm lockfile, and regenerates Drizzle metadata to detect migration drift.

## Consequences

### Positive

- Repeated RSS/article jobs are idempotent at the domain and database-constraint levels.
- Historical evidence remains available for summary/citation audits.
- AI outages cannot block source ingestion or persistence.
- URL changes do not necessarily create duplicate articles.
- Category/feed overlap does not overwrite source provenance.
- Migration drift is caught in CI.

### Negative

- Article text versions consume more storage than overwriting a single row.
- Database migrations have not yet been applied to a production or preview Supabase project.
- Production connection limits, transaction isolation, and Hyperdrive behavior still require environment-specific evidence.
- Canonical URL conflicts across genuinely distinct publisher articles need an explicit collision policy.

## Deferred

- Live Supabase preview migration and rollback evidence.
- Cloudflare Hyperdrive resource creation and production connection tuning.
- Cloudflare Queue consumers.
- Story, claim, summary, and citation tables.
- Retention/archival policy for historical normalized text and raw artifacts.
