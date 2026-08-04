# Benchmark label review protocol

## Purpose

This protocol governs promotion of Tony News benchmark cases from `provisional` to `accepted` without treating model output or an initial seed as ground truth.

## Review checklist

For each case, a reviewer must verify:

1. Every canonical URL resolves to the intended public article.
2. The case relation is supported by article-level evidence, not title similarity alone.
3. Parent event, sub-event, reaction, preview, result, correction, denial, and opinion boundaries are explicit.
4. Rumors, allegations, estimates, and sensitive claims retain their uncertainty status.
5. Exact numeric, date, score, and named-entity claims are recorded only when directly supported.
6. The case exercises a documented failure mode and is not redundant with an existing case.
7. No full article text, credential, personal data, or unrelated page content is copied into the manifest.

## Promotion requirements

An accepted case must set:

```json
{
  "status": "accepted",
  "method": "human-review",
  "reviewedBy": ["github-username-or-reviewer-id"],
  "reviewedAt": "2026-08-04T00:00:00Z",
  "notes": "Evidence and decision rationale."
}
```

The validator rejects an accepted label without a reviewer, timestamp, and human-review method.

## Change policy

- Keep article and case IDs stable.
- Explain label changes in provenance notes and the pull request.
- Do not silently repurpose a case to a different event.
- When tuning begins, split tuning and held-out acceptance manifests before changing thresholds or prompts.
- A harmful false merge or unsupported material claim blocks acceptance even when aggregate metrics improve.

## Current state

`benchmark-contract.v2.json` is an inventory and review scaffold. Every included case is provisional. It is suitable for validator development and labeling workflow review, not for publishing final model or clustering accuracy.
