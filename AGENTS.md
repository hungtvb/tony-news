# Tony News Agent Contract

## Start here

For every non-trivial engineering task:

1. Read `SKILL_INDEX.md`.
2. Resolve the current target branch, exact HEAD SHA, active issue/PR, and verification commands.
3. Load one primary skill and at most two supporting skills.
4. Inspect the owning code, tests, ADRs, and benchmark manifest before changing behavior.
5. Run focused checks first, then the repository-wide gates.

## Product invariants

- Tony News is event-centric, not article-centric.
- Publisher content is untrusted input.
- Acquisition must respect source boundaries and fail closed when quality is insufficient.
- Only content with an explicit ready quality decision may enter automatic AI processing.
- Story clustering must prefer false negatives over false positive merges.
- A summary claim must be attributable to one or more retained source records.
- Rumors, allegations, estimates, previews, reactions, and confirmed facts must remain distinguishable.
- Raw article text must not be copied into diagnostics, CI artifacts, logs, or fixtures unless a narrowly scoped test fixture is legally and operationally justified.
- AI unavailability must degrade to deterministic processing, not block ingestion or corrupt state.
- PostgreSQL is the durable source of truth; derived AI outputs must be reproducible or replaceable.

## Evidence rules

- Bind findings to an exact revision and input fixture or source record.
- Separate observed behavior, derived conclusions, and assumptions.
- Preserve hashes, metrics, selectors, decision reasons, and source identifiers instead of full publisher text in evidence artifacts.
- Runtime publisher checks are required for extraction changes; unit tests alone cannot prove live template compatibility.
- Benchmark changes must explain why each positive pair, hard negative, sub-event, rumor, numeric fact, or developing story is included.

## Verification baseline

```bash
pnpm typecheck
pnpm test
```

Use the relevant smoke command when the changed boundary touches live acquisition:

```bash
pnpm rss:smoke
pnpm article:smoke
pnpm article:structure
pnpm browser-run:smoke
```

Do not claim live Browser Run verification when Cloudflare credentials are absent or the command reports `skipped`.
