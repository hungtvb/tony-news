# ADR-0001: Phase 0 bootstrap boundary

- Status: Accepted
- Date: 2026-08-04

## Context

Tony News needs evidence for RSS acquisition, article normalization, event clustering, and AI summary factuality before building the polished reader UI.

## Decision

Start with a TypeScript pnpm monorepo and keep the first executable slice deliberately small:

- versioned source registry;
- RSS parser and response validator;
- network smoke CLI for the nine selected feeds;
- unit tests and CI;
- placeholder boundaries for web and worker applications.

The initial RSS parser is a Phase 0 discovery parser, not the final production parser. It extracts only title, link, publication time, and identifier fields needed to validate feeds. Full article extraction remains a separate adapter layer.

## Consequences

- The ingestion path can be tested before provisioning databases or AI credentials.
- AI outages cannot block source discovery.
- Parser limitations are explicit and measurable.
- A production-grade XML library may replace the bootstrap parser after real-feed evidence is collected.
