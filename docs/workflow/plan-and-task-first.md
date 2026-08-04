# Plan-and-Task-First Workflow

Status: Active project rule

## Rule

Before starting any non-trivial Tony News implementation, research, design, infrastructure, or documentation work:

1. Write a concise execution plan covering the goal, scope, sequence, acceptance criteria, risks, and verification evidence.
2. Create or identify a GitHub tracking issue before changing code or project artifacts.
3. Split large work into child issues or checklist tasks with explicit dependencies.
4. Link commits and pull requests to the tracking issue.
5. Update the issue with progress, decisions, blockers, test results, and evidence.
6. Do not silently expand scope. Record newly discovered work as a follow-up task before implementing it.
7. Close work only when acceptance criteria and verification evidence are recorded.

## Small-change exception

Trivial typo-only or formatting-only edits may use a compact plan in the commit or pull-request description, but must not bypass an existing tracking issue when the edit belongs to active scoped work.

## Session continuity

Agents must read `AGENTS.md`, this workflow, the active tracking issue, and linked plans at the beginning of a new session. Conversation memory is supplementary and must not be treated as the project source of truth.
