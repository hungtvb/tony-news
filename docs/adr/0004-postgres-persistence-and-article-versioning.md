# ADR-0004: PostgreSQL persistence and immutable article versions

- Status: Accepted for Phase 0
- Date: 2026-08-04
- Related issue: #7

## Context

RSS discovery and direct article extraction now produce quality-gated article snapshots. The next boundary must make repeated ingestion safe, preserve source updates, and remain operational when AI providers are unavailable.

News articles can change without changing their URL. Conversely, a publisher can change a canonical URL while retaining a stable source article identifier. Overwriting article content would lose evidence used by future clustering, citation validation, and summary review.

## Decision

1. PostgreSQL is the source of truth for source configuration, article identity, immutable article versions, ingestion runs, and typed failures.
2. Drizzle ORM defines the TypeScript schema; Drizzle Kit generates committed SQL migrations and metadata.
3. `articles` stores the mutable head:
   - source identity;
   - current canonical URL and metadata;
   - current content hash and version number;
   - first/last observation timestamps.
4. `article_versions` is append-only at the domain boundary:
   - unique `(article_id, version_number)`;
   - unique `(article_id, content_hash)`;
   - normalized text, extraction evidence, quality decision, and optional raw-artifact reference.
5. Persistence runs inside one repository transaction:
   - no existing identity → create article and version 1;
   - same content hash → refresh article head/last-seen metadata without another version;
   - changed content hash → append the next immutable version, then advance the head.
6. Article identity is resolved by stable `(source_id, source_article_id)` when available, otherwise by canonical URL.
7. A stable source identity may refresh a changed canonical URL without creating a content version when the content hash is unchanged.
8. Only extraction output with `qualityDecision: ready` enters article persistence automatically.
9. AI availability is not part of the persistence transaction. AI processing consumes persisted article versions later.
10. Ingestion runs use a unique idempotency key, explicit status transitions, trace IDs, processing versions, attempt counters, and typed retryable failures.

## Database objects

Phase 0 migration creates:

- `sources`
- `source_endpoints`
- `articles`
- `article_versions`
- `ingestion_runs`
- `processing_failures`

It also creates the supporting PostgreSQL enums, foreign keys, partial/composite unique indexes, operational indexes, HTTPS checks, and positive-counter checks.

## Migration policy

- Schema changes must run `pnpm db:generate`.
- Generated SQL and Drizzle metadata are committed.
- CI regenerates migrations and fails if `packages/db/drizzle` changes.
- Migration files must not be manually rewritten after generation except for an explicitly reviewed corrective migration.

## Verification

The persistence contract is tested with a deterministic in-memory transactional repository. Tests prove:

- first ingestion creates one article and one version;
- repeated unchanged ingestion does not create a duplicate version;
- metadata and canonical identity can refresh without changing the version;
- changed content appends exactly one immutable version and advances the head;
- non-ready extraction output is rejected before opening a transaction;
- ingestion status transitions and retry decisions are validated.

The initial PostgreSQL migration was generated successfully by Drizzle Kit in GitHub Actions before being committed.

## Consequences

### Positive

- Repeated RSS/article jobs are idempotent at the domain and database-constraint levels.
- Historical evidence remains available for summary/citation audits.
- AI outages cannot block source ingestion or persistence.
- URL changes do not necessarily create duplicate articles.
- Migration drift is caught in CI.

### Negative

- Article text versions consume more storage than overwriting a single row.
- A concrete Drizzle/Postgres repository adapter is still required before deployment.
- Database migrations have not yet been applied to a production Supabase project.
- Concurrent insert races must be handled by the concrete adapter using database unique violations and transaction retry/re-read logic.

## Deferred

- Live Supabase migration and rollback evidence.
- Concrete Drizzle repository implementation and connection pooling.
- Cloudflare Queue consumers.
- Story, claim, summary, and citation tables.
- Retention/archival policy for historical normalized text and raw artifacts.
