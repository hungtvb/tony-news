---
name: news-source-acquisition
description: Onboard, fetch, normalize, and quality-gate news sources for Tony News. Use for RSS endpoints, canonical URLs, article metadata, main-text extraction, publisher adapters, template drift, and guarded Browser Run fallback.
version: 1.0.0
---

# News Source Acquisition

Produce a normalized, provenance-rich article record without bypassing publisher boundaries or allowing low-quality extraction into downstream AI.

## When to use

- Adding or changing a publisher, category feed, RSS endpoint, or source registry entry.
- Changing canonical URL, title, timestamp, author, description, image, or body extraction.
- Investigating selector drift, malformed markup, anti-bot responses, redirects, duplicate URLs, or incomplete content.
- Deciding whether direct HTTP, JSON-LD, publisher-specific selectors, generic containers, or Browser Run fallback should be used.

## When not to use

- Event membership or cluster identity is the main problem; use `news-event-clustering`.
- Claims, citations, or generated summaries are the main problem; use `news-citation-safe-synthesis`.

## Working method

### 1. Define the source contract

Record stable source identity separately from endpoint identity:

- publisher and source ID
- category and locale
- RSS/article endpoint type
- allowed hostnames and redirect policy
- polling cadence and expected freshness
- legal/operational notes
- known template variants

Do not infer publisher identity solely from display text or a mutable URL path.

### 2. Validate discovery

For RSS or discovery endpoints, verify:

- HTTP status, content type, timeout, and redirect destination
- deterministic item identity
- title, URL, published/updated timestamps, and category mapping
- canonicalization behavior for tracking parameters, fragments, mobile URLs, and alternate hostnames
- duplicate entries across feeds

Malformed items must be rejected or quarantined with an explicit reason, not silently repaired into ambiguous data.

### 3. Fetch safely

- Allow only configured public publisher hosts.
- Use bounded timeouts, response-size limits, redirect limits, and a descriptive user agent.
- Reject unsupported schemes, localhost/private-network targets, credential-bearing URLs, and hostname confusion.
- Treat HTML, JSON-LD, RSS XML, headers, and redirects as untrusted input.
- Preserve HTTP and timing metrics without logging full article content.

### 4. Extract by evidence hierarchy

Prefer the narrowest reliable source:

1. trustworthy canonical metadata and JSON-LD
2. publisher-specific main-content and byline rules
3. guarded generic article-container fallback
4. Browser Run markdown only after direct extraction fails its quality gate

A fallback must not replace a successful higher-confidence path merely because it yields more text.

### 5. Produce an explicit quality decision

Return structured evidence such as:

- extraction strategy and selector
- normalized canonical URL
- metadata confidence
- author confidence
- text length and paragraph count
- content hash
- warnings and rejection reasons
- `ready`, `fallback-eligible`, `manual-review`, or `rejected`

Only `ready` may enter automatic AI processing. Browser Run eligibility is not equivalent to AI readiness.

### 6. Handle publisher drift

When live extraction changes:

1. reproduce against an exact URL and revision
2. compare at least two hypotheses, such as selector drift versus blocked/truncated response
3. run structure diagnostics before broadening selectors
4. add or update a publisher-specific fixture using minimal legally safe fragments
5. keep old template compatibility only when evidence shows it remains active
6. add a regression test that fails for the observed drift

Avoid generic selectors that can absorb navigation, recommendations, comments, or unrelated stories.

### 7. Guard Browser Run fallback

- Require configured credentials and an explicit request budget.
- Revalidate the final URL against allowed publisher hosts.
- Call fallback only when direct extraction is below threshold.
- Store metrics, hashes, and decision evidence; do not store markdown in CI artifacts or logs.
- Treat `/crawl` as controlled discovery/backfill research, not the regular polling path.
- A skipped credential-dependent check must remain visibly skipped.

## Non-negotiable invariants

- Low-confidence or structurally ambiguous extraction cannot silently become AI input.
- A content hash change creates observable versioning semantics; it must not overwrite history invisibly.
- Canonicalization must not merge distinct articles or editions.
- Diagnostics and telemetry must not expose full publisher text, secrets, or personal data.
- Live-source behavior cannot be proven by unit tests alone.
- More extracted text is not automatically better extraction.

## Required review questions

1. Which source and endpoint identities are authoritative?
2. What exact evidence proves the selected container is the article body?
3. How are redirects, canonical URLs, duplicate feeds, and tracking parameters handled?
4. What causes `ready`, fallback eligibility, manual review, or rejection?
5. What happens when markup, status codes, encoding, or timestamps are abnormal?
6. Which live smoke result and fixture prove the change?

## Verification

Run focused unit tests, then:

```bash
pnpm typecheck
pnpm test
```

Run the relevant live command:

```bash
pnpm rss:smoke -- --source <source-id>
pnpm article:smoke -- --target <target-id>
pnpm article:structure
pnpm browser-run:smoke
```

Report exact revision, target URLs/source IDs, metrics-only outcomes, quality decisions, and any skipped credential-dependent check.
