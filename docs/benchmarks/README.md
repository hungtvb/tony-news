# Phase 0 benchmark artifacts

## Files

- `source-manifest.v1.json`: nine selected RSS feeds and polling metadata.
- `benchmark-seed.v1.json`: thirty article URLs with provisional cluster labels and evaluation cases.

## Evidence status

The seed labels are provisional and intended to bootstrap runtime ingestion and human review. A URL being present does not mean article extraction, legal reuse, or production suitability has passed.

Before metrics are published:

1. Fetch each URL through the project runtime.
2. Record immutable source snapshots or hashes.
3. Review cluster labels.
4. Separate parent events from sub-events.
5. Version any label correction.
