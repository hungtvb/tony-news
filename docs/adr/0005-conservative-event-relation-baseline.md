# ADR-0005: Conservative deterministic event relation baseline

- Status: Accepted for Phase 0
- Date: 2026-08-05
- Related issue: #23

## Context

Tony News now has quality-gated acquisition, immutable PostgreSQL article versions, and a metadata-only benchmark contract. The next boundary is event identity: deciding whether reports are candidates for the same event, related but distinct story focuses, different events, or too uncertain to decide.

A similarity score alone is unsafe. Articles may share a category, date, country, club, celebrity, or policy vocabulary while describing different events. Conversely, a result, player milestone, post-match reaction, preview, or follow-up may be related to the same parent event without belonging to the same summary node.

The current benchmark labels are provisional. They are useful regression evidence but are not accepted ground truth or a production accuracy claim.

## Decision

1. Add a dependency-free deterministic relation engine under `packages/clustering`.
2. The engine consumes only normalized metadata available in the benchmark contract:
   - category;
   - observed date;
   - content type;
   - title tokens;
   - explicit entity labels.
3. The engine returns one explicit relation:
   - `same-event-candidate`;
   - `related-not-merge`;
   - `different-event`;
   - `uncertain`.
4. A same-event result is only a candidate. It does not mutate clusters or authorize an automatic merge.
5. Multiple shared event-specific entities within a narrow date window are strong candidate evidence.
6. One shared specific entity may produce a candidate only when content family and date also agree.
7. Result-versus-reaction, result-versus-player-milestone, and preview-versus-result boundaries are protected as `related-not-merge` when an event anchor overlaps.
8. Category/date/title similarity without a shared specific entity cannot produce a same-event candidate.
9. Every decision includes reason codes and observed signals so later model or policy changes remain auditable.
10. Benchmark evaluation reports provisional and accepted labels separately:
    - provisional cases are review/regression evidence;
    - accepted-label counts exclude provisional cases;
    - hard-negative regressions are blocking safety failures even while provisional.
11. AI judging, vector retrieval, persistence of clusters, merge/split history, and queue wiring remain separate future slices.

## Verification

The focused unit suite covers:

- multi-source positive candidates;
- one-anchor box-office candidates;
- result versus post-match reaction;
- result versus player milestone;
- same-date/category hard negatives;
- cross-category overlap;
- symmetric pair ordering;
- accepted-versus-provisional evaluation accounting;
- blocking hard-negative regressions.

The repository command is:

```bash
pnpm cluster:evaluate -- --json --fail-on-provisional-mismatch
```

CI runs this after validating the benchmark contract. The JSON output contains article IDs, relation signals, reason codes, expected relations, predicted relations, and label status. It does not contain publisher article text.

## Consequences

### Positive

- Event identity begins with an explicit, testable domain contract rather than opaque model output.
- Harmful broad merges have dedicated kill tests.
- Related story nodes remain linkable without being collapsed into one summary.
- Future AI or embedding layers can be evaluated against a deterministic baseline.
- Provisional benchmark evidence is not mislabeled as accepted accuracy.

### Negative

- Exact entity strings and hand-written aliases have limited recall.
- Metadata-only decisions cannot resolve every same-event pair.
- The engine intentionally returns `uncertain` for insufficient evidence.
- Policy changes require versioned tests and benchmark evidence.

## Deferred

- article-level human promotion of benchmark labels;
- candidate retrieval over persisted article versions;
- model-assisted relation classification with schema validation;
- cluster, membership, relation, and correction-history tables;
- deterministic merge/split commands and audit log;
- production queue consumer and reprocessing flow.
