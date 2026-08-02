# Phase 2 — Control views and navigation evidence

Completed: 2 August 2026

## Delivered

- Global scope and controlled reporting date are reflected in the URL and restored on refresh or direct navigation.
- Safe page state is bookmarkable: milestone filters, risk basis and filters, schedule period and forecast scenario, pending-change view, selected record, and explicit edit mode.
- Five curated control views are versioned in source: Executive position, Overdue actions, Forecast threats, Pending decisions, and Data-quality exceptions.
- `Cmd/Ctrl+K` opens a scoped command surface for pages, control views, milestones, risks, and changes. Arrow keys, Enter, Escape, a contained Tab loop, and focus restoration are supported.
- Exact milestone, risk, and change links open a read-only inspection rail. A separate **Edit record** action is required before a governed form opens.
- Overview work-package performance and the risk register have configurable optional columns. Column choices are encoded in the URL.
- All route and column preferences are deliberately disposable, bookmarkable URL state. They are not governed project data and therefore are not added to backup/restore; the five curated views themselves are code-versioned.

## Motion and responsive behaviour

- Interaction durations use the shared 130 ms, 190 ms, and 260 ms motion tokens.
- Panels and dialogs animate with compositor-friendly transforms; audited values do not count up and large tables do not animate layout.
- `prefers-reduced-motion: reduce` removes non-essential transitions and animations.
- The inspection rail becomes a full-screen 390 px panel; the command surface becomes a bottom sheet.
- Command UI is portalled to `document.body` so fixed positioning is viewport-relative even though the sticky top bar uses backdrop filtering.

## First-principles boundary

- Navigation state can select or inspect a record, but it cannot mutate it.
- `mode=edit` only opens the existing governed editor; all validation, status-transition, revision, and persistence controls remain intact.
- Unknown or stale scope values fail closed to the full-project scope.
- Named views compose existing deterministic evidence rather than introducing opaque scoring or AI-generated management conclusions.

## Verification

`pnpm check:release` passed after implementation:

- dependency security audit: no known vulnerabilities;
- lint and strict TypeScript: passed;
- Vitest: 49 files, 336 tests passed;
- production build: passed;
- native review server: 4 tests passed;
- Playwright: 27 tests passed across Chromium, Firefox, WebKit, and a 390 px viewport.

The browser journey verifies imported milestone search, exact-record URL navigation, read-only inspection focus, and deliberate transition into edit mode. Manual in-app browser QA additionally verified desktop and 390 px command layouts, zero document-level horizontal overflow after transitions, correct autofocus, and no runtime warnings or errors.

## Next decision gate

Phase 3 remains unapproved. Calendar, CPM, schedule-quality scoring, and Gantt work require a separate design and implementation decision before development begins.
