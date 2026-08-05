# ADR-0006: PostgreSQL transient persistence retry policy

- Status: Accepted
- Date: 2026-08-05
- Related issue: #25

## Context

Article persistence runs as one transaction that resolves article identity, writes or refreshes the article head, upserts source provenance, and appends an immutable content version when required.

Concurrent first discovery can make multiple transactions contend for the same article and source-link rows. PostgreSQL may resolve that contention by aborting one participant with:

- `23505` — unique violation from an identity race;
- `40P01` — deadlock detected;
- `40001` — serialization failure.

CI exposed a real `40P01` failure in the concurrent first-discovery integration test. The unchanged exact-head rerun passed, proving the previous implementation depended on transaction scheduling. The retry adapter handled only `23505`.

## Decision

`persistArticleSnapshotWithRetry` retries exactly these PostgreSQL codes:

| Code | Meaning | Policy |
|---|---|---|
| `23505` | unique violation | Replay the complete persistence transaction within the attempt budget. |
| `40P01` | deadlock detected | Replay the complete persistence transaction because PostgreSQL has rolled back the aborted transaction. |
| `40001` | serialization failure | Replay the complete persistence transaction because the serialization decision invalidated its snapshot. |

All other errors fail immediately. In particular, validation, data-length, foreign-key, permission, missing-table, and application errors are not assumed transient.

The retry contract is:

1. default to three total attempts;
2. use the configured non-negative base delay;
3. wait `delayMs × completed attempt number` before the next attempt;
4. recreate and replay the complete persistence transaction on every attempt;
5. stop immediately for a non-retryable error;
6. when the attempt budget is exhausted, rethrow the exact final database error without replacing its code, cause, constraint, or message.

No retry may continue a failed transaction or retry only one SQL statement from the transaction.

## Verification

Deterministic unit injection covers:

- wrapped Drizzle/PostgreSQL error-code discovery;
- successful replay after `23505`, `40P01`, and `40001`;
- fail-fast behavior for representative non-transient codes;
- preservation of the exact final error after exhaustion;
- invalid retry configuration before a transaction opens.

The real PostgreSQL integration suite retains the six-way concurrent first-discovery test. Merge evidence must include repeated exact-head integration runs because scheduler-dependent contention is not guaranteed on every execution.

## Consequences

### Positive

- A PostgreSQL deadlock no longer turns a valid concurrent discovery into a flaky ingestion failure.
- Serialization failures have an explicit reviewed policy instead of accidental fail-fast behavior.
- Non-transient errors remain actionable and are not hidden behind retries.
- Drizzle wrappers preserve the underlying PostgreSQL code through bounded cause traversal.

### Negative

- Retrying extends latency during contention.
- A repeatedly failing transaction may execute up to the configured attempt limit.
- A broad unique-violation retry remains for compatibility; future schema work may narrow it to reviewed identity constraints when constraint-level evidence is available.

## Deferred

- randomized jitter or provider-specific backoff;
- per-error retry budgets;
- retry metrics and alert thresholds;
- narrowing `23505` retries by exact constraint name;
- production Supabase/Hyperdrive contention evidence.
