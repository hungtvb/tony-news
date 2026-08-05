# ADR-0007: Citation-safe synthesis contracts and deterministic validation

- Status: Accepted
- Date: 2026-08-05
- Related issue: #28

## Context

Tony News plans to use replaceable OpenCode free models for classification and synthesis. Model output is untrusted, model availability can change, and a syntactically present citation does not prove that a sentence is supported by the cited article version.

The repository already preserves immutable article versions and conservative event-relation decisions. Before adding a model adapter or summary persistence, the synthesis boundary needs a deterministic contract that prevents unsupported, stale, cross-snapshot, or overconfident output from becoming product state.

## Decision

Add a dependency-free `packages/synthesis` boundary with two versioned contracts:

1. `event-snapshot.v1` contains the exact active article versions and retained atomic claims eligible for one synthesis run.
2. `citation-safe-summary.v1` contains proposed sentences, structured assertions, claim IDs, and article-version citations.

Every material sentence must:

- cite at least one retained claim;
- resolve every citation to an active article/version in the exact snapshot;
- resolve every claim to the same cited article/version;
- list exactly the claims present in its citations;
- use one atomic `propositionId` across all cited claims;
- avoid upgrading epistemic status or changing polarity;
- assert only entities, numbers, units, currencies, scales, and absolute times supported by every cited claim.

Runtime parsing accepts only the reviewed critical fields and fails closed on malformed or unknown critical structure. Validation issues contain codes, paths, and safe identifiers, not publisher text or generated prose.

## Epistemic policy

The validator permits exact preservation and narrowly defined cautious degradation. For example, a confirmed claim may be rendered as reported or uncertain, while rumor, allegation, estimate, prediction, opinion, correction, and uncertain claims cannot be upgraded to confirmed.

Mixed polarity or mixed propositions are rejected instead of being reconciled silently.

## Consequences

### Positive

- A future model cannot publish merely by returning plausible prose and citation IDs.
- Article updates and snapshot versions cannot be mixed accidentally.
- Number, unit, currency, scale, and chronology drift receive explicit kill tests.
- AI outage or invalid output remains separate from deterministic ingestion state.
- The contract can be benchmarked before a provider is selected.

### Negative

- The v1 atomic-proposition rule is conservative and may split natural prose into more sentences.
- Structured claim extraction and proposition identity still need their own reviewed implementation.
- The validator cannot prove natural-language entailment between prose and the declared structured assertion.
- Passing validation is not sufficient for publication without later benchmark, privacy, moderation, and human-review gates.

## Rejected alternatives

- **Citation-presence-only validation:** rejected because IDs can be valid while the cited claims do not support the number, date, polarity, or certainty of the sentence.
- **Free-form model explanation:** rejected because critical decisions cannot be parsed safely from unconstrained prose.
- **Model-owned cluster or publication mutation:** rejected because domain state transitions must remain deterministic and auditable.
- **Adding a schema dependency now:** deferred; the Phase 0 contract can be dependency-free and should be benchmarked before adding runtime complexity.

## Verification

Adversarial tests cover:

- unknown and cross-version IDs;
- disabled article versions and claims;
- duplicate citations and claim references;
- citation/claim provenance mismatch;
- rumor-to-fact promotion;
- mixed polarity and mixed propositions;
- unsupported entities;
- number, unit, currency, scale, and time drift;
- relative-time syntax;
- malformed and extra-schema output;
- invalid retained snapshot provenance.

Repository-wide typecheck, unit, benchmark, and clustering gates remain required on the exact branch head.

## Deferred

- OpenCode provider registry and credentials;
- prompts and real model evaluation;
- claim extraction and proposition canonicalization;
- prose-entailment validation;
- claim/citation/summary persistence;
- publication workflow and reader UI;
- production privacy, quota, and operational evidence.
