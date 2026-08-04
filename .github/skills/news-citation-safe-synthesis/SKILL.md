---
name: news-citation-safe-synthesis
description: Extract claims and generate citation-backed, uncertainty-aware news summaries for Tony News. Use for classification, structured AI output, claim ledgers, rumor and allegation handling, numeric facts, source disagreement, summaries, and graceful AI degradation.
version: 1.0.0
---

# Citation-Safe News Synthesis

Generate useful news output without promoting unsupported claims, hiding uncertainty, or confusing model prose with source evidence.

## When to use

- Designing classification, claim extraction, summarization, headline, timeline, or topic-label prompts and schemas.
- Adding or changing OpenCode models, model routing, retries, validation, or fallback behavior.
- Handling rumors, allegations, legal claims, estimates, predictions, quotes, sensitive topics, numeric facts, or conflicting reports.
- Reviewing whether a generated statement is properly attributed and supported.

## When not to use

- Article extraction quality is insufficient; use `news-source-acquisition` first.
- The question is whether articles belong to the same event; use `news-event-clustering`.

## Working method

### 1. Build a claim ledger before prose

Represent source information as structured claims containing:

- claim ID
- article/source/version ID
- claim text or normalized proposition
- claim type: fact, quote, allegation, estimate, prediction, opinion, preview, result, correction, or denial
- subject, predicate, object/value, units, and time scope when applicable
- source attribution and speaker
- confidence and extraction method
- supporting span locator or source-field locator

Generated prose must be derived from retained claims, not from an untraceable model memory.

### 2. Separate source truth from system truth

- A publisher reporting a statement proves that the statement was reported, not necessarily that the underlying claim is true.
- Quotes must retain the speaker and context.
- Allegations and lawsuits must retain allegation status and the accusing party.
- Rumors, forecasts, estimates, and previews must not be rewritten as confirmed outcomes.
- Corrections, denials, and conflicting accounts must remain visible.

### 3. Require structured model output

Define and validate a schema with fields such as:

- classification and confidence
- extracted claims with source IDs
- unsupported or conflicting claims
- uncertainty labels
- proposed summary sentences with cited claim IDs
- abstention or manual-review reason

Reject malformed, extra-schema, unsupported, or citation-free output. Do not parse critical decisions from unconstrained prose.

### 4. Validate every generated claim

For each summary sentence:

1. resolve its cited claim IDs
2. confirm the claims belong to the event/cluster version being summarized
3. check entity, polarity, time, number, unit, and uncertainty consistency
4. ensure the sentence does not combine sources into a stronger claim than any source supports
5. reject or weaken the sentence when support is incomplete

A citation attached to a paragraph does not automatically support every sentence in that paragraph.

### 5. Handle numbers and chronology carefully

- Preserve units, currencies, scales, ranges, and whether a number is estimated or final.
- Detect incompatible numbers rather than averaging or choosing one silently.
- Distinguish publication time, event time, announcement time, effective date, and update time.
- Avoid relative dates in durable summaries when an absolute date is known.
- Record which source version supported a time-sensitive claim.

### 6. Handle source disagreement

When credible sources disagree:

- state the disagreement or use narrower shared facts
- attribute disputed values or interpretations
- avoid false balance when one item is a correction or denial of an earlier report
- do not let source count substitute for source quality
- mark unresolved conflicts for manual review when they affect the event's core meaning

### 7. Degrade safely when AI fails

AI failure, timeout, quota exhaustion, unavailable free models, or schema rejection must not corrupt ingestion state.

Fallback order:

1. retain normalized articles and deterministic metadata
2. use deterministic labels or templates only where evidence is sufficient
3. queue bounded reprocessing with versioned inputs
4. expose pending/manual-review state
5. never publish an uncited model response as a completed summary

Retries must be replay-safe and tied to the same input/version identity.

### 8. Evaluate safety and usefulness

Benchmark at least:

- positive cross-source events
- rumors versus confirmed facts
- allegations and legal claims
- direct quotes versus reporter assertions
- numeric facts and conflicting values
- preview versus result
- developing stories, corrections, and denials
- sensitive personal claims
- insufficient-evidence abstention
- AI unavailable or invalid-output paths

Measure citation support and harmful overstatement separately from readability.

## Non-negotiable invariants

- Every material generated claim is traceable to retained source claims.
- Citation presence is not proof of citation correctness.
- The model cannot upgrade uncertainty, allegation, rumor, prediction, or opinion into fact.
- Model output is untrusted input and must pass schema and support validation.
- Prompt/model changes are versioned with generated outputs.
- AI failure cannot block deterministic ingestion or overwrite a previously valid result.
- Summaries must not reproduce substantial publisher text.

## Required review questions

1. Which retained claims support each generated sentence?
2. Are attribution, polarity, time, numbers, and uncertainty preserved?
3. What happens on disagreement, missing support, invalid JSON, timeout, or model unavailability?
4. Can outputs be reproduced from exact article versions and model/prompt versions?
5. Which benchmark case would catch a confident but unsupported summary?
6. Does the UI expose pending, uncertain, disputed, or corrected states honestly?

## Verification

Run schema/parser tests, claim-support tests, failure-path tests, and affected benchmark cases, then:

```bash
pnpm typecheck
pnpm test
```

Report exact revision, model and prompt/schema versions, benchmark case IDs, citation-support outcomes, abstentions, retries, and any model-dependent behavior that was not executed.
