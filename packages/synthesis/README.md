# Citation-safe synthesis boundary

This package is the deterministic boundary between untrusted model output and any future Tony News summary storage or publication flow.

## Current scope

Implemented in this Phase 0 slice:

- a versioned event-snapshot contract;
- a versioned proposed-summary contract;
- dependency-free runtime parsing with exact critical fields;
- article-version and claim-provenance validation;
- atomic-proposition enforcement per sentence;
- conservative epistemic-status and polarity preservation;
- exact structured entity, number/unit/currency/scale, and absolute-time support checks;
- typed, metrics-safe validation issues that do not echo publisher text or generated prose.

Not implemented here:

- model/provider calls or prompts;
- claim extraction from article bodies;
- natural-language entailment between sentence prose and its structured assertion;
- story, claim, citation, or summary database tables;
- automatic publication or reader UI.

## Why one atomic proposition per sentence

A citation can exist while failing to support the sentence it is attached to. The v1 validator therefore requires every cited claim for one sentence to share a single `propositionId`, and every cited claim must independently support the declared entities, polarity, epistemic status, numbers, and times.

This is intentionally conservative. Multi-proposition prose must be split into separately validated sentences rather than combined into a stronger uncited synthesis.

## API

```ts
import { validateProposedSummary } from "./src/validator.ts";

const result = validateProposedSummary(untrustedModelJson, retainedEventSnapshot);
if (!result.valid) {
  // Log issue codes, paths, and safe IDs only.
  // Keep the story without an AI summary or route it to bounded review/retry.
}
```

## Safety boundary

- Model output is always untrusted input.
- A citation ID is not proof of citation correctness.
- Rumor, allegation, estimate, prediction, opinion, correction, uncertainty, and denial state cannot be silently upgraded.
- AI failure cannot block article acquisition or persistence.
- Validation errors must not include full publisher text, generated prose, credentials, or personal data.
- Passing this validator is necessary but not sufficient for publication: future prose-entailment, benchmark, privacy, moderation, and human-review gates remain separate.
