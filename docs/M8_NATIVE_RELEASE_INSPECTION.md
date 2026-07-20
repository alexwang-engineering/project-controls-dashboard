# M8 native WKWebView release inspection

**Inspection date:** 20 July 2026

**Artifact:** `/Users/wjl/Desktop/Project Controls Dashboard.app`

**Decision:** Native route, keyboard and file-validation recovery checks passed;
assistive-technology, register-editing and native print approval remain open

## Outcome

The signed macOS application was rebuilt from the security-baseline checkout,
opened as a standalone AppKit/WebKit window and inspected through macOS's live
accessibility interface. All eight primary routes loaded inside the app rather
than an external browser. Each exposed its level-one heading, page guide,
setup/input state and authored controls in the accessibility tree.

The clean native origin remained input-first: it showed no active project, no
demonstration KPI region and no substituted schedule/cost performance. The
visible delivery position now reconciles to **92% — 86.4 of 94 evidence-
weighted hours** after the native input recovery was completed and the bundle
was rebuilt.

This is useful native evidence, but it is not described as a VoiceOver test or
a WCAG-conformance result.

## Artifact integrity and server boundary

Before the UI task, the following checks passed:

```bash
codesign --verify --deep --strict \
  '/Users/wjl/Desktop/Project Controls Dashboard.app'

diff -qr dist \
  '/Users/wjl/Applications/Project Controls Dashboard.app/Contents/Resources/web'
```

- The Desktop item is a symlink to the signed canonical bundle under the user's
  Applications folder.
- `diff -qr` returned no output: packaged web assets exactly matched `dist/`.
- The packaged and repository copies of `review_server.py` had the same
  SHA-256 digest before launch.
- The live root returned HTTP 200 with CSP, same-origin opener/resource,
  permissions, no-referrer, nosniff, frame-deny and no-store headers.
- Live HEAD requests to `/assets/` and encoded `../review_server.py` paths both
  returned HTTP 404.

## Native route matrix

| Route | Native level-one heading | Input-first evidence exposed |
|---|---|---|
| `/` | Project overview | Setup-required status, import CTA, no KPI region |
| `/import` | Import and data quality | Four-step import progress, two named file inputs, disabled validate button |
| `/schedule-cost` | Schedule and cost | No calculated figures; explicit import requirement |
| `/milestones` | Milestone control | Empty controlled register, derived-status guidance, named filters |
| `/risks` | Risk exposure | Named filters and an accessible 5 × 5 residual-risk table |
| `/changes` | Change control | Empty decision register and immutable-baseline guidance |
| `/report` | Weekly management report | No placeholder report; active import explicitly required |
| `/settings` | Settings and data | Local storage health, disabled backup/restore actions and guarded reset |

Every route also exposed the primary navigation, current-project boundary,
delivery progress and “How to use this page” region.

## Keyboard path exercised

WKWebView followed the user's macOS/Safari link-focus setting:

1. Plain `Tab` remained on the HTML content area; this matches the platform
   setting in which links are omitted from the ordinary Tab sequence.
2. `Option+Tab` moved focus to **Skip to main content**.
3. `Return` changed the URL fragment to `#main-content` and moved the native
   accessibility focus to the main content container.
4. The next `Option+Tab` reached **Open data input**.
5. `Return` opened `/import`, where the native tree exposed both named file
   upload buttons and the disabled **Validate both files** control.

This confirms the same platform-specific keyboard behaviour already accounted
for in the WebKit Playwright matrix. It does not remove the need to test with
VoiceOver running.

## Semantic observations

- The app window, embedded web area and URL were identifiable to the macOS
  accessibility API.
- Primary navigation was exposed as a named container with eight links.
- Headings preserved their levels and routes exposed one level-one heading.
- Progress used a native-accessible progress indicator with its numeric value.
- File inputs were exposed as file-upload buttons with adjacent names/help.
- The risk heatmap was exposed as a named table, with probability/impact cells
  and selectable toggle buttons rather than colour-only rectangles.
- Destructive reset remained disabled until its explicit acknowledgement
  checkbox is selected.

## Native CSV selection and recovery

The initial inspection exposed a genuine native-host defect: the Swift host
declared `WKUIDelegate` but did not implement WebKit's open-panel callback.
Activating **Choose File** focused the control but could not open an `NSOpenPanel`.

The host now implements `runOpenPanelWith`, maps WebKit's multiple-selection and
directory parameters, resolves aliases, constrains selectable content to
`UTType.commaSeparatedText`, and always completes with chosen URLs or `nil` on
cancel. A dedicated `macos-latest` CI job now type-checks this AppKit/WebKit
source with warnings as errors and validates the app metadata; its first remote
result remains pending until GitHub runs the workflow. The rebuilt bundle
passed strict signature verification before the
following task was run in the actual AppKit/WKWebView window:

1. Opened Import & Quality and activated the Schedule CSV control.
2. Confirmed a real macOS **Open** sheet appeared with CSV documents selectable.
3. Selected the checksum-pinned `schedule-unclosed-quote.csv` and the valid
   `controlled-performance.csv`.
4. Validated through the isolated module worker in 73 ms. The result displayed
   **Blocking issues must be corrected**, 0 accepted rows, 5 blocking issues,
   `csv_missingquotes`, **Quoted field unterminated**, and corrective guidance.
   It also stated **No data has been written** and kept Commit disabled.
5. Reopened the same native picker, replaced the malformed schedule with
   `controlled-schedule.csv`, and validated again.
6. Recovery completed through the isolated module worker in 55 ms with 2 source
   rows, 2 accepted rows, 0 blocking issues, 0 warnings and reporting date
   12 April 2026. The first-project registry remained unconfirmed, so no rows
   were committed.
7. Reloaded the route. Both file inputs returned to **no file selected**, the
   native origin still had no active project, and the app was left ready for
   the user's own input.

This closes the native file-selection and malformed-file recovery item without
altering the input-first product boundary.

## Actions deliberately not performed

- No fixture was committed into the clean review origin; the validated recovery
  candidate was deliberately left unconfirmed and the route was reloaded.
- Reset was not enabled or activated.
- Persistence permission was not requested.
- No backup was downloaded.
- Print was not invoked from the empty input-first report state.

## Remaining native release gate

- Run VoiceOver through launch, page landmarks, form names/help, validation
  errors, live import status, milestone recovery and report-publication state.
- Confirm keyboard-only register editing and error recovery with the user's
  actual macOS keyboard-navigation settings documented.
- Inspect a selected immutable full-ASTER publication through the native print
  dialog and exported PDF; verify that live-preview printing remains rejected.
- Repeat at enlarged macOS display/text settings and with system contrast
  options where practicable.

Until those tasks pass, this document supports a **native route, semantic,
keyboard and file-validation recovery check**, not complete native approval.

## Post-inspection release gate

After recording the earlier 70% M8 position, `pnpm check:release` passed the dependency
audit, lint, strict type checking, 305/305 Vitest tests, production build, 4/4
native-server tests and 25/25 Playwright runs. The final browser matrix for this
increment completed in 47.9 seconds with the runtime/external-network diagnostic
enabled.

After the file-panel correction and 75% M8 update, the native host passed local
Swift type-checking with warnings as errors, app metadata validation and a full
signed package build. The final `pnpm check:release` passed the dependency audit,
lint, strict type checking, 305/305 Vitest tests, production build, 4/4 native-
server tests and **26/26 Playwright runs in 31.9 seconds**.
