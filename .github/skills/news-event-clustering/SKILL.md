---
name: news-event-clustering
description: Model and evaluate conservative event-centric story clustering for Tony News. Use for duplicate detection, cross-source clusters, hard negatives, sub-events, developing stories, timelines, merge/split decisions, and cluster correction.
version: 1.0.0
---

# News Event Clustering

Group articles only when they describe the same real-world event or update boundary, while preserving related-but-distinct stories.

## When to use

- Implementing or tuning duplicate detection, candidate retrieval, similarity, entity matching, or cluster assignment.
- Deciding whether two reports are the same event, a parent/sub-event, a follow-up, a reaction, a preview/result pair, or unrelated.
- Repairing over-merged or fragmented clusters.
- Building event timelines, cluster labels, representative articles, or correction workflows.

## When not to use

- The article text or metadata is unreliable; fix acquisition first.
- The main task is claim attribution or summary generation; use `news-citation-safe-synthesis`.

## Working method

### 1. Define event identity before scoring

Describe the event using explicit dimensions:

- primary action or change
- principal entities and their roles
- time window
- location or competition/product/jurisdiction context
- event state such as announced, alleged, started, completed, corrected, or reacted-to
- distinguishing numeric or named facts

Shared entities or keywords alone do not establish shared event identity.

### 2. Generate bounded candidates

Use deterministic blocking signals before expensive comparison, for example:

- normalized named entities
- close publication/event time
- category and locale
- shared product, match, film, policy, case, or organization
- normalized title tokens

Candidate retrieval should favor recall, but the final merge decision must remain conservative.

### 3. Evaluate relation type

Return an explicit relation rather than only a similarity score:

- `same-event`
- `duplicate-edition`
- `parent-sub-event`
- `follow-up-update`
- `reaction-or-opinion`
- `preview-result`
- `related-topic`
- `unrelated`
- `uncertain`

Only `same-event` and narrowly defined `duplicate-edition` should automatically share a cluster. Other relations may be linked without being merged.

### 4. Apply conservative merge evidence

A merge should have multiple agreeing signals, such as:

- same core action and actors
- compatible event time and state
- matching location/product/match/case
- no contradictory distinguishing facts
- independent-source evidence when available

Prefer a false negative split over a false positive merge. An uncertain candidate remains separate until stronger evidence arrives.

### 5. Protect hard boundaries

Do not automatically merge:

- preview with result
- allegation with later confirmation or denial
- main event with post-event quote/reaction
- parent event with one participant's sub-event
- global box-office report with a country-specific result unless the event definition explicitly spans both
- policy proposal with enacted rule
- product rumor with official announcement
- two unrelated stories sharing a famous person, club, company, franchise, or technology

### 6. Model developing stories

- Keep immutable article membership history.
- Record why an article joined, left, or split from a cluster.
- Distinguish event identity from the current display summary.
- Allow corrections, denials, updated numbers, and later consequences to extend a timeline without rewriting earlier facts.
- Re-clustering must be deterministic for the same model/rules/inputs or record the version that caused the change.

### 7. Use AI as a bounded judge

AI may classify ambiguous candidate relations only after deterministic candidate generation.

Require structured output containing:

- relation type
- confidence
- shared event dimensions
- contradictory dimensions
- evidence article IDs or claim IDs
- abstention reason

Do not permit free-form model output to mutate clusters directly. Validate the output and apply policy thresholds in deterministic code.

### 8. Verify against benchmark cases

Maintain labeled cases for:

- cross-source positive pairs
- same-source duplicates
- hard negatives with shared entities
- parent/sub-event boundaries
- preview/result distinctions
- rumor/confirmation transitions
- reaction/opinion articles
- developing stories and corrections
- numeric or location conflicts

Evaluate both over-merge and under-merge errors; aggregate accuracy alone can hide damaging false positive merges.

## Non-negotiable invariants

- Cluster identity is a domain decision, not a vector-distance threshold.
- Every automatic merge has a stored decision reason and version.
- Related-topic and parent/sub-event links do not imply shared cluster membership.
- An article must not belong to multiple active clusters for the same event definition unless the model explicitly supports overlapping facets.
- Cluster corrections preserve audit history.
- A summary must never be used as the authoritative clustering input when source claims are available.

## Required review questions

1. What exact real-world event definition is being used?
2. Which signals support the merge, and which facts could falsify it?
3. Is the pair actually parent/sub-event, preview/result, reaction, or follow-up?
4. What is the false-positive failure mode for this rule?
5. Can the decision be reproduced from stored inputs and a versioned policy/model?
6. Which positive and hard-negative benchmark cases cover the change?

## Verification

Run targeted clustering tests and the benchmark evaluation for affected cases, then:

```bash
pnpm typecheck
pnpm test
```

Report exact revision, decision-policy/model version, evaluated case IDs, false-positive and false-negative outcomes, and any labels that remain uncertain or manually assigned.
