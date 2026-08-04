# Phase 0 benchmark artifacts

## Files

- `source-manifest.v1.json`: nine selected RSS feeds and polling metadata.
- `benchmark-seed.v1.json`: original thirty-article URL seed. It remains immutable historical input and is not accepted ground truth.
- `benchmark-contract.v2.json`: metadata-only article inventory plus explicit evaluation cases, uncertainty, entities, relation expectations, and label provenance.

## Label lifecycle

Benchmark labels have three states:

- `provisional`: useful for implementation and review planning, but excluded from acceptance metrics.
- `accepted`: requires `human-review`, at least one named reviewer, and a review timestamp.
- `rejected`: retained for audit when a proposed label is determined to be incorrect or unsuitable.

A project seed or model output must never promote itself to `accepted`. Label corrections should preserve stable article/case IDs and be explained in provenance notes or a follow-up decision record.

## Safe evidence boundary

The benchmark stores metadata, canonical URLs, compact entity labels, relation expectations, and review notes. It does not store full publisher articles. Runtime evidence should use hashes, metrics, identifiers, and bounded structural diagnostics.

## Validation

```bash
pnpm benchmark:validate
pnpm benchmark:validate -- --json
```

The validator checks:

- schema and enum values;
- unique article IDs, case IDs, and canonical URLs;
- HTTPS URLs and ISO observed dates;
- case references to known articles;
- non-empty evaluation focus, uncertainty, and provenance notes;
- accepted labels have real human-review provenance.

CI runs the validator on every pull request. The JSON mode reports inventory counts without article bodies.

## Current v2 inventory boundary

The v2 contract retains all 30 seed articles and adds explicit cases for:

- cross-source same-event candidates;
- related sub-events that should not collapse into one story;
- hard-negative over-merge guards;
- rumor/allegation uncertainty preservation;
- numeric-fact preservation;
- developing-story timeline behavior.

All v2 case labels currently remain `provisional`. They must not be used as final accuracy/F1 ground truth until human review is recorded. The next labeling pass should add event-specific follow-ups, preview/result pairs, rumor-to-confirmation pairs, exact required summary claims, contradictions, and held-out acceptance cases.
