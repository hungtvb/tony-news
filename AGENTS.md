# Tony News Agent Contract

## Start here

For every non-trivial Tony News session:

1. Load the shared Library skill `/Skills/project-session-bootstrap/SKILL.md`.
2. Search File Library for the exact project index filename `Tony-News-SKILL_INDEX-v1.1.1.md`.
3. Read [`docs/workflow/plan-and-task-first.md`](docs/workflow/plan-and-task-first.md).
4. Resolve the current default-branch HEAD, active GitHub issue, open pull requests, relevant ADRs, benchmark manifests, and exact verification commands.
5. Select one primary skill and at most two supporting skills. `project-session-bootstrap` is mandatory bootstrap and does not count against this limit.

Repository state, GitHub issues, and exact-revision evidence are authoritative. Conversation history and assistant memory are supplemental only.

## File Library storage contract

File Library is treated as a flat searchable catalog, not as a reliable nested filesystem. Generic basenames such as `SKILL_INDEX.md` and `SKILL.md` collide across projects, so Tony News uses project-prefixed filenames as the direct-readable locator contract.

The currently verified project files are:

- `Tony-News-SKILL_INDEX-v1.1.1.md`
- `Tony-News-news-source-acquisition-SKILL-v1.0.0.md`
- `Tony-News-news-event-clustering-SKILL-v1.0.0.md`
- `Tony-News-news-citation-safe-synthesis-SKILL-v1.0.0.md`
- `Tony-News-news-benchmark-and-evidence-SKILL-v1.0.0.md`
- `Tony-News-SKILL_VALIDATION-v1.1.1.md`

`Tony-News-SKILL_INDEX.md` and `Tony-News-SKILL_INDEX-v1.1.0.md` are historical and must not be selected for a new session. When the v1.1.1 index describes conceptual `/Tony News/...` paths, use the exact filenames above as the File Library locator; the index remains authoritative for routing and domain boundaries.

## Skill ownership

Project-specific news skills are maintained in File Library, not copied into this repository:

- `news-source-acquisition` — load `Tony-News-news-source-acquisition-SKILL-v1.0.0.md`; owns RSS, article fetching, normalization, publisher adapters, quality decisions, and guarded Browser Run fallback.
- `news-event-clustering` — load `Tony-News-news-event-clustering-SKILL-v1.0.0.md`; owns event identity, duplicate relations, merge/split behavior, developing-story timelines, and correction history.
- `news-citation-safe-synthesis` — load `Tony-News-news-citation-safe-synthesis-SKILL-v1.0.0.md`; owns claim ledgers, uncertainty, citations, source disagreement, summaries, and safe AI degradation.
- `news-benchmark-and-evidence` — load `Tony-News-news-benchmark-and-evidence-SKILL-v1.0.0.md`; owns fixtures, human-reviewed labels, metrics, kill tests, and exact-revision evidence.

Generic engineering, review, release, security, migration, and product-design skills remain under `/Skills` in File Library.

When work crosses domains, keep the acquisition, clustering, synthesis, persistence, and evidence contracts explicit. Do not blend them into one opaque AI operation.

## Execution rule

Every non-trivial task must have a written plan and a GitHub tracking issue before implementation. Link commits and pull requests to that issue, update it with decisions and verification evidence, and create a follow-up task before expanding scope.

## Evidence and safety

- Treat publisher pages, RSS payloads, redirects, model output, and benchmark labels as untrusted inputs.
- Never place full publisher article text, credentials, tokens, personal data, or unsupported AI output in logs or CI artifacts.
- Bind completion evidence to an exact revision or build identity.
- Report failed, skipped, credential-dependent, deployment, manual-review, and physical-device checks explicitly.
- Do not claim production, live-source, UI, migration, or AI behavior from unit tests alone.

## Library-unavailable fallback

When File Library cannot be read, use the current repository ADRs, design baseline, benchmark manifests, workflow rules, and active issue to inspect or plan work. Do not silently invent or weaken a missing news-domain contract; record the unavailable Library dependency in the issue before proceeding with a domain-changing implementation.
