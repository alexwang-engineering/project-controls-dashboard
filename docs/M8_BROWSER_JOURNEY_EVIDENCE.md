# M8 cross-browser journey evidence

**Evidence date:** 20 July 2026  
**Milestone:** M8 — Quality and portfolio release  
**Scope:** Input-first, import, calculated overview, milestone control, full-ASTER publication and 390 px layout
**Decision:** Working M8 increment; not the final release gate

## Outcome

The production build now has a repeatable Playwright boundary for the most
important user journey. Fourteen runs pass: four journeys in each of Chromium,
Firefox and WebKit, plus two dedicated Chromium journeys at 390 × 844.
The adjacent Vitest gate contains 305 passing unit and integration tests; its
configuration explicitly excludes `e2e/**` so each runner owns one test layer.

Subsequent accessibility, security and publication increments expand the same
isolated suite to **26 runs**: 10 Chromium, 7 Firefox, 7 WebKit and 2 dedicated
390 × 844 Chromium runs. The additional Chromium journey completes the entire
60-activity/960-period import, five-scope variance sign-off, immutable report
publication and A4 PDF boundary.

This increment raises M8 from 25% to 40% and the evidence-weighted overall
position from 83% (78.4/94 hours) to 86% (80.6/94 hours). It does not claim that
automated browser checks replace native WKWebView inspection, a WCAG audit or
moderated user research.

## Controlled test architecture

- `playwright.config.ts` owns the production build/preview lifecycle and the
  four browser projects. Failure screenshots and video are retained; traces are
  produced only on the first retry.
- Each test uses Playwright's fresh browser context. The application's
  IndexedDB database and local-storage registers therefore begin empty for
  every journey and cannot leak between parallel tests.
- Locators use visible roles, labels and management language rather than CSS
  implementation selectors. Assertions wait on observable UI states; there are
  no fixed sleeps. An automatic diagnostic fixture fails every journey on an
  uncaught page exception or error-level browser-console message.
- `e2e/fixtures/controlled-schedule.csv` and
  `e2e/fixtures/controlled-performance.csv` are checked-in synthetic source
  files with exact SHA-256 values in `e2e/fixtures/SHA256SUMS`. They exercise
  the real CSV parser, validation worker or deterministic fallback, inferred
  first-project registry, atomic Dexie commit and active-data refresh.
- The compact pair deliberately contains one late source milestone and one
  performance period and runs in every desktop engine. One separate Chromium-
  only release journey uses the 60-activity/960-performance ASTER pack because
  it adds the distinct immutable-publication and inspected-PDF acceptance claim
  without repeating the heavier authoring workflow in every engine.

## Journey matrix

| Journey | Chromium | Firefox | WebKit | 390 px Chromium |
|---|---:|---:|---:|---:|
| Clean launch is input-first with no KPI demonstration data | Pass | Pass | Pass | — |
| All eight primary pages expose exactly three usage steps | Pass | Pass | Pass | — |
| CSV pair validates, registry is confirmed, generation commits and SPI/CPI reconcile | Pass | Pass | Pass | — |
| Imported milestone becomes a source-linked late exception with five missing controls, publication block and honest no-CPM dependency evidence | Pass | Pass | Pass | — |
| Full ASTER import, five-scope sign-off, immutable revision and four-page A4 PDF | Pass | — | — | — |
| All eight routes remain inside the 390 px viewport | — | — | — | Pass |
| Milestone editor and management-decision field remain reachable | — | — | — | Pass |

## Independent failure evidence

The first complete run produced 11 passes and three identical assertion
failures. The product correctly displayed the more precise phrases “5 fields
missing” and “Publication blocked”; the test had assumed “Recovery missing”.
The assertion was corrected to the actual control language, and the complete
matrix then passed 14/14 in 14.3 seconds. The final combined release gate
repeated all 14 journeys in 15.2 seconds after the progress and evidence updates.
After the runtime-error diagnostic fixture was added, all 14 passed again in
14.6 seconds with no uncaught page or error-level console output.
No product behaviour was weakened to make the gate pass.

## CI and local commands

The GitHub Actions workflow builds and runs the normal quality gate, installs
the pinned Playwright browser engines, executes all browser projects and uploads
the HTML report only on failure.

```bash
pnpm check
pnpm test:e2e
# or both:
pnpm check:release
```

## Remaining M8 gates

- Automated WCAG 2.2 scanning plus manual keyboard, zoom, forced-colour and
  screen-reader evidence.
- Manual release inspection in the packaged macOS WKWebView app; Playwright
  WebKit is useful engine coverage but is not the native host.
- Practical selected-publication print evidence in Firefox and the native host;
  Chromium full-ASTER PDF evidence is complete.
- Moderated import → review → report task research with recorded success and
  comprehension outcomes.
- Portfolio screenshots, architecture explanation, walkthrough and release
  retrospective.
