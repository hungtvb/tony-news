# Plan-and-Task-First Workflow

Status: Active project rule

## Rule

Before starting any non-trivial Tony News implementation, research, design, infrastructure, or documentation work:

1. Load `/Skills/project-session-bootstrap/SKILL.md`, read `AGENTS.md`, and search File Library for the exact current Tony News project index filename recorded there.
2. Resolve the exact target branch/commit, active issue, open pull requests, relevant ADRs, benchmark manifests, design decisions, and verification commands.
3. Write a concise execution plan covering the goal, scope, sequence, acceptance criteria, risks, and verification evidence.
4. Create or identify a GitHub tracking issue before changing code or project artifacts.
5. Split large work into child issues or checklist tasks with explicit dependencies.
6. Select one primary skill and at most two supporting skills. The mandatory bootstrap skill does not count against this limit.
7. Link commits and pull requests to the tracking issue.
8. Update the issue with progress, decisions, blockers, test results, and evidence.
9. Do not silently expand scope. Record newly discovered work as a follow-up task before implementing it.
10. Close work only when acceptance criteria and verification evidence are recorded.

## Small-change exception

Trivial typo-only or formatting-only edits may use a compact plan in the commit or pull-request description, but must not bypass an existing tracking issue when the edit belongs to active scoped work.

## Session continuity

Agents must read, in order:

1. `/Skills/project-session-bootstrap/SKILL.md` in File Library;
2. `AGENTS.md`;
3. the exact project-prefixed Tony News index filename recorded in `AGENTS.md`;
4. this workflow;
5. the active tracking issue and linked plans, ADRs, benchmark manifests, design decisions, and verification evidence.

File Library is treated as a flat searchable catalog. Generic basenames and conceptual folder paths are not accepted as proof of discovery. Historical Tony News index versions must not be selected when `AGENTS.md` names a newer verified file.

Repository state and GitHub issues are authoritative for project status. File Library is authoritative for skill contracts. Conversation memory is supplementary and must not be treated as the project source of truth.

## Verification discipline

Run the smallest targeted check first, then every repository or runtime gate required by the owning domain. Distinguish unit, PostgreSQL integration, migration drift, benchmark validation, live publisher, Browser Run, UI, deployment, and manual-review evidence. A skipped or unavailable gate must remain explicitly unverified.
