# Tony News Skill Index

## Project identity

- Project: Tony News
- Repository: `hungtvb/tony-news`
- Default branch: `main`
- Status review: 2026-08-04
- Reviewed main HEAD: `bb19c60a6397c1afd6ef33fb7679fce2a942aba9`
- Current phase: Phase 0 technical spike

Tony News is an AI-assisted, event-centric Vietnamese news aggregation system for Technology, Entertainment, and Sports. The current implementation covers nine RSS feeds, direct article normalization, publisher quality gates, structure diagnostics, and a guarded Cloudflare Browser Run markdown fallback. Persistence and immutable article versioning are being developed separately.

## Loading policy

1. Always load the Library skill `/Skills/project-session-bootstrap/SKILL.md` and read `AGENTS.md`.
2. Resolve current HEAD, active issues/PRs, ADRs, benchmark manifests, and exact verification commands before editing.
3. Load one primary skill and at most two supporting skills.
4. Use repository-local skills for news-domain decisions and Library skills for generic engineering concerns.
5. Never allow raw publisher text, credentials, or unsafe AI output into logs or CI evidence.

## Repository-local skills

| Skill | Path | Use for |
|---|---|---|
| `news-source-acquisition` | `.github/skills/news-source-acquisition/SKILL.md` | RSS/source onboarding, canonical URLs, extraction, publisher drift, Browser Run fallback |
| `news-event-clustering` | `.github/skills/news-event-clustering/SKILL.md` | event identity, positive pairs, hard negatives, sub-events, timelines, merge/split decisions |
| `news-citation-safe-synthesis` | `.github/skills/news-citation-safe-synthesis/SKILL.md` | claim extraction, citations, uncertainty, rumor/allegation handling, AI degradation |
| `news-benchmark-and-evidence` | `.github/skills/news-benchmark-and-evidence/SKILL.md` | benchmark manifests, evaluation cases, metrics, evidence artifacts, regression gates |

## Task-to-skill map

| Task | Primary skill | Supporting skills |
|---|---|---|
| Add or modify publisher/feed/article acquisition | `news-source-acquisition` | `news-benchmark-and-evidence`, `systematic-debugging` |
| Fix selector drift, malformed HTML, metadata or author extraction | `news-source-acquisition` | `systematic-debugging`, `news-benchmark-and-evidence` |
| Tune event clustering, deduplication, sub-event or developing-story behavior | `news-event-clustering` | `news-benchmark-and-evidence`, `systematic-debugging` |
| Add classification, claim extraction, summarization or citation output | `news-citation-safe-synthesis` | `news-benchmark-and-evidence`, `systematic-debugging` |
| Add PostgreSQL schema, immutable versions, retries or idempotent processing | `transactional-consistency` | `schema-migration-and-recovery`, relevant news skill |
| Add worker queues, retry/backoff, partial-failure recovery | `transactional-consistency` | `systematic-debugging`, relevant news skill |
| Reader/admin UI, mobile responsiveness, accessibility | `ui-ux-pro-max` | `visual-regression-and-evidence`, relevant news skill |
| Bug, flaky test, live publisher mismatch, model output regression | `systematic-debugging` | relevant news skill, `news-benchmark-and-evidence` |
| PR review or merge decision | `pr-review-and-merge-readiness` | primary domain skill |
| Deployment, migration rollout, benchmark release gate | `release-readiness-verification` | `news-benchmark-and-evidence`, persistence/security skill |

## Recommended compositions

- New publisher: `news-source-acquisition` + `news-benchmark-and-evidence` + `systematic-debugging`.
- Cluster quality change: `news-event-clustering` + `news-benchmark-and-evidence`.
- AI prompt/model change: `news-citation-safe-synthesis` + `news-benchmark-and-evidence`.
- Article persistence/reprocessing: `transactional-consistency` + `schema-migration-and-recovery` + the owning news skill.
- Reader story page: `ui-ux-pro-max` + `visual-regression-and-evidence` + `news-citation-safe-synthesis`.

## ChatGPT sandbox support

- Use `github-actions-source-bootstrap` only when exact source plus Git history is unavailable locally.
- Use `importing-artifacts-through-gateway` only for a bounded dependency, build, packaging, or evidence artifact.
- These environment skills stay in Library and must not be committed to Tony News.

## Completion rule

Run focused tests first, then:

```bash
pnpm typecheck
pnpm test
```

For acquisition changes, also run the relevant live smoke command and preserve metrics-only evidence. For AI or clustering changes, evaluate the versioned benchmark cases including positive pairs, hard negatives, sub-events, rumors/allegations, numeric facts, and developing stories. Report the exact revision, commands, results, skipped credential-dependent checks, and remaining unverified live-source or deployment conditions.
