# Project Controls Dashboard

A local-first project-controls portfolio application for turning synthetic
engineering schedule, cost, milestone, risk, and change data into a concise
management position.

The current implementation is a tested local-first slice based on the Version
1.1 master plan. It accepts only controlled synthetic data for the portfolio
release.

## What is working now

- Responsive, keyboard-accessible application shell and feature navigation.
- Decision-first management overview with KPI status, exceptions, and source
  metadata.
- Auditable earned-value calculations for BAC, PV, EV, AC, SV, CV, SPI, CPI,
  WR, three EAC views, ETC, VAC, and TCPI.
- Cumulative planned, earned, and actual curve. Future EV and AC values are not
  presented beyond the current reporting date.
- Work-package reconciliation table and interactive highlight control.
- Eight-milestone control register with baseline/forecast variance.
- Twelve-risk register and accessible 5 × 5 residual-risk heatmap.
- Six-item change register with an approved-but-not-baselined integrity warning.
- Route-level code splitting, semantic chart alternatives, reduced-motion and
  forced-colour support.
- Automated calculation, fixture, application, navigation, and accessibility-
  oriented component checks.
- Guided schedule/performance CSV import with field-level validation, checksum
  control, explicit registry confirmation, and pointer-last atomic persistence.
- A shared active-generation boundary that supplies project metadata and
  reconciled performance to the shell, Overview, and Schedule & Cost pages.
- Period/work-package filtering plus cumulative EVM and activity-level source
  trace on Schedule & Cost.
- An explicit synthetic-fallback label whenever no validated import is active.

Backup/restore, the worker boundary, structured variance ownership, editable
registers, and weekly report generation remain to be implemented.

## Fixed Week 10 control fixture

| Measure | Expected result |
|---|---:|
| BAC | £2,400,000 |
| PV | £1,500,000 |
| EV | £1,350,000 |
| AC | £1,440,000 |
| SV | -£150,000 |
| CV | -£90,000 |
| SPI | 0.900 |
| CPI | 0.9375 |
| CPI-based EAC | £2,560,000 |
| VAC | -£160,000 |
| TCPI to BAC | 1.09375 |

The tests reproduce these values from the pure calculation library; presentation
rounding is applied only at the UI boundary.

## Run locally

Requirements: Node.js 22.12 or newer and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4173`.

Run the complete quality gate:

```bash
pnpm check
```

This runs linting, strict TypeScript checks, all Vitest tests, and the production
build.

## Architecture

```text
src/
├── app/             routing and shared UI state
├── components/      reusable semantic interface components
├── data/            synthetic Aster demonstration snapshot
├── domain/          records, validation, graph rules, calculations and view models
├── features/        import, overview, schedule/cost and management registers
├── repositories/    atomic local generations and active-dataset reads
├── styles/          design tokens and responsive/accessibility rules
└── test/            shared test environment
```

The domain layer does not depend on React, storage, network state, or browser
time. Decimal.js protects calculation precision. Charts supplement rather than
replace semantic tables. The accepted stack decision is recorded in
[`ADR-0001`](docs/architecture-decisions/ADR-0001-frontend-stack.md). The M1
import, validation, worker, and generation-storage contract is recorded in
[`ADR-0002`](docs/architecture-decisions/ADR-0002-m1-import-trust-boundary.md).

## Privacy boundary

All included project and commercial information is synthetic. No CV, university,
employer, client, or confidential project data is included. The MVP is designed
to process data locally in the browser; a cloud backend and authentication are
outside the portfolio-release scope.

## Delivery baseline

The source of truth is
`/Users/wjl/Desktop/Project_Controls_Dashboard_Master_Plan.md` Version 1.1,
dated 18 July 2026, with a target portfolio release of 25 September 2026.
Current completion evidence and the next implementation slice are recorded in
[`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).
