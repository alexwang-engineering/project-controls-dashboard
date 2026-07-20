# ADR-0005 — Immutable HTML print and PDF boundary

**Status:** Accepted
**Date:** 20 July 2026
**Decision owner:** Project Controls Dashboard

## Context

ADR-0004 made a persisted weekly-report revision the publication boundary, but
the operating-system print command could still bypass the disabled in-app
button and render the recalculated live preview. That output carried the same
control-passed treatment as a publication and could be mistaken for approved
management evidence.

The report is already semantic, tabular HTML. Maintaining a second runtime PDF
renderer would duplicate layout, weaken accessibility and create a new route
for the stored narrative and calculated facts to drift.

## Decision

1. Accessible HTML remains the authoritative weekly report.
2. Runtime print/PDF continues to use `window.print()` and a dedicated A4 print
   stylesheet; no PDF library is added to the production bundle.
3. The report root carries an explicit `live` or `published` print state. Only
   a selected persisted publication may render the report document in print
   media.
4. Printing the live state renders one unambiguous rejection notice and hides
   the complete recalculated report. The in-app Print button remains disabled
   in the same state.
5. A historical publication locks the live narrative controls and explains
   that the user must return to the current live draft to prepare another
   revision.
6. PDF files used for release evidence are secondary artifacts generated from
   the same selected publication HTML. They do not create or alter a report
   revision.
7. A full-ASTER page-count check and practical Firefox and native WKWebView
   print checks remain release evidence, not inferred guarantees.

## Consequences

- Cmd/Ctrl+P can no longer turn mutable live facts into an approved-looking
  report.
- The stored report, narrative, author and timestamps remain the sole printable
  management record.
- Screen-reader users retain the authoritative HTML rather than receiving a
  PDF-only workflow.
- Page layout can vary modestly by browser engine. The fixed evidence dataset
  must therefore be rendered and inspected in each release browser rather than
  hidden behind a runtime PDF dependency.
