# ADR-0003: Publisher adapters and Browser Run fallback

- Status: Accepted for Phase 0
- Date: 2026-08-04
- Related issue: #4

## Context

The generic direct-HTTP parser successfully fetched all three Phase 0 publishers, but live evidence exposed two quality problems:

- VnExpress JSON-LD reported the publisher as the author.
- Tuổi Trẻ fell back to all page paragraphs, producing 45 paragraphs and 5,559 characters, which risked sending boilerplate to AI.

Structure-only CI diagnostics identified stable content boundaries without storing article text:

- VnExpress: `article.fck_detail`
- Tuổi Trẻ: `div.detail-content.afcbc-body`

Cloudflare Browser Run exposes a `/markdown` quick action at:

`POST /accounts/{account_id}/browser-rendering/markdown`

The `/crawl` endpoint is asynchronous and is better suited to discovery/backfill than known-article extraction.

## Decision

1. RSS remains the primary URL discovery mechanism.
2. Known article URLs use direct HTTP first.
3. Publisher-specific container adapters run before the generic parser fallback.
4. Only extraction results with `qualityDecision: ready` may proceed automatically to AI.
5. Browser Run `/markdown` is available only when:
   - direct extraction is `fallback-required`;
   - the source is explicitly enabled by policy;
   - Cloudflare credentials are configured;
   - the per-run request budget has capacity.
6. Browser Run `/crawl` is not part of the regular polling path.
7. All target URLs are validated against publisher HTTPS allowlists before direct or Browser Run requests.
8. CI artifacts store metrics, hashes, selector names, and quality decisions only. They do not store full article text or Browser Run markdown.

## Evidence

After applying the adapters:

| Publisher | Selector/strategy | Paragraphs | Quality decision |
|---|---|---:|---|
| VnExpress | `article.fck_detail` | 13 | `ready` |
| Tuổi Trẻ | `div.detail-content.afcbc-body` | 16 | `ready` |
| Thanh Niên | generic `article-paragraphs` | 7 | `ready` |

VnExpress author metadata is converted to explicit `authorStatus: unknown` when the source only reports the publisher name.

The Browser Run live comparison remains unverified because the repository does not currently expose `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to CI. The smoke command records `skipped` rather than presenting a mocked result as live evidence.

## Consequences

### Positive

- AI no longer receives page-wide Tuổi Trẻ boilerplate in the benchmark case.
- Publisher template assumptions are evidence-backed and testable.
- Browser Run usage is bounded, source-scoped, and optional.
- AI ingestion continues to fail closed when both direct parsing and fallback are unavailable.

### Negative

- Publisher adapters require maintenance when templates change.
- A live Browser Run quality/cost comparison still requires Cloudflare credentials.
- The markdown quick action response does not expose browser-seconds directly; usage must be verified in Cloudflare analytics.

## Follow-up

- Configure Cloudflare secrets and run the credential-gated comparison.
- Add template-drift monitoring using quality decisions and selector misses.
- Re-evaluate whether Browser Run is needed after collecting a larger direct-parser benchmark.
