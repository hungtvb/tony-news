# Session Continuity

At the start of every non-trivial session, read and resolve in this order:

1. `/Skills/project-session-bootstrap/SKILL.md` in File Library.
2. `AGENTS.md` in this repository.
3. Search File Library for the exact filename `Tony-News-SKILL_INDEX-v1.1.1.md`.
4. `docs/workflow/plan-and-task-first.md`.
5. The active GitHub tracking issue and its child tasks.
6. Linked plans, ADRs, benchmark manifests, design decisions, pull requests, and verification evidence.

Then resolve the exact target branch and commit before editing or reporting status.

File Library is a flat searchable catalog for this workflow. Use the exact project-prefixed filenames recorded in `AGENTS.md`; do not rely on generic `SKILL_INDEX.md`, generic `SKILL.md`, or conceptual folder paths. `Tony-News-SKILL_INDEX.md` and `Tony-News-SKILL_INDEX-v1.1.0.md` are historical only.

Repository state, GitHub issues, and evidence tied to the exact revision are authoritative. File Library supplies the skill contracts. Conversation history and assistant memory are supplemental only.

If File Library is unavailable, record that dependency in the active issue and use repository ADRs, design documents, benchmark manifests, and tests only as a bounded fallback. Do not silently invent missing news-domain rules.
