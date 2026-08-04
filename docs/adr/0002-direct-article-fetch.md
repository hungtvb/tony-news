# ADR-0002: Direct article fetch and normalization

- Status: Accepted for Phase 0
- Date: 2026-08-04

## Context

RSS discovery proves that Tony News can obtain article URLs, but the next risk is whether the three selected publishers expose enough structured metadata and main text for a low-cost direct HTTP path.

## Decision

Implement a fail-closed direct fetch layer with:

- HTTPS-only publisher host allowlists;
- redirect validation on every hop;
- no cookies, authorization headers, or access-control bypass;
- JSON-LD `NewsArticle`/`Article` extraction first;
- Open Graph/meta fallback for title, canonical URL, author, and timestamps;
- `<article>` paragraph extraction followed by page-paragraph fallback;
- a minimum main-text quality threshold;
- SHA-256 content fingerprints;
- metrics-only live evidence that excludes full article text.

## Consequences

- RSS and direct HTTP remain the default low-cost path.
- Browser Run is only considered after direct extraction produces typed failures or low-quality metrics.
- Regex-based HTML extraction remains a Phase 0 implementation and must be reviewed against real pages before production.
- Publication rights are unchanged: extraction success does not grant permission to republish article bodies.
