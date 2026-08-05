# Tony News Reader UI Baseline

- Status: Approved
- Decision date: 2026-08-04
- Scope: Reader experience for desktop, tablet, and mobile
- Canonical approved artifact: `tony-news-tony-design-system-demo.html`
- Artifact title: `Tony News — Tony Design System Editorial Demo`
- Companion evidence: `verify_tony_news_demo.py` and `tony-news-demo-verification.json`
- Tracking: #18

## Source of truth

Tony News adopts `tony-news-tony-design-system-demo.html` as the official visual and interaction contract for the reader application.

The canonical artifact was approved in the Tony News project conversation after the Tony Design System pass on 2026-08-04. It supersedes earlier exploratory Tony News concepts, including generic dashboard mockups, `tony-news-editorial-demo.html`, and Apple-, Fluent-, Carbon-, Primer-, Atlassian-, Ant Design-, GOV.UK-, or other reference-system demos.

Those earlier artifacts may remain useful research, but they are not implementation baselines unless a later design decision explicitly re-approves them.

Use this precedence when resolving conflicts:

1. the immutable canonical artifact and its approved screenshots, once versioned in the repository;
2. this project-specific baseline;
3. the Tony Design System overlay;
4. the generic product UI design skill and external reference systems.

The canonical artifact and its evidence are currently retained outside this repository. Until they are imported with an immutable hash and baseline screenshots, this document is the repository-level descriptive contract. It is not sufficient for pixel-level visual verification by itself.

## Decision

Tony News is a news-reading product, not an analytics or admin dashboard. The reader must prioritize scanning, reading, source comparison, event context, and AI-assisted synthesis without overwhelming publisher content.

The approved design is an Editorial Mode reader with a dense but calm three-region desktop silhouette and a single-flow mobile transformation.

This baseline remains authoritative until it is replaced by a later, explicitly approved design decision.

## Product character

Tony News should feel:

- modern and technology-forward;
- calm, dense, and information-rich;
- editorial rather than dashboard-like;
- trustworthy about sources and AI-generated claims;
- compact enough for frequent readers without becoming cramped.

## Canonical desktop silhouette

At the wide desktop reference viewport, the approved artifact uses:

- a 64 px sticky top bar aligned to the page grid;
- a centered shell up to approximately 1376 px wide;
- a 220 px left navigation rail;
- a 760 px primary reading column;
- a 292 px right context rail;
- a 32 px inter-column gap;
- sticky left and right rails while the main reading column scrolls.

Responsive implementation may interpolate these values, but it must preserve the same hierarchy, density, alignment, and two-sidebar reading model at supported desktop widths. At narrower desktop widths, the reference artifact reduces rail widths and gaps before collapsing secondary regions.

### Left navigation rail

The left rail contains:

- primary reader navigation;
- topic filters and their counts;
- source shortcuts;
- saved or followed content;
- compact controls with clear selected states.

The rail is navigation, not a dashboard panel. Do not fill it with KPIs, analytics, status widgets, or decorative cards.

### Main reading column

The primary column preserves this order and visual rhythm:

1. editorial masthead and edition context;
2. one compact Tony signal strip;
3. horizontally scannable topic controls;
4. one leading story with media above the headline, summary, provenance, and actions;
5. optional inline Tony summary attached to that story;
6. the ongoing story feed rendered as rows separated by dividers;
7. supporting methodology or provenance content after the reading flow.

Normal story rows use text as the dominant element and a restrained thumbnail on the right. They are not equal-sized dashboard cards. Headlines, metadata, summary copy, source count, verification state, and contextual actions must remain easy to scan.

### Right context rail

The right rail supports the active reading experience with:

- Tony Brief as the primary contained context card;
- developing stories or watch signals;
- source coverage and comparison;
- event timeline or follow-up context;
- methodology or provenance links.

The right rail must remain secondary to the article content. It must not become a live operations dashboard, a wall of metrics, or a competing feed.

## Tablet and mobile transformation

The approved design does not squeeze desktop sidebars into narrow columns.

Tablet progressively removes or relocates secondary context while preserving the editorial hierarchy and readable line length.

Mobile becomes one reading flow with:

- a compact top app bar;
- a navigation drawer for secondary destinations and topics;
- horizontally scrollable topic controls;
- the lead story and article feed as primary content;
- Tony Brief or relevant AI context inserted into the reading flow;
- a four-destination bottom navigation;
- dialogs transformed into bottom sheets where appropriate;
- story rows that retain a compact right-side thumbnail while reducing low-priority metadata and actions.

At the narrow mobile reference, story thumbnails are approximately 104 px wide, headline size is reduced, lower-priority metadata is hidden, and secondary AI row actions may be removed. These adaptations must not remove source attribution or prevent access to AI context through the story/detail flow.

## Visual system

### Typography

Use Inter Variable as the preferred family, followed by Inter, Segoe UI, Roboto, and compatible system sans fallbacks. Segoe UI is a fallback, not the primary Tony News typeface.

Headlines should be optically compact, highly legible, and use restrained weight contrast rather than editorial display fonts. Use monospace only for narrow technical or indexed values, such as source indices, timestamps, IDs, or keyboard hints.

### Color

- Warm neutral layered surfaces form the majority of the interface.
- Tony Lime is the intelligence and brand accent.
- Lime is reserved for brand identity, selected states, meaningful AI actions, and focused emphasis.
- Lime must not replace semantic success, warning, error, or information colors.
- Lime must not be used as broad decoration, large backgrounds, or repeated status noise.
- Light and dark themes must preserve semantic contrast rather than mechanically invert colors.

### Spacing and geometry

- Use a compact 4 px spacing rhythm.
- Prefer modest 4–12 px rounded geometry for normal controls and contained regions.
- Use borders, dividers, alignment, and surface changes before shadows.
- Reserve stronger shadows for overlays, dialogs, drawers, and transient elevated UI.
- Avoid ornamental gradients, glow, and blur in reading areas.

### Cards

Cards are not the default content primitive.

Use rows and dividers for normal article feeds. Use a contained card only when the content is independently meaningful, such as Tony Brief, source comparison, or a focused event summary.

Avoid dashboard-style grids of equal cards and nested surface stacks.

## AI behavior in the UI

AI must be explicit, contextual, and source-aware.

Approved patterns include:

- summarize this event;
- compare reporting across sources;
- explain what changed;
- identify unresolved claims;
- show supporting sources and citations;
- indicate freshness and confidence limitations.

AI output must not visually impersonate publisher content. Generated summaries need a clear Tony/AI label, provenance, and access to supporting sources. AI controls should remain secondary to reading and should not add sparkle, consensus, or confidence decoration to every row.

## Interaction baseline

The canonical artifact demonstrates:

- light and dark themes with persistence;
- topic filtering synchronized across navigation surfaces;
- search with a `Ctrl/Cmd + K` entry point;
- inline AI summary expansion;
- source comparison dialog;
- save/bookmark feedback and count updates;
- mobile navigation and drawer behavior;
- visible focus, focus return, and Escape dismissal;
- reduced-motion and forced-colors accommodations.

Production implementation may change internal mechanics, but the resulting experience must remain visibly and behaviorally equivalent unless a deliberate design revision is approved.

## Accessibility requirements

- All interactive controls require accessible names.
- Keyboard focus must be visible.
- Dialogs, drawers, and sheets must trap or manage focus appropriately, restore focus, and support Escape dismissal.
- Selected, active, loading, success, warning, and error states must not rely on color alone.
- Text and controls must meet WCAG 2.2 AA contrast targets.
- Motion must respect reduced-motion preferences.
- Mobile controls must remain touch-friendly even when the desktop visual density is compact.

## Implementation guardrails

Do not:

- convert the reader into an admin dashboard;
- implement an earlier Apple, Fluent, Carbon, Primer, Atlassian, Ant Design, GOV.UK, generic dashboard, or earlier Editorial exploration as the final UI;
- introduce decorative charts, KPIs, or tables into the primary reading flow;
- wrap every article or metadata group in a card;
- replace the stacked lead-story composition with a generic card grid;
- move normal story thumbnails to a dominant left-card layout without approval;
- use glassmorphism, neon glow, oversized gradients, or ornamental blur;
- let AI controls dominate publisher content;
- remove source attribution to simplify the layout;
- discard the two-sidebar desktop model without a new approved decision.

Do:

- retain the approved top bar, two-sidebar silhouette, masthead, signal strip, stacked lead story, row feed, and contextual right rail;
- retain dense but readable information hierarchy;
- keep article rows easy to scan;
- surface source provenance close to summaries and claims;
- preserve Tony Lime with restraint;
- design loading, empty, partial-data, stale-data, missing-image, long-headline, and AI-unavailable states;
- reuse semantic design tokens instead of page-local values.

## Production acceptance criteria

A production reader implementation can claim conformance only when:

1. the exact implementation revision is identified;
2. desktop, tablet, and mobile layouts preserve the approved silhouette and hierarchy;
3. the desktop top bar aligns with the three-region grid and the two-sidebar layout has no horizontal overflow;
4. the lead story remains a stacked editorial composition rather than a generic dashboard card;
5. article feeds remain divider-based editorial rows with restrained right-side imagery;
6. the right rail remains contextual and secondary;
7. AI content is labeled and connected to sources;
8. mobile navigation, drawer, reading flow, and bottom-sheet behavior work without compressed desktop rails;
9. light and dark themes pass visual and accessibility review;
10. keyboard navigation, focus return, Escape handling, and overlay dismissal are verified;
11. loading, error, empty, stale, missing-image, long-content, and AI-unavailable states are implemented;
12. representative real article data is tested, including long Vietnamese headlines and irregular publisher metadata;
13. exact-build screenshots are compared against the approved visual evidence at 1600 × 1200, 900 × 1000, and 390 × 844, or approved replacement viewports;
14. any intentional visual deviation is documented and explicitly approved before merge.

## Existing prototype verification

The companion verification recorded the following for the canonical artifact at 1600 × 1200, 900 × 1000, and 390 × 844:

- document width matched viewport width with no horizontal overflow;
- theme switching worked;
- topic filtering worked;
- inline summary expansion worked;
- source comparison opened and closed with Escape;
- bookmarking updated the saved count;
- no page or console errors were recorded.

This validates the standalone mock-content prototype only.

## Current evidence gap

The canonical HTML artifact, screenshots, verification script, and verification JSON are not yet versioned in this repository. Importing an immutable evidence package remains required before a production implementation can be verified visually from repository data alone.

The approved prototype is not evidence that the future Next.js reader, real API integration, loading states, failure states, article detail flow, or live source data conform to the design. Those items require exact-build verification against the canonical contract.
