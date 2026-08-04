# Web application boundary

The Next.js reader/admin application will be added after the Phase 0 ingestion and AI evidence gates are met.

This directory exists now to preserve the monorepo boundary and prevent ingestion logic from leaking into the future UI application.

## Approved reader UI

The official reader UI baseline was approved on 2026-08-04.

Implementation must follow [`docs/design/tony-news-reader-ui-baseline.md`](../../docs/design/tony-news-reader-ui-baseline.md), including the two-sidebar desktop reading model, single-flow mobile layout, restrained Tony Lime intelligence accent, editorial feed rows, source-aware AI patterns, and accessibility guardrails.

The approved standalone prototype remains design evidence. It is not proof that the production reader or live-data states conform until those implementations are separately verified.
