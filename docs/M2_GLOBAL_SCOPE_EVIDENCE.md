# M2 global work-package scope evidence

**Assessment date:** 20 July 2026
**Increment:** Global scope consistency across management views

## Delivered behavior

- A single shared work-package selector is shown above Overview, Schedule &
  Cost, Milestones, Risks and Changes.
- The selected scope persists while navigating between those views and can be
  cleared in one place.
- Overview recalculates BAC, PV, EV, AC, SV, CV, SPI, CPI, completion, EAC,
  TCPI and finish variance for the selected package. Its cumulative curve,
  work-package table and milestone/risk/change exceptions use the same scope.
- Schedule & Cost uses the same selection for periodic and cumulative values,
  EAC scenarios, variance-analysis identity and activity evidence.
- Milestone, risk and change summaries and registers show only matching records.
  New register entries default to the selected work-package ID while remaining
  editable before save.
- Risk owner/category/rating/heatmap filters reset when the global work package
  changes, preventing a valid new scope from appearing empty because of stale
  secondary filters.
- A saved scope that is absent from a replacement import is reset to the full
  project with an accessible live-region announcement.

## Controlled full-project boundaries

The weekly management report deliberately ignores the view scope. The selector
is replaced there by a locked **Full project** notice, and any selected package
is described as paused until the user returns to a management view. This avoids
presenting a filtered snapshot as a complete weekly publication.

The Changes page scopes register summaries and rows, but original-to-current
baseline reconciliation always consumes all change requests and all retained
generation evidence. The page states this boundary beside the reconciliation.

## Automated evidence

- Domain tests reproduce WP300 cumulative P16 values and verify that an invalid
  scope falls back to the complete trend.
- The application journey selects WP300, checks scoped Overview SPI/CPI, moves
  through Schedule & Cost, Milestones, Risks and Changes, and proves unrelated
  WP rows are absent.
- The same journey proves Weekly Report has no scope selector and displays the
  full-project publication boundary.
- A stale-scope regression proves an unknown work package is repaired and
  announced rather than producing an empty or misleading dashboard.
- A Risks-page regression changes the global scope while secondary filters are
  active and proves those filters reset before the new package is shown.

## Independent design input

Hermes was used read-only before implementation. Its useful recommendation was
to treat the scope as one application-level state, show it only on views that
genuinely honour it, and make the report/baseline exceptions explicit. The
implementation and tests were independently checked in this repository rather
than accepted from the review without verification.

After implementation, Hermes performed a second read-only diff review and
returned **PASS** with no blocking or important findings. The pre/post binary
diff checksum was identical, proving the reviewer changed no repository file.
The local Claude CLI was also invited to review but returned `Credit balance is
too low`; no Claude opinion is claimed for this increment.

The implementing review then identified one case not raised by Hermes—stale
Risks-page secondary filters after an in-page global-scope change—and added the
reset behavior and regression described above before the final gate.

## Visual and production-build evidence

- The production bundle opened on a clean origin with the input-first
  setup-required state and no browser console warning or error.
- The global bar was inspected at 1,440 × 900 and 390 × 844. At both sizes the
  document width equalled the viewport width, so the new sticky/stacked control
  introduced no page-level horizontal overflow.
- A real selected work package was retained through client-side navigation from
  Overview to Schedule & Cost, where the page showed the matching owner and
  scope. Navigating to Weekly Report removed the selector and displayed the
  paused-scope/full-project boundary.

## Remaining M2 work

M2 is assessed at 90%. The remaining gate is a moderated comprehension study
and browser error-state evidence, not another calculation or filtering feature.

## Final quality gate

- 42 test files and 279 tests pass.
- Lint, strict TypeScript checking, production build and `git diff --check`
  pass.
- The signed AppKit/WebKit bundle verifies at its installed path and launches
  with its app-owned `review_server.py` child process.
