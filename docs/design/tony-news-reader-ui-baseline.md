# Tony News Reader UI Baseline

- Status: Approved
- Decision date: 2026-08-04
- Scope: Reader experience for desktop, tablet, and mobile
- Prototype: `apps/web/prototypes/tony-news-reader-demo.html`

## Decision

Tony News adopts the approved Editorial Mode prototype as the official visual and interaction baseline for the reader application.

The product is a news-reading experience, not an analytics or admin dashboard. The interface must prioritize scanning, reading, source comparison, event context, and AI-assisted synthesis without overwhelming the article content.

This baseline remains authoritative until it is replaced by a later, explicitly approved design decision.

## Product character

Tony News should feel:

- modern and technology-forward;
- calm, dense, and information-rich;
- editorial rather than dashboard-like;
- trustworthy about sources and AI-generated claims;
- compact enough for frequent readers without becoming cramped.

## Desktop information architecture

The desktop reader uses three persistent regions:

1. Left sidebar
   - primary reader navigation;
   - topic and source filters;
   - saved and followed content;
   - compact controls with clear selected states.

2. Main reading column
   - leading event or story;
   - topic signals and story clusters;
   - article feed rendered primarily as rows separated by dividers;
   - strong headline hierarchy and restrained metadata.

3. Right context sidebar
   - Tony Brief;
   - source coverage and comparison;
   - event timeline or follow-up signals;
   - AI context that supports the active story rather than competing with it.

The layout must preserve the approved two-sidebar reading model. It must not be simplified into a generic centered card grid for desktop.

## Mobile information architecture

Mobile becomes a single reading flow:

- compact top app bar;
- horizontally scrollable topic controls;
- article feed as the primary content;
- Tony Brief inserted into the feed at relevant positions;
- bottom navigation for high-frequency destinations;
- secondary navigation exposed through a drawer or sheet.

Desktop sidebars must not be squeezed into narrow columns on mobile.

## Visual system

### Typography

Use a modern productivity-oriented sans-serif system. Prefer Segoe UI or a compatible system sans stack in implementation. Headlines should be optically compact, highly legible, and use restrained weight contrast rather than editorial display fonts.

### Color

- Neutral layered surfaces form the majority of the interface.
- Tony Lime is the intelligence accent.
- Lime is reserved for brand identity, selected states, meaningful AI actions, and focused emphasis.
- Lime must not be used as broad decoration, large backgrounds, or repeated status noise.
- Light and dark themes must preserve semantic contrast rather than mechanically invert colors.

### Spacing and geometry

- Use a compact 4 px spacing rhythm.
- Prefer modest rounded geometry.
- Use borders, dividers, and surface changes before shadows.
- Shadows should be subtle and reserved for overlays or elevated transient UI.

### Cards

Cards are not the default content primitive.

Use rows and dividers for normal article feeds. Use a contained card only when the content is independently meaningful, such as Tony Brief, a source-comparison block, or a focused event summary.

Avoid dashboard-style grids of equal cards.

## AI behavior in the UI

AI must be explicit, contextual, and source-aware.

Approved patterns include:

- summarize this event;
- compare reporting across sources;
- explain what changed;
- identify unresolved claims;
- show supporting sources and citations;
- indicate freshness and confidence limitations.

AI output must not visually impersonate publisher content. Generated summaries need a clear Tony/AI label and access to supporting sources.

## Interaction baseline

The approved prototype demonstrates the expected interaction direction:

- light and dark themes;
- topic filtering;
- search entry point with keyboard shortcut support;
- AI summary expansion;
- source comparison dialog;
- save/bookmark feedback;
- keyboard focus management;
- responsive navigation behavior.

Production implementation may change internal mechanics, but the resulting experience should remain visibly and behaviorally equivalent unless a deliberate design revision is approved.

## Accessibility requirements

- All interactive controls require accessible names.
- Keyboard focus must be visible.
- Dialogs, drawers, and sheets must manage focus and Escape behavior.
- Selected, active, loading, success, warning, and error states must not rely on color alone.
- Text and controls must meet WCAG 2.2 AA contrast targets.
- Motion must respect reduced-motion preferences.

## Implementation guardrails

Do not:

- convert the reader into an admin dashboard;
- introduce decorative charts, KPIs, or tables into the primary reading flow;
- wrap every article or metadata group in a card;
- use glassmorphism, neon glow, oversized gradients, or ornamental blur;
- let AI controls dominate publisher content;
- remove source attribution to simplify the layout;
- discard the two-sidebar desktop model without a new approved decision.

Do:

- retain dense but readable information hierarchy;
- keep article rows easy to scan;
- surface source provenance close to summaries and claims;
- preserve the lime intelligence accent with restraint;
- design loading, empty, partial-data, stale-data, and AI-unavailable states;
- reuse semantic design tokens instead of page-local values.

## Production acceptance criteria

A production reader implementation can claim conformance with this baseline only when:

1. desktop, tablet, and mobile layouts match the approved information architecture;
2. article feeds remain editorial rows rather than a generic card grid;
3. AI content is labeled and connected to sources;
4. the two-sidebar desktop layout works without horizontal overflow at the supported desktop breakpoint;
5. mobile navigation and reading flow work without desktop sidebars being compressed into view;
6. light and dark themes pass visual and accessibility review;
7. keyboard navigation, focus handling, and overlay dismissal are verified;
8. loading, error, empty, stale, and AI-unavailable states are implemented;
9. representative real article data has been tested, including long Vietnamese headlines and irregular publisher metadata.

## Current evidence and limitations

The standalone prototype has been reviewed and approved as the design baseline. It demonstrates responsive layout and key interactions with mock content.

It is not yet evidence that the production Next.js reader, real API integration, loading states, failure states, article detail flow, or live source data conform to the design. Those items must be verified during implementation.