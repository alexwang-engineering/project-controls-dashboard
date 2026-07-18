# ADR-0001: Local-first frontend stack

## Status

Accepted for the first implementation increment on 18 July 2026.

## Context

The product is a single-user portfolio application that imports synthetic project-control data, performs auditable calculations in the browser, persists working data locally, and produces an accessible management view. It does not require authentication, a server, or live enterprise integrations in the MVP.

## Decision

- React and TypeScript for typed component composition.
- Vite for development and production bundling.
- React Router for explicit page boundaries.
- Zustand for small shared UI and reporting state.
- Decimal.js for deterministic financial and ratio calculations.
- Zod and Papa Parse for the future CSV validation boundary.
- Dexie/IndexedDB for the future transactional local repository.
- Recharts for visualisation, always paired with a text summary and data table.
- Plain CSS with design tokens, mobile-first layout, CSS Grid, and container queries.
- Vitest and Testing Library for calculation and component behaviour.
- Oxlint for fast static analysis.

## Consequences

- Domain calculations cannot depend on React, browser time, storage, or network state.
- Raw CSV values cannot enter domain calculations before validation and normalisation.
- Charts are supplementary; equivalent values remain available in semantic HTML.
- Browser persistence is best-effort and must later include backup, quota, and recovery states.
- The selected libraries will be rechecked before the M8 release gate.

## Deferred

- Production backend, authentication, real-time collaboration, certified integrations, critical-path calculation, and Monte Carlo simulation.
