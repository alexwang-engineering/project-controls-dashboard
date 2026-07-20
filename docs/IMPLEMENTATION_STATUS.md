# Implementation status

**Status date:** 20 July 2026
**Baseline:** Master Plan Version 1.1  
**Release target:** 25 September 2026  
**Current increment:** Global work-package scope and management-view consistency

**Evidence-weighted MVP progress:** 81% (76.6 of 94 planned hours)

## Delivered evidence

| Area | Evidence | State |
|---|---|---|
| Application foundation | React 19, TypeScript 7, Vite 8, router, responsive shell | Working |
| Test fixture dataset | 5 WPs, 60 activities, 16 periods, 8 milestones, 12 risks, 6 changes; never shown on a clean production launch | Tested |
| Calculation engine | Fixed Week 10 EVM fixture plus missing/zero/boundary behaviour | Tested |
| Management overview | Active-import KPI cards, decision headline, curve, WP reconciliation, source status and globally scoped exceptions | Working |
| Schedule and cost | Global WP scope, period filter, cumulative EVM, WP reconciliation and activity-level source trace | Working slice |
| Milestones | Global WP scope, validated add/edit/delete input, local persistence, six-state presentation, calendar variance and overview/report integration | Working slice |
| Risks | Global WP scope, cause–event–effect input, inherent/residual score and trend, local persistence, combined filters, selectable accessible heatmap, objective tolerance, control tests, overdue exceptions and escalation/acceptance evidence | Working slice |
| Changes | Complete impact input, enforced state machine, decision authority/history, retained generation baselines, exact BAC/finish reconciliation, pre/post performance comparison and historical-value publication gate | Working |
| Accessibility | Semantic landmarks/tables, skip link, focus, live region, chart table | Implemented in current slice |
| Responsive layout | Desktop and 390 px browser inspection with no page-level overflow | Verified |
| Quality gate | Lint, strict type check, 279 tests, production build | Passing |
| M1 architecture review | Independent Claude review plus accepted import-contract ADR | Complete |
| M1 fixture/parser boundary | 29 checksum-pinned RFC/hostile/limit files, scalar grammars, safe export with explicit trust policy, manual headers | Tested increment |
| M1 row schemas | Branded activities/performance, strict row and cross-field rules, stable machine codes | Tested increment |
| M1 candidate validation | Duplicate keys, registries, cross-file agreement, EV cap, cadence/data date | Tested increment |
| M1 schedule graph | Self/missing links, exact cycle members, lag/open-end/constraint warnings, iterative 10,000-node proof | Tested increment |
| M1 import orchestration | Accepted-row stage isolation, explicit quarantine loop, manifest/count reconciliation | Tested increment |
| M1 generation repository | Pointer-last Dexie commit, active reads, rollback/quota injection, confirmation, duplicate history, revert and GC | Tested increment |
| Baseline evidence repository | Every committed generation retains compact authorised-definition and period evidence; reused versions cannot change schedule/budget facts and GC never removes snapshots | Tested increment |
| M1 import interface | Guided manual two-file selection, blank header templates, validation evidence, first-registry/repeated-checksum confirmation and atomic receipt | Working |
| M1 worker boundary | Versioned module-worker protocol and structurally identical pure fallback result | Tested |
| M1 complete import pair | 60 activities, 8 schedule milestones and 960 performance rows across 16 periods | Tested |
| M1 performance | 1,000 activities plus their performance rows processed in 41 ms on the development machine; gate is under 2 seconds | Passing |
| M1 registry evolution | Additive-only revisions, explicit confirmation, CAS transaction, history and automatic revalidation | Tested |
| M1 closure evidence | Hermes and Claude approved `ce27219..2c858c4` in isolated checkouts; the post-review ratification resolves both process flags and the live packaged app accepted 1,020 rows | Complete |
| Active-data integration | One shared dataset boundary refreshes after commit and supplies the shell, Overview and Schedule & Cost | Working |
| EAC sensitivity | Budget-rate, CPI-continuation and CPI × SPI scenarios expose formulas, assumptions, VAC and TCPI consequences | Tested working slice |
| Variance analysis | Generation-aware draft, structured impacts/actions, ownership, sign-off validation and immutable revisions | Tested working slice |
| Weekly management report | Deterministic reconciliation, editable narrative, exact source fingerprint, source-bound draft, append-only revisions, rollback/race evidence, OS-print provenance guard and inspected three-page A4 publication PDF | Working slice |
| Backup and recovery | Versioned active-generation JSON, strict schema/domain preview and pointer-last atomic restore | Tested |
| Storage settings | Usage/quota status, persistence request, lifecycle history and explicitly confirmed local reset | Working |
| Desktop review build | Signed native AppKit/WebKit macOS window, app-owned private server, SPA route fallback and repeatable packaging command | Verified |

## Milestone position against the accepted plan

| Milestone | Target | Current evidence | Remaining gate work |
|---|---:|---|---|
| M0 — Specification and architecture | 22 Jul | Master plan, two ADRs, data dictionary, stack, fixed fixture, independent M1 review | Record remaining governance registers and formal gate decision |
| M1 — Foundation and import | 31 Jul | Worker/fallback validation, complete ASTER pair, controlled registry revisions, atomic generations and recovery | Closed 19 Jul: independent review approved and live module worker confirmed |
| M2 — Overview | 9 Aug | Global WP scope across Overview calculations/chart, Schedule & Cost and matching milestone/risk/change records; full-project publication/baseline boundary; active-generation source trace and setup-required state | Error browser QA and research round |
| M3 — Variance engine | 16 Aug | Core formulas, precision, thresholds, three EAC scenarios, imported aggregation, cumulative trace, signed variance-analysis revisions and weekly-report reconciliation | Independent M3 calculation/closure review |
| M4 — Milestones | 20 Aug | Persistent validated CRUD, status/date guard, variance and overview/report exceptions | Filters, predecessor chain and recovery workflow |
| M5 — Risks | 28 Aug | Persistent cause–event–effect CRUD, inherent/residual comparison and trend, AND filters, selectable heatmap, tolerance rules, control evidence, overdue exceptions and controlled escalation/acceptance | Project-configurable tolerance revisions, immutable register history and final independent review |
| M6 — Changes | 4 Sep | Complete impact case, enforced transitions, immutable decisions, retained original/current baselines, cost/schedule reconciliation, effective-period comparison and preserved historical variance | Technical exit criteria complete; closure evidence is retained for release review |
| M7 — Weekly report | 13 Sep | Deterministic builder, source-bound narrative, immutable revisions, active-pointer CAS, exact stored-snapshot rendering, live-print rejection and inspected three-page A4 real-data publication | Fixed full-ASTER PDF, practical Firefox/WKWebView print checks and fewer-than-five-actions usability evidence |
| M8 — Release gate | 25 Sep | Build pipeline and initial browser QA | Full browser/a11y/security/performance evidence and portfolio assets |

## Next implementation slice

1. Run the M2 moderated comprehension study and record the findings.
2. Repeat the approved A4 print/PDF path with full ASTER and complete Firefox/WKWebView checks.
3. Add milestone predecessor-chain and recovery-action trace.
4. Add project-calendar definitions so schedule-change reconciliation can
   move from explicit calendar-day arithmetic to source working days.

## Known limitations

- Milestone, risk and change inputs persist locally and feed the Overview and
  report, but the active-generation JSON backup does not yet include them or
  the multi-generation baseline evidence ledger.
- The risk workflow uses documented default objective tolerances; it does not
  yet maintain project-specific appetite revisions or immutable register
  history. Milestones still lack predecessor-chain credibility and full
  recovery-action trace. Baseline finish reconciliation
  currently treats entered schedule-impact days as calendar days because the
  imported calendar registry identifies calendars but does not define working
  time.
- Weekly reporting now persists editable source-bound drafts and append-only
  publications; both the UI and OS print path limit report output to a selected
  stored revision. A three-page real-data Chromium PDF is approved, while the
  fixed full-ASTER and Firefox/WKWebView checks remain. Report records, variance
  analysis and management registers remain outside active-generation JSON
  backups and variance sign-off is not yet linked to approved baseline revisions.
- Browser QA covers the in-app Chromium surface at desktop and 390 px, and the
  native macOS WKWebView host has a verified desktop window and server lifecycle;
  the full Chromium/Firefox/WebKit matrix belongs to M8.

## Verification command

```bash
pnpm check
```
