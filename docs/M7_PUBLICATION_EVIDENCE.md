# M7 immutable weekly-report publication evidence

**Evidence date:** 19 July 2026  
**Milestone assessment:** M7 75%  
**Overall evidence-weighted progress:** 76% (71.5 of 94 hours)

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
- A concurrent double-publish test proves that one draft can create only one
  published revision.
- Stored records are rechecked for identity, source fingerprint, timestamps and
  publication metadata when loaded.
- Import row garbage collection retains report records. Explicit full reset
  clears them and Settings reports the number of published revisions.

## Verification

- 250/250 Vitest tests pass across 40 files.
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

## Deliberate limits

- Formal two-to-four A4 page-count, page-break, clipping and cross-engine PDF
  approval remains open.
- Version-1 JSON backup remains active-generation-only and does not include
  management registers, variance records, report drafts or publications.
- Strict cross-tab atomicity for management-register edits awaits moving those
  localStorage registers behind a revisioned repository; active import changes
  are already compare-and-set protected.

## Collaboration note

Claude Code was invoked twice in read-only plan mode for the requested second
opinion. The local CLI was reachable but returned `Credit balance is too low`
both times, so no Claude findings were used and implementation did not wait.
The increment was independently reviewed against the existing invariants and
verified through tests plus the live journey above.
