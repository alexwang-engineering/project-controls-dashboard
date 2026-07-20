# Project Controls Dashboard

A local-first project-controls application for turning your engineering
schedule, cost, milestone, risk, and change inputs into a concise management
position.

The current implementation is a tested local-first slice based on the Version
1.1 master plan. A new installation starts empty: no demonstration figures are
presented as project data.

## What is working now

- Responsive, keyboard-accessible application shell and feature navigation.
- A compiled macOS AppKit/WebKit host that opens the dashboard in its own native
  window and owns its localhost-only server lifecycle; it does not launch a web
  browser.
- Decision-first management overview with KPI status, exceptions, and source
  metadata.
- Auditable earned-value calculations for BAC, PV, EV, AC, SV, CV, SPI, CPI,
  WR, three EAC views, ETC, VAC, and TCPI.
- Cumulative planned, earned, and actual curve. Future EV and AC values are not
  presented beyond the current reporting date.
- One global work-package scope across Overview, Schedule & Cost, Milestones,
  Risks and Changes, with scoped calculations, charts, summaries and records.
  Weekly publications and baseline reconciliation remain visibly locked to the
  full project so controlled evidence cannot be accidentally narrowed.
- Source-linked milestone import and refresh with reporting-date-derived status,
  baseline/previous/current movement, exception/next-30 filters, iterative
  predecessor evidence and structured cause/recovery/owner/due/decision fields.
  Adverse records with incomplete recovery or unresolved schedule logic block
  weekly-report publication; the evidence view never claims to calculate CPM.
- Validated add/edit/delete risk input with cause–event–effect statements,
  inherent/residual scoring, trend, combined filters, a selectable accessible
  5 × 5 heatmap, objective tolerance, tested controls, overdue review/action
  exceptions, and evidenced escalation or authorised acceptance.
- Validated add/edit/delete change input with signed impacts and an
  approved-but-not-baselined integrity warning.
- A controlled change state machine that prevents skipped decisions, locks the
  submitted impact case, retains authority/actor/date/rationale/evidence for
  each transition, and requires rebaseline evidence before implementation.
- Immutable compact evidence for every imported baseline generation, with a
  hard guard against changing authorised schedule/budget facts under a reused
  version and GC-safe original-to-current reconciliation.
- Effective-period before/after comparisons that preserve pre-change variance
  and block weekly-report publication if historical PV, EV or AC was rewritten.
- Route-level code splitting, semantic chart alternatives, reduced-motion and
  forced-colour support.
- Automated calculation, fixture, application, navigation, and accessibility-
  oriented component checks.
- Twenty-six browser journeys across Chromium, Firefox, WebKit and a dedicated
  390 × 844 Chromium project. They prove the empty input-first launch, all page
  guides, real CSV validation and atomic commit, imported calculations,
  milestone recovery controls, 48 WCAG A/AA axe-scanned states, keyboard/skip/
  focus behaviour, 320 px reflow with WCAG text spacing, 24 px target sizing,
  reduced motion and forced colours in fresh isolated browser contexts.
- A restrictive production content-security policy without `unsafe-eval`, with
  the import worker constrained to same-origin assets and Zod placed in its
  supported CSP-safe jitless mode before schemas load. Every Playwright journey
  fails if the app makes an unexpected HTTP(S) request outside its local test
  origin.
- The native loopback server adds CSP, frame, MIME, referrer, permissions and
  cross-origin isolation headers, disables caching and directory listings, and
  rejects paths that resolve outside the packaged web root. Checked-in native
  server tests exercise those controls over a real ephemeral HTTP listener.
- A high-severity dependency audit runs in the release command and CI;
  Dependabot and CodeQL workflows provide ongoing dependency and static-analysis
  coverage after they run on GitHub.
- Guided schedule/performance CSV import with downloadable blank templates,
  field-level validation, checksum control, explicit registry confirmation, and
  pointer-last atomic persistence.
- A versioned Vite module worker for parsing and validation, with one pure
  processor shared by the explicitly labelled compatibility fallback.
- The complete ASTER import pair: 60 activities, eight schedule milestones and
  960 records spanning 16 weekly periods, all processed through the real import
  pipeline rather than loaded as a shortcut snapshot.
- Explicit additive project-registry revisions with confirmation, compare-and-
  set protection, revision history and mandatory post-update revalidation.
- A shared active-generation boundary that supplies project metadata and
  reconciled performance to the shell, Overview, and Schedule & Cost pages.
- Period/work-package filtering plus cumulative EVM and activity-level source
  trace on Schedule & Cost.
- Three transparent management EAC scenarios: remaining work at budget rate,
  CPI continuation, and CPI × SPI composite continuation. Each exposes its
  formula, assumption, VAC and performance-to-complete consequence.
- A generation-aware variance-analysis workflow with read-only facts, structured
  causes/impacts/actions, draft persistence, explicit ownership, sign-off gates,
  and immutable revision history.
- A deterministic weekly management-report preview that keeps current-period
  and cumulative facts distinct, presents three EAC sensitivities, requires a
  current signed variance analysis for every threshold breach, and separates
  approved-but-unincorporated changes from the active baseline.
- Editable management narrative with one source-bound draft, an exact
  fingerprint over the report calculations and complete source evidence,
  append-only published revisions, stale-generation protection, and a retained
  publication history.
- Accessible HTML is the authoritative report format. The secondary print/PDF
  action is enabled only for a selected persisted publication and therefore
  renders the same approved timestamp, facts and narrative. Publication remains
  disabled while source, variance, baseline, decision-authority or narrative
  controls are incomplete. Cmd/Ctrl+P follows the same boundary: a live preview
  prints only a rejection notice, while the report document is printable only
  when an immutable revision is selected.
- Explicit setup-required screens whenever no validated import is active; the
  Overview, Schedule & Cost and report never substitute demonstration figures.
- A Settings & Data workflow with browser storage health, persistence requests,
  versioned active-generation backup, schema/domain-validated atomic restore,
  and an explicitly confirmed local reset.

Backups intentionally contain the active imported generation and its confirmed
registry only. They do not yet contain the locally entered milestone, risk and
change registers, variance-analysis drafts or signed revisions, weekly-report
drafts or published revisions, older manifests, checksum-detection history, or
the rows needed by **Revert to previous**. Keep
the original CSV files and local app data when those records are required. The
backup input limit is 20 MiB; each source CSV remains limited to 5 MiB.

The M1 closure increment was independently reviewed by Hermes and Claude in
isolated checkouts and approved with no blocking findings; the post-review
ratification and process-flag resolution are recorded in
[`M1_CLOSURE_EVIDENCE.md`](docs/M1_CLOSURE_EVIDENCE.md). Controlled register
workflow history and persisted report publication are now implemented. A
selected real-data publication has passed the three-page A4 Chromium layout
check, the live-preview rejection path has been rendered and inspected, and the
complete 1,020-row ASTER journey has produced an inspected four-page immutable
publication. Firefox and native WKWebView print approval remain.
The M2 global-scope increment is recorded in
[`M2_GLOBAL_SCOPE_EVIDENCE.md`](docs/M2_GLOBAL_SCOPE_EVIDENCE.md). The M5
risk-control increment and its remaining limitations are recorded in
[`M5_RISK_CONTROL_EVIDENCE.md`](docs/M5_RISK_CONTROL_EVIDENCE.md).
The completed M4 milestone-control contract and its bounded CPM limitation are
recorded in
[`M4_MILESTONE_CONTROL_EVIDENCE.md`](docs/M4_MILESTONE_CONTROL_EVIDENCE.md).
The repeatable cross-browser critical-flow gate is recorded in
[`M8_BROWSER_JOURNEY_EVIDENCE.md`](docs/M8_BROWSER_JOURNEY_EVIDENCE.md).
The automated accessibility findings, fixes and explicit manual-testing
boundary are recorded in
[`M8_ACCESSIBILITY_EVIDENCE.md`](docs/M8_ACCESSIBILITY_EVIDENCE.md).
The local security/privacy threat model, controls, negative findings and
explicit limitations are recorded in
[`M8_SECURITY_PRIVACY_EVIDENCE.md`](docs/M8_SECURITY_PRIVACY_EVIDENCE.md).
The signed app's route-by-route WKWebView semantic tree, macOS keyboard path,
real CSV picker, malformed-file recovery, bundle/header proof and remaining
manual boundary are recorded in
[`M8_NATIVE_RELEASE_INSPECTION.md`](docs/M8_NATIVE_RELEASE_INSPECTION.md).

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

Install the pinned Playwright browser engines once, then run the release gate:

```bash
pnpm exec playwright install chromium firefox webkit
pnpm check:release
```

Playwright starts its own production preview server. Each test receives a new
browser context, so IndexedDB and local storage cannot leak between journeys.
Failure screenshots, video and first-retry traces are written only to ignored
test-artifact directories. The release command also audits dependencies at the
high-severity threshold and starts the real native loopback server for its
header, SPA fallback, traversal and directory-listing tests.

## Architecture

```text
src/
├── app/             routing and shared UI state
├── components/      reusable semantic interface components
├── data/            deterministic calculation fixtures used by automated tests
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

The repository fixtures are synthetic. Data you choose in the app is processed
and retained locally on that device; no CV, university, employer, client, or
confidential project data is included in the source repository. A cloud backend
and authentication are outside the portfolio-release scope.

The application has no analytics, telemetry or remote API path. Automated
browser journeys fail on any unexpected external HTTP(S) request. Imported and
user-entered data remain in browser/WebKit local storage until the user resets
it; a downloaded backup leaves that boundary only because the user explicitly
chooses a destination. This local-first design does not claim application-level
encryption at rest: device access, macOS account security and backup handling
remain user responsibilities.

## Delivery baseline

The source of truth is
`/Users/wjl/Desktop/Project_Controls_Dashboard_Master_Plan.md` Version 1.1,
dated 18 July 2026, with a target portfolio release of 25 September 2026.
Current completion evidence and the next implementation slice are recorded in
[`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).
