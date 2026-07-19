# Implementation status

**Status date:** 19 July 2026
**Baseline:** Master Plan Version 1.1  
**Release target:** 25 September 2026  
**Current increment:** M3/M7 reconciled weekly management-report working slice

**Evidence-weighted MVP progress:** 61% (57.5 of 94 planned hours)

## Delivered evidence

| Area | Evidence | State |
|---|---|---|
| Application foundation | React 19, TypeScript 7, Vite 8, router, responsive shell | Working |
| Synthetic dataset | 5 WPs, 60 activities, 16 periods, 8 milestones, 12 risks, 6 changes | Tested |
| Calculation engine | Fixed Week 10 EVM fixture plus missing/zero/boundary behaviour | Tested |
| Management overview | Active-import KPI cards, decision headline, curve, WP reconciliation, source status and exceptions | Working |
| Schedule and cost | Period/scope filters, cumulative EVM, WP reconciliation and activity-level source trace | Working slice |
| Milestones | Read-only register, six-state presentation, calendar variance | Working slice |
| Risks | Read-only register, prioritisation, triggers, 5 × 5 heatmap | Working slice |
| Changes | Read-only register, exposure summary, baseline warning | Working slice |
| Accessibility | Semantic landmarks/tables, skip link, focus, live region, chart table | Implemented in current slice |
| Responsive layout | Desktop and 390 px browser inspection with no page-level overflow | Verified |
| Quality gate | Lint, strict type check, 213 tests, production build | Passing |
| M1 architecture review | Independent Claude review plus accepted import-contract ADR | Complete |
| M1 fixture/parser boundary | 29 checksum-pinned RFC/hostile/limit files, scalar grammars, safe export with explicit trust policy, manual headers | Tested increment |
| M1 row schemas | Branded activities/performance, strict row and cross-field rules, stable machine codes | Tested increment |
| M1 candidate validation | Duplicate keys, registries, cross-file agreement, EV cap, cadence/data date | Tested increment |
| M1 schedule graph | Self/missing links, exact cycle members, lag/open-end/constraint warnings, iterative 10,000-node proof | Tested increment |
| M1 import orchestration | Accepted-row stage isolation, explicit quarantine loop, manifest/count reconciliation | Tested increment |
| M1 generation repository | Pointer-last Dexie commit, active reads, rollback/quota injection, confirmation, duplicate history, revert and GC | Tested increment |
| M1 import interface | Guided two-file selection, validation evidence, first-registry/repeated-checksum confirmation and atomic receipt | Working |
| M1 worker boundary | Versioned module-worker protocol and structurally identical pure fallback result | Tested |
| M1 complete import pair | 60 activities, 8 schedule milestones and 960 performance rows across 16 periods | Tested |
| M1 performance | 1,000 activities plus their performance rows processed in 41 ms on the development machine; gate is under 2 seconds | Passing |
| M1 registry evolution | Additive-only revisions, explicit confirmation, CAS transaction, history and automatic revalidation | Tested |
| M1 closure evidence | Hermes and Claude approved `ce27219..2c858c4` in isolated checkouts; the post-review ratification resolves both process flags and the live packaged app accepted 1,020 rows | Complete |
| Active-data integration | One shared dataset boundary refreshes after commit and supplies the shell, Overview and Schedule & Cost | Working |
| EAC sensitivity | Budget-rate, CPI-continuation and CPI × SPI scenarios expose formulas, assumptions, VAC and TCPI consequences | Tested working slice |
| Variance analysis | Generation-aware draft, structured impacts/actions, ownership, sign-off validation and immutable revisions | Tested working slice |
| Weekly management report | Deterministic current/cumulative reconciliation, EAC sensitivity, signed-analysis coverage, publication controls, baseline/change separation and accessible HTML/print preview | Working slice |
| Backup and recovery | Versioned active-generation JSON, strict schema/domain preview and pointer-last atomic restore | Tested |
| Storage settings | Usage/quota status, persistence request, lifecycle history and explicitly confirmed local reset | Working |
| Desktop review build | Signed native AppKit/WebKit macOS window, app-owned private server, SPA route fallback and repeatable packaging command | Verified |

## Milestone position against the accepted plan

| Milestone | Target | Current evidence | Remaining gate work |
|---|---:|---|---|
| M0 — Specification and architecture | 22 Jul | Master plan, two ADRs, data dictionary, stack, fixed fixture, independent M1 review | Record remaining governance registers and formal gate decision |
| M1 — Foundation and import | 31 Jul | Worker/fallback validation, complete ASTER pair, controlled registry revisions, atomic generations and recovery | Closed 19 Jul: independent review approved and live module worker confirmed |
| M2 — Overview | 9 Aug | Active-generation overview, curve, KPIs, WP table, Schedule & Cost drill-down, source trace and labelled fallback | True global cross-view filter, empty/error browser QA and research round |
| M3 — Variance engine | 16 Aug | Core formulas, precision, thresholds, three EAC scenarios, imported aggregation, cumulative trace, signed variance-analysis revisions and weekly-report reconciliation | Independent M3 calculation/closure review |
| M4 — Milestones | 20 Aug | Read-only register and overview exceptions | Domain status rules/tests, filters, predecessor chain, recovery workflow |
| M5 — Risks | 28 Aug | Read-only register and heatmap | CRUD, inherent score, filters, control/escalation workflow, boundary tests |
| M6 — Changes | 4 Sep | Read-only register and baseline warning | Workflow/state machine, decisions, authority, reconciliation logic |
| M7 — Weekly report | 13 Sep | Deterministic snapshot builder, current/cumulative and forecast reconciliation, signed-analysis publication gate, exception narrative, accessible HTML preview and print styles | Editable management summary, persisted snapshots, fewer-than-five-actions journey and print/PDF visual QA |
| M8 — Release gate | 25 Sep | Build pipeline and initial browser QA | Full browser/a11y/security/performance evidence and portfolio assets |

## Next implementation slice

1. Add explicit decision authority and controlled change transitions so the
   weekly-report publication gate can be satisfied.
2. Make the selected work package a true cross-view scope rather than an
   Overview row highlight.
3. Run the M2 moderated comprehension study and record the findings.
4. Persist an approved report snapshot and complete print/PDF visual QA.

## Known limitations

- The Overview work-package control highlights and identifies the row; the
  Schedule & Cost control performs the scoped recalculation. A shared global
  scope remains to be implemented.
- Registers are demonstration views and are not editable yet.
- Milestone, risk and change registers are explicitly labelled synthetic even
  when schedule/cost values come from an active import.
- Weekly reporting is a working preview: its HTML output is authoritative and
  print uses the same snapshot, but reports are not yet persisted, editable or
  print/PDF visually approved. Variance analysis remains outside active-
  generation JSON backups and is not yet linked to approved baseline revisions.
- Browser QA covers the in-app Chromium surface at desktop and 390 px, and the
  native macOS WKWebView host has a verified desktop window and server lifecycle;
  the full Chromium/Firefox/WebKit matrix belongs to M8.

## Verification command

```bash
pnpm check
```
