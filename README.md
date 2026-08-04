# Tony News

AI-assisted, event-centric news aggregation for Technology, Entertainment, and Sports.

> Status: Phase 0 technical spike.

Tony News prioritizes source attribution, conservative story clustering, citation-backed summaries, and graceful degradation when AI is unavailable.

## Phase 0 scope

The first vertical slice validates:

1. RSS discovery from nine Vietnamese feeds.
2. Direct article fetching and normalization.
3. Idempotent article persistence and version history.
4. Conservative story clustering.
5. OpenCode free-model structured outputs and citation safety.

## Repository layout

```text
apps/
  worker/          Phase 0 operational CLIs and future queue consumers
  web/             Reader/admin application boundary
packages/
  db/              Drizzle schema, migrations, persistence contracts
  ingestion/       Source registry, RSS parsing and acquisition contracts
docs/
  adr/             Architecture decisions
  benchmarks/      Versioned source and evaluation manifests
```

## RSS smoke test

```bash
corepack enable
pnpm install
pnpm rss:smoke
```

Filter to one source:

```bash
pnpm rss:smoke -- --source vne-tech
```

Machine-readable output:

```bash
pnpm rss:smoke -- --json
```

The smoke check performs network requests to publisher RSS endpoints. It does not fetch full article content and does not bypass access controls.

## Article extraction smoke test

The direct-fetch smoke test checks one public article per publisher and emits metrics only:

```bash
pnpm article:smoke
pnpm article:smoke -- --target vne-google-earth-ai
pnpm article:smoke -- --json
```

The JSON output contains metadata, extraction strategy, selector evidence, quality decision, text length, paragraph count, and content hash. It intentionally excludes full article text.

Current Phase 0 content boundaries:

- VnExpress: `article.fck_detail`
- Tuổi Trẻ: `div.detail-content.afcbc-body`
- Thanh Niên: generic article container fallback

Only `qualityDecision: ready` is eligible for automatic downstream persistence and AI processing.

## PostgreSQL persistence

The Phase 0 database schema uses Drizzle ORM and PostgreSQL. It contains:

- sources and source endpoints;
- canonical mutable article heads;
- `article_sources` provenance links, allowing one article to appear in multiple feeds/categories;
- immutable article versions;
- ingestion runs with idempotency keys;
- typed processing failures.

Article lookup prefers a stable `(source_id, source_article_id)` link when available and falls back to canonical URL. Two feeds that discover the same canonical URL create two provenance links, not two articles or two content versions.

Article persistence follows three outcomes:

```text
new identity + content hash       → create article + source link + version 1
existing identity + same hash     → upsert source link, refresh head metadata
existing identity + changed hash  → upsert source link, append version N+1
```

AI is not part of this transaction. A persisted article version can be processed later when an AI route is available.

Generate a migration after changing the schema:

```bash
pnpm db:generate
```

Generated SQL and Drizzle metadata under `packages/db/drizzle` must be committed. CI regenerates migrations and fails for tracked drift or untracked generated files.

The initial migration has not yet been applied to a preview or production Supabase project.

## Structure diagnostics

The diagnostics command emits tag/class candidates and JSON-LD keys without article text:

```bash
pnpm article:structure
```

This is used to investigate publisher template drift before changing selectors.

## Cloudflare Browser Run fallback

Browser Run `/markdown` is an optional, quality-gated fallback. It is never called for an article that passes direct extraction, and it is protected by publisher URL validation plus a per-run request budget.

Set the following variables for a live comparison:

```bash
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...
pnpm browser-run:smoke
```

Without those values, the smoke command returns a machine-readable `skipped` result. CI artifacts contain metrics and hashes only, never Browser Run markdown.

The regular polling path does not use Browser Run `/crawl`; crawl remains reserved for controlled discovery or backfill experiments.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm db:generate
status=$(git status --porcelain -- packages/db/drizzle)
test -z "$status"
```

## Documentation

Product, architecture, AI safety, and Phase 0 planning are maintained in Notion. Repository-local ADRs, benchmark manifests, setup instructions, and runbooks are versioned alongside implementation.
