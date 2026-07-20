# M7 print/PDF provenance and layout evidence

**Evidence date:** 20 July 2026
**Implementation baseline:** `818b6c8` plus the M7 print-closure increment
**Decision:** ADR-0005

## Provenance boundary

The report root and document expose explicit `live` or `published` state. In
print media the live state hides the complete report and renders a single
message: **No approved revision selected**. A selected publication prints the
stored report, narrative, author, revision and timestamps. The same distinction
also controls the in-app Print button.

Regression coverage proves:

- live DOM state, disabled Print action and presence of the rejection notice;
- published DOM state, enabled Print action and immutable revision banner;
- locked narrative controls while a historical revision is displayed;
- literal rendering of hostile narrative without script, image or SVG-handler
  elements;
- field-wise narrative equality independent of object insertion order;
- one revision under double and triple concurrent publication attempts; and
- transaction rollback when the immutable-record `add` operation fails, leaving
  one draft and no partial publication.

## Persisted-publication PDF

The selected persisted **Project QA revision 1** was captured from the running
app's report document and printed from the same stylesheet with Headless Chrome
150. This is real locally imported project data, not the demonstration fallback
and not the full 60-activity ASTER evidence dataset.

| Check | Result |
|---|---|
| Page size | A4, 594.96 × 841.92 points |
| Page count | 3 |
| PDF structure | Tagged; no JavaScript; not encrypted |
| Render inspection | All three pages rendered to 150-DPI PNG |
| Clipping or overlap | None observed |
| Split headings | None observed |
| Blank trailing page | None |
| Long-text wrapping | Within the page content area |
| Page 1 | Revision, author, project, reporting date, baseline, source, headline, control result, movement, decisions and next-period focus |

Final local artifact:

`output/pdf/Project_Controls_Weekly_Report_Revision_1.pdf`

Inspection renders are kept under `tmp/pdfs/` during verification and are not
source-controlled.

## Live-preview rejection proof

The same document content was rendered under `data-print-state="live"`.
The resulting one-page A4 PDF contained only the print-blocked heading and
instructions. Automated text extraction asserted that it contained neither
`Project QA` nor `Publication controls passed`. The rendered page was visually
inspected and contained no management-report content.

## Full-ASTER publication journey

The Chromium release journey now exercises the complete evidence path rather
than mounting a prebuilt report:

1. creates the fixed synthetic ASTER schedule and performance files;
2. uploads both through the visible Import & Quality controls;
3. validates through the real isolated module worker;
4. confirms the inferred registry and atomically commits 60 schedule activities
   plus 960 performance rows;
5. supplies the fixed 8-milestone and 12-risk management-register fixture in
   the isolated test origin only;
6. completes and signs immutable variance-analysis revision 1 for the project
   and four breached work-package scopes;
7. saves and publishes weekly-report revision 1 through the visible controls;
   and
8. prints the selected persisted publication with Chromium's A4 PDF boundary.

This test-only setup does not change the production launch: a clean app remains
empty and ready for the user's own inputs.

| Check | Result |
|---|---|
| Imported records | 1,020 (60 schedule, 960 performance) |
| Reporting date | 14 June 2026 |
| Cumulative reconciliation | PV £1,500,000; EV £1,350,000; AC £1,440,000; SPI 0.900; CPI 0.938 |
| Signed variance coverage | Project, WP200, WP300, WP400 and WP500 |
| Management exceptions | 5 variance, 3 milestone and 5 owned actions |
| Publication state | Persisted immutable revision 1 selected before print |
| Page size and count | A4, 594.96 × 841.92 points; 4 pages |
| PDF structure | Tagged; no JavaScript; not encrypted |
| Text extraction | 8,693 characters; identity, author, source, control result and every report section present |
| Visual inspection | All four pages rendered at 144 DPI and inspected; no overlap, clipping, orphan heading, broken ID or blank trailing page |
| Application chrome | Sticky scope boundary excluded from print |
| SHA-256 | `ce16dc7995981f3fb538663817ea4940c9f64a6409093fa7751d3b2526f70d0e` |

Final local artifact:

`output/pdf/Project_Controls_Weekly_Report_Full_ASTER_Revision_1.pdf`

The print rules keep the detailed report inside the accepted 2–4-page target by
using print-only 9-point body type, 8-point tables, three forecast columns and a
four-column baseline reconciliation. No source or management evidence is
removed to reach the page limit.

## Remaining release evidence

- Complete practical Firefox print-preview and repeat the native
  AppKit/WKWebView preview with the full ASTER publication. A smaller but fully
  controlled native project has already proved live-content rejection, the
  report-button bridge, `Cmd+P`, and a visibly populated three-page A4 preview;
  see `docs/M8_NATIVE_RELEASE_INSPECTION.md`.
- Run the planned moderated report task and confirm users can reach the selected
  publication and print it in fewer than five actions.

These remaining items prevent a claim of complete M7 release closure; they do
not weaken the implemented live-versus-published provenance boundary or the
completed full-ASTER Chromium evidence.
