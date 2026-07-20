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

## Remaining release evidence

- Repeat the 2–4-page check with the fixed full-ASTER project and its populated
  exception/action evidence.
- Complete practical Firefox and native AppKit/WKWebView print-preview checks.
- Run the planned moderated report task and confirm users can reach the selected
  publication and print it in fewer than five actions.

These remaining items prevent a claim of complete M7 release closure; they do
not weaken the implemented live-versus-published provenance boundary.
