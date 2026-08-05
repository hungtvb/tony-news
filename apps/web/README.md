# Web application boundary

The Next.js reader/admin application will be added after the Phase 0 ingestion and AI evidence gates are met.

This directory exists now to preserve the monorepo boundary and prevent ingestion logic from leaking into the future UI application.

## Approved reader UI

The official reader UI baseline was approved on 2026-08-04.

The canonical approved artifact is `tony-news-tony-design-system-demo.html`, titled `Tony News — Tony Design System Editorial Demo`.

Implementation must follow [`docs/design/tony-news-reader-ui-baseline.md`](../../docs/design/tony-news-reader-ui-baseline.md), including:

- the 64 px grid-aligned top bar and two-sidebar desktop reading model;
- the masthead, Tony signal strip, stacked lead story, divider-based article rows, and contextual right rail;
- the single-flow mobile layout with drawer, four-item bottom navigation, and bottom-sheet overlays;
- Inter-first typography, warm neutral surfaces, and restrained Tony Lime intelligence accent;
- source-aware AI patterns and accessibility guardrails.

Earlier dashboard, `tony-news-editorial-demo.html`, Apple, Fluent, Carbon, Primer, Atlassian, Ant Design, GOV.UK, and other reference-system artifacts are exploratory and must not be implemented as the final reader UI unless explicitly re-approved.

The approved standalone prototype remains design evidence. It is not proof that the production reader or live-data states conform until exact-build screenshots, interactions, accessibility, and failure states are separately verified.

The canonical artifact and its screenshot/verification evidence are not yet versioned in this repository; issue #18 tracks that evidence gap and the corrected source-of-truth contract.
