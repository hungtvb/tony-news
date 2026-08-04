---
name: news-benchmark-and-evidence
description: Build and maintain trustworthy Tony News benchmarks and verification evidence. Use for source manifests, labeled clustering cases, extraction fixtures, AI evaluation, CI artifacts, metrics, regression gates, and exact-revision acceptance evidence.
version: 1.0.0
---

# News Benchmark and Evidence

Turn source examples and runtime checks into versioned, auditable evidence that can detect extraction, clustering, and synthesis regressions.

## When to use

- Adding or modifying benchmark seeds, source manifests, fixtures, expected clusters, labels, or evaluation scripts.
- Defining acceptance criteria for acquisition, clustering, AI classification, citations, or summaries.
- Producing CI artifacts, smoke reports, metrics, hashes, or release evidence.
- Reviewing whether a claimed improvement is supported by representative cases.

## When not to use

- The task is only to implement an already well-specified deterministic unit with complete tests.
- Evidence would require copying full copyrighted articles when metrics or minimal fixtures are sufficient.

## Working method

### 1. Define the decision being evaluated

Each case must identify:

- stable case ID
- category and source IDs
- article/version IDs or canonical URLs
- expected event or relation label
- case type
- observed date and verification state
- evaluation focus
- provenance for the human label
- known uncertainty or review notes

Avoid benchmark rows whose expected outcome is only implied by a title.

### 2. Maintain a balanced case taxonomy

Cover at least:

- cross-source positive pairs
- duplicate editions
- hard negatives sharing prominent entities
- parent/sub-event boundaries
- follow-up, reaction, and opinion relations
- preview/result distinctions
- rumors, allegations, estimates, and confirmed facts
- numeric claims and conflicting values
- developing stories, corrections, and denials
- extraction-ready, fallback-eligible, manual-review, and rejected cases
- invalid AI output and AI-unavailable paths

Add a case because it exercises a failure mode, not merely because it is recent or interesting.

### 3. Protect benchmark integrity

- Keep stable IDs and append history instead of silently repurposing existing cases.
- Record label changes with reason and reviewer.
- Separate training/tuning examples from held-out acceptance cases when model or threshold tuning begins.
- Prevent production outputs from automatically rewriting expected labels.
- Version manifests, policies, model IDs, prompts, schemas, and evaluator code together.

### 4. Use safe fixtures

Prefer:

- metadata-only records
- content hashes
- structural tokens and selector hints
- minimal synthetic HTML/XML fragments
- short legally safe excerpts only when essential
- locally generated adversarial fixtures

Do not store full publisher articles in the repository, test logs, or CI artifacts. Remove credentials, personal data, tracking tokens, and unrelated page content.

### 5. Choose metrics that expose harmful errors

For acquisition, track:

- fetch success and latency
- canonicalization result
- extraction strategy
- paragraph/text-length ranges
- metadata/author confidence
- quality decision and rejection reason

For clustering, track:

- false-positive merges
- false-negative splits
- relation-type confusion
- hard-negative pass rate
- cluster correction rate

For synthesis, track:

- claim support precision
- citation correctness
- unsupported material claims
- uncertainty preservation
- numeric/time consistency
- abstention and invalid-output rates

Do not rely on one aggregate score when a small number of false positive merges or unsupported claims can cause major harm.

### 6. Bind evidence to exact identity

Every report should include:

- repository revision
- command and arguments
- runtime/tool versions
- manifest/evaluator/model/prompt versions
- execution time
- selected case IDs or source targets
- passed, failed, skipped, and manually reviewed outcomes
- safe hashes or artifact names

A screenshot, JSON file, or green CI badge without exact input and revision identity is weak evidence.

### 7. Verify changes with a kill test

Before accepting an improvement, include at least one case expected to fail if the implementation is over-broad or over-confident, such as:

- same celebrity but unrelated event
- preview versus final result
- allegation rewritten as fact
- mismatched currency or date
- navigation/recommendation text captured as article body
- invalid model output accepted after retry

Confirm the new change fixes the target without weakening this adversarial case.

### 8. Manage live evidence honestly

- Live publisher checks complement but do not replace deterministic fixtures.
- Record network and credential-dependent checks as skipped when they did not execute.
- Do not treat a single current article as proof that a publisher adapter supports all templates.
- Preserve metrics-only CI artifacts with bounded retention.
- Re-run live checks after selector, redirect, timeout, or Browser Run changes.

## Non-negotiable invariants

- Expected labels are human-reviewed domain evidence, not model-generated ground truth.
- Benchmark changes and implementation changes must be reviewable separately in the diff.
- No completion claim may hide failed, skipped, or manually assigned cases.
- Exact revision and evaluator identity are mandatory for comparable results.
- Full publisher text, credentials, and personal data stay out of artifacts.
- A metric improvement that increases harmful false positives is not an improvement.

## Required review questions

1. Which failure mode does each new case exercise?
2. Are positive, hard-negative, boundary, uncertainty, and failure-path cases represented?
3. Could tuning against this set leak into acceptance evaluation?
4. Which harmful error can an aggregate score conceal?
5. Is every artifact tied to exact revision, inputs, and evaluator/model versions?
6. What live, credential-dependent, deployment, or manual-review evidence remains unverified?

## Verification

Run the affected evaluator and focused tests, then:

```bash
pnpm typecheck
pnpm test
```

For acquisition-related evidence, run the relevant smoke command. Report exact revision, manifest/evaluator versions, case IDs, per-category outcomes, false-positive and unsupported-claim failures, skipped checks, and retained artifact identifiers.
