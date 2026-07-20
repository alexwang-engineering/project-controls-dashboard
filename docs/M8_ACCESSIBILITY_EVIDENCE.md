# M8 automated accessibility evidence

**Evidence date:** 20 July 2026  
**Milestone:** M8 — Quality and portfolio release  
**Target:** WCAG 2.2 Level A/AA for the core local workflow  
**Decision:** Automated and keyboard/reflow increment complete; manual conformance evidence remains open

## Outcome

The release matrix now contains 24 isolated browser runs. Axe evaluates 16
states in each of Chromium, Firefox and WebKit: all eight clean input-first
routes plus the committed import receipt, active Overview, Schedule & Cost,
Risks, Changes, Weekly Report, Settings and the expanded imported-milestone
exception. That is 48 state scans against WCAG A/AA rule tags.

The same gate checks the skip link, visible keyboard focus, keyboard route
activation, 320 CSS pixel reflow with WCAG text-spacing overrides, all-route
390 × 844 layout, 24 × 24 CSS pixel authored control targets, reduced motion
and forced colours. Automated testing is deliberately not described as WCAG
conformance: Playwright's own guidance says many accessibility problems require
manual assessment and inclusive user testing.

Primary references:

- [WCAG 2.2 normative standard](https://www.w3.org/TR/WCAG22/)
- [W3C WCAG 2.2 Understanding documents](https://www.w3.org/WAI/WCAG22/Understanding/)
- [Playwright accessibility-testing guidance](https://playwright.dev/docs/accessibility-testing)

## Defects found and corrected

| Finding | Evidence | Correction |
|---|---|---|
| Muted top-bar and page-description text measured 4.01:1 and 4.46:1 | Axe `color-contrast`, serious | Darkened the shared muted token and reused it for build-progress detail |
| Inactive import-step labels measured 3.61:1 | Axe `color-contrast`, serious | Replaced the bespoke pale label colour with the corrected muted token |
| Recharts created a focusable SVG inside an `aria-hidden` chart | Axe `aria-hidden-focus`, serious | Disabled the chart accessibility layer; the adjacent semantic data table remains the authoritative alternative |
| TCPI explanatory text was an invalid direct child inside a definition-list group | Axe `definition-list`, serious | Moved each explanation inside its corresponding `<dd>` |
| Wide Overview and Schedule & Cost tables were not keyboard-scrollable in WebKit | Axe `scrollable-region-focusable`, serious | Added focusable, explicitly named regions around each detected wide table |
| First keyboard assertion could race the asynchronous empty-data boundary | Focus evidence | Wait for the stable setup-required heading before starting the Tab sequence |

No rule was disabled and no violation was baselined. Tests assert a literal
empty violation list with readable rule, impact, target and failure summary on
failure.

## Browser and interaction boundaries

- Chromium and Firefox perform the full first-Tab skip-link and sequential
  navigation assertion. Playwright WebKit on macOS follows Safari's system
  preference that omits links from Tab navigation, so it receives axe, active-
  state, reflow and control-flow checks but not a false keyboard expectation.
- The 320 CSS pixel run is the horizontal equivalent described by WCAG 1.4.10
  for 400% zoom from a 1280 CSS pixel starting width. It also injects the WCAG
  1.4.12 text-spacing values before testing every route for page overflow.
- The 390 px project checks authored buttons, selects, text fields and summary
  controls against the WCAG 2.2 24 × 24 CSS pixel minimum. Checkbox/radio
  inputs are excluded because their associated labels supply the pointer target.
- Error-level console messages and uncaught page exceptions fail every journey.

## Verification

```bash
pnpm check:release
```

The completed increment passes 305/305 Vitest tests, lint, strict application
and E2E type checks, production build and **24/24 Playwright runs in 32.2
seconds**. The Playwright result includes all 48 axe state scans.

## Open manual evidence

- VoiceOver reading order, names, state announcements and error recovery in the
  packaged macOS app.
- Complete keyboard-only import → review → report workflow in native WKWebView,
  including focus-not-obscured inspection.
- Manual contrast and information-without-colour review under macOS Increase
  Contrast and system high-contrast combinations.
- Browser zoom inspection at 200% and 400% in the actual packaged window.
- Moderated testing including participants with access needs where practicable.

Until those checks are complete, the app may say that its automated WCAG A/AA
gate passes; it must not claim WCAG 2.2 conformance.
