# Tony News Agent Contract

## Start here

For every non-trivial Tony News session:

1. Load the shared Library skill `/Skills/project-session-bootstrap/SKILL.md`.
2. Read the canonical project index `/Tony News/SKILL_INDEX.md` in File Library. During migration, the legacy Library title `Tony-News-SKILL_INDEX.md` refers to the same project index.
3. Read [`docs/workflow/plan-and-task-first.md`](docs/workflow/plan-and-task-first.md).
4. Resolve the current default-branch HEAD, active GitHub issue, open pull requests, relevant ADRs, benchmark manifests, and exact verification commands.
5. Select one primary skill and at most two supporting skills. `project-session-bootstrap` is mandatory bootstrap and does not count against this limit.

Repository state, GitHub issues, and exact-revision evidence are authoritative. Conversation history and assistant memory are supplemental only.

## Skill ownership

Project-specific news skills are maintained in the Tony News File Library folder, not copied into this repository:

- `news-source-acquisition` — RSS, article fetching, normalization, publisher adapters, quality decisions, and guarded Browser Run fallback.
- `news-event-clustering` — event identity, duplicate relations, merge/split behavior, developing-story timelines, and correction history.
- `news-citation-safe-synthesis` — claim ledgers, uncertainty, citations, source disagreement, summaries, and safe AI degradation.
- `news-benchmark-and-evidence` — fixtures, human-reviewed labels, metrics, kill tests, and exact-revision evidence.

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
