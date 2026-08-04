# Tony News

AI-assisted, event-centric news aggregation for Technology, Entertainment, and Sports.

> Status: Phase 0 technical spike.

Tony News prioritizes source attribution, conservative story clustering, citation-backed summaries, and graceful degradation when AI is unavailable.

## Phase 0 scope

The first vertical slice validates:

1. RSS discovery from nine Vietnamese feeds.
2. Direct article fetching and normalization.
3. Conservative story clustering.
4. OpenCode free-model structured outputs and citation safety.

## Repository layout

```text
apps/
  worker/          Phase 0 operational CLIs and future queue consumers
  web/             Reader/admin application boundary
packages/
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

## Verification

```bash
pnpm typecheck
pnpm test
```

## Documentation

Product, architecture, AI safety, and Phase 0 planning are maintained in Notion. Repository-local ADRs, benchmark manifests, setup instructions, and runbooks are versioned alongside implementation.
