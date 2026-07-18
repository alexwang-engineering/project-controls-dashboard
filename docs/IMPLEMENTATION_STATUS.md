# Implementation status

**Status date:** 18 July 2026  
**Baseline:** Master Plan Version 1.1  
**Release target:** 25 September 2026  
**Current increment:** First tested vertical slice; M1 trust-boundary decisions accepted

## Delivered evidence

| Area | Evidence | State |
|---|---|---|
| Application foundation | React 19, TypeScript 7, Vite 8, router, responsive shell | Working |
| Synthetic dataset | 5 WPs, 60 activities, 16 periods, 8 milestones, 12 risks, 6 changes | Tested |
| Calculation engine | Fixed Week 10 EVM fixture plus missing/zero/boundary behaviour | Tested |
| Management overview | KPI cards, decision headline, curve, WP reconciliation, exceptions | Working |
| Milestones | Read-only register, six-state presentation, calendar variance | Working slice |
| Risks | Read-only register, prioritisation, triggers, 5 × 5 heatmap | Working slice |
| Changes | Read-only register, exposure summary, baseline warning | Working slice |
| Accessibility | Semantic landmarks/tables, skip link, focus, live region, chart table | Implemented in current slice |
| Responsive layout | Desktop and 390 px browser inspection with no page-level overflow | Verified |
| Quality gate | Lint, strict type check, 16 tests, production build | Passing |
| M1 architecture review | Independent Claude review plus accepted import-contract ADR | Complete |

## Milestone position against the accepted plan

| Milestone | Target | Current evidence | Remaining gate work |
|---|---:|---|---|
| M0 — Specification and architecture | 22 Jul | Master plan, two ADRs, stack, fixed fixture, independent M1 review | Record remaining governance registers and formal gate decision |
| M1 — Foundation and import | 31 Jul | Shell, types, demo snapshot, tests, trust-boundary decisions | CSV schemas/parser, validation UI, generation/pointer storage, backup/recovery |
| M2 — Overview | 9 Aug | Core overview, curve, KPIs, WP table, responsive QA | True cross-view filtering, source-row trace, empty/error states, research round |
| M3 — Variance engine | 16 Aug | Core formulas, precision, thresholds, fixture tests | Aggregation trace, current-period view, variance workflow, help content |
| M4 — Milestones | 20 Aug | Read-only register and overview exceptions | Domain status rules/tests, filters, predecessor chain, recovery workflow |
| M5 — Risks | 28 Aug | Read-only register and heatmap | CRUD, inherent score, filters, control/escalation workflow, boundary tests |
| M6 — Changes | 4 Sep | Read-only register and baseline warning | Workflow/state machine, decisions, authority, reconciliation logic |
| M7 — Weekly report | 13 Sep | Route and defined target scope | Snapshot builder, HTML report, print/PDF, narrative and consistency tests |
| M8 — Release gate | 25 Sep | Build pipeline and initial browser QA | Full browser/a11y/security/performance evidence and portfolio assets |

## Next implementation slice

M1 import and trust boundary is next because every editable and report feature
depends on validated, recoverable data.

The normative contract decisions are recorded in
[`ADR-0002`](architecture-decisions/ADR-0002-m1-import-trust-boundary.md).

1. Define Zod schemas and versioned CSV templates for schedule and performance.
2. Build Papa Parse normalisation with row/field error locations and hostile-cell
   neutralisation.
3. Add relationship checks for self-links, missing predecessors, and cycles.
4. Create preview/validation/commit steps and preserve the active dataset on a
   failed import.
5. Add an atomic Dexie repository, import manifest, checksums, backup, and restore.
6. Prove valid, invalid, damaged, and 1,000-row fixtures with automated tests.

## Known limitations

- The work-package control currently highlights the selected row; it does not yet
  recompute every overview element as a true global filter.
- Registers are demonstration views and are not editable yet.
- The three data-quality warnings are fixture metadata; the validation details
  will become actionable in M1.
- Schedule/cost trace, import, persistence, reporting, and settings are planned
  pages, not completed features.
- Browser QA so far covers the in-app Chromium surface at desktop and 390 px; the
  full Chromium/Firefox/WebKit matrix belongs to M8.

## Verification command

```bash
pnpm check
```
