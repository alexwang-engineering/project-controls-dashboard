# M7 immutable weekly-report publication evidence

**Evidence date:** 20 July 2026
**Milestone assessment:** M7 90%
**Overall evidence-weighted progress:** 78% (73.1 of 94 hours)

## Delivered outcome

The weekly-report page now separates the live calculated preview from approved
management evidence. A user edits the decision-focused narrative, saves one
draft against the current facts, explicitly confirms it, and publishes an
append-only revision. Print/PDF is disabled for the live preview and enabled
only when a persisted publication revision is selected.

Each draft and publication freezes:

- the active import ID and exact calculated report;
- current/cumulative EVM and all EAC sensitivities;
- original-to-active baseline reconciliation and change comparisons;
- all signed variance-analysis revisions loaded for the report context;
- the complete milestone, risk and change register inputs;
- editable management summary, decisions required, next-period focus and named
  author;
- generated, saved and published timestamps.

The canonical source fingerprint ignores only the report generation clock and
normalises source-array ordering. A changed source value changes the
fingerprint.

## Storage and safety evidence

- IndexedDB schema version 5 adds the indexed `reportPublications` store.
- Fingerprinting, narrative parsing and timestamp validation complete before
  the Dexie transaction.
- Draft save and publication compare the expected active import to the current
  pointer inside the transaction.
- Publication requires passed report controls, complete narrative and an exact
  current saved-draft match.
- Revision allocation, append-only insert and deletion of only the current
  draft occur in one Dexie transaction.
- Concurrent double- and triple-publish tests prove that one draft can create
  only one published revision.
- An injected failure of the immutable-record insert proves transaction rollback
  retains the draft and creates no partial publication.
- Stored records are rechecked for identity, source fingerprint, timestamps and
  publication metadata when loaded.
- Import row garbage collection retains report records. Explicit full reset
  clears them and Settings reports the number of published revisions.

## Verification

- 254/254 Vitest tests pass across 40 files.
- Oxlint passes with warnings denied.
- Strict TypeScript checking passes.
- The Vite production build passes.
- The signed AppKit/WebKit bundle passes `codesign --verify --deep --strict`.
- The native app owns a 1280 × 820 window and private localhost server.

## Live journey

A clean browser origin was exercised through the real interface:

1. Imported one controlled schedule row plus one matching performance row.
2. Validated 2/2 accepted rows with 0 blockers and 0 warnings in the module
   worker.
3. Confirmed the first-project registry and atomically committed import
   `IMPORT-20260719231350-85A665D6`.
4. Confirmed SPI 1.000, CPI 1.000, BAC £100,000, and publication controls
   passed without fabricated management data.
5. Entered a named report author, saved the source-bound draft, confirmed it,
   and published immutable revision 1.
6. Reloaded the page and confirmed the publication history and enabled
   snapshot-only print action persisted.
7. Checked the default desktop layout and a 390 × 844 viewport; neither had
   horizontal page overflow.

## Print/PDF closure evidence

- Live and published states are explicit DOM contracts shared by the control and
  print stylesheet.
- Cmd/Ctrl+P on a live preview prints one rejection notice and no report body.
- A selected persisted Project QA revision produced a tagged three-page A4 PDF.
- All three 150-DPI page renders were inspected with no clipping, overlap, split
  heading or blank trailing page.
- Exact page and provenance evidence is recorded in
  [`M7_PRINT_EVIDENCE.md`](M7_PRINT_EVIDENCE.md).

## Deliberate limits

- The fixed full-ASTER PDF, practical Firefox and native WKWebView print checks,
  and the fewer-than-five-actions moderated usability check remain open.
- Version-1 JSON backup remains active-generation-only and does not include
  management registers, variance records, report drafts or publications.
- Strict cross-tab atomicity for management-register edits awaits moving those
  localStorage registers behind a revisioned repository; active import changes
  are already compare-and-set protected.

## Collaboration note

Claude's independent review approved the immutable publication baseline and
identified the operating-system print provenance gap. ADR-0005 and the print
closure tests address that finding. The implementation remains subject to the
final independent print-closure diff review.
