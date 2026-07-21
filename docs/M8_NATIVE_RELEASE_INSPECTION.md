# M8 native WKWebView release inspection

**Inspection date:** 20–21 July 2026

**Artifact:** `$HOME/Desktop/Project Controls Dashboard.app`

**Decision:** Native route, keyboard register editing, file-validation recovery
and immutable-publication print checks passed; practical Firefox full-ASTER
printing also passed, while assistive-technology and the
full-ASTER native print repetition remain open

## Outcome

The signed macOS application was rebuilt from the security-baseline checkout,
opened as a standalone AppKit/WebKit window and inspected through macOS's live
accessibility interface. All eight primary routes loaded inside the app rather
than an external browser. Each exposed its level-one heading, page guide,
setup/input state and authored controls in the accessibility tree.

The clean native origin remained input-first: it showed no active project, no
demonstration KPI region and no substituted schedule/cost performance. The
visible delivery position now reconciles to **94% — 87.9 of 94 evidence-
weighted hours** after native input recovery, fail-closed publication printing,
cold-launch hardening and keyboard-only register recovery were evidenced.

This is useful native evidence, but it is not described as a VoiceOver test or
a WCAG-conformance result.

## Artifact integrity and server boundary

Before the UI task, the following checks passed:

```bash
codesign --verify --deep --strict \
  "$HOME/Desktop/Project Controls Dashboard.app"

diff -qr dist \
  "$HOME/Applications/Project Controls Dashboard.app/Contents/Resources/web"
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

## Actions deliberately not performed during the file-recovery task

- No fixture was committed into the clean review origin; the validated recovery
  candidate was deliberately left unconfirmed and the route was reloaded.
- Reset was not enabled or activated.
- Persistence permission was not requested.
- No backup was downloaded.
- Print was not invoked from the empty input-first report state during that
  task; the separate controlled print task below later proved both rejection
  and approved-publication paths.

## Native immutable-publication print boundary

The original AppKit host had no File menu print command, so `Cmd+P` did
nothing. The host now exposes **File → Print Selected Publication…** and
injects a main-frame-only bridge for the report page's `window.print()` action.
Both routes enter one native preflight. The preflight accepts only a DOM with
`data-print-state="published"`; every live draft, setup screen and unrelated
page fails closed in an `NSAlert` before an `NSPrintOperation` is created.

The implementation uses WebKit's documented
[`printOperation(with:)`](https://developer.apple.com/documentation/webkit/wkwebview/printoperation%28with%3A%29)
API. Practical inspection found that leaving the returned `WKPrintingView`
frame uninitialised produced three syntactically valid but blank A4 pages on
the current macOS build. That rejected output was moved to the temporary test
area and was not treated as evidence. The host now sets the print view to the
paper size, disables centring, retains automatic vertical/fit horizontal
pagination and runs the operation modally. This is consistent with the
zero-frame/blank-output symptoms reported for current WebKit printing in the
[Apple Developer Forums](https://developer.apple.com/forums/topics/safari-and-web-topic?open-dropdown=true&sortBy=replies&sortOrder=desc).

The corrected, signed application then passed this real UI task:

1. `Cmd+P` on the clean Overview showed **Print blocked** and stated that an
   immutable published revision must be selected.
2. Through native CSV panels, the controlled E2E schedule/performance pair was
   validated in the isolated worker and atomically committed.
3. Its imported milestone was linked, completed and saved; project and WP100
   variance-analysis revisions were completed and signed.
4. Weekly-report revision 1 was saved, confirmed and published through the
   native UI. The selected record showed **Published revision 1**, author Alex
   Wang, source import ID, and **Publication controls passed**.
5. The in-app **Print selected publication** button opened the macOS print
   dialog through the injected bridge. The preview visibly contained three A4
   report pages rather than blank sheets.
6. After cancelling, `Cmd+P` opened the same visible three-page preview through
   the File-menu path.
7. The synthetic native test generation, milestone, variance revisions and
   publication were then removed through the app's acknowledged reset control.
   The final state reported 0 activities, 0 performance rows and **The app is
   ready for new input**.

This proves the native fail-closed preflight, the JavaScript-to-native button
bridge, the menu shortcut and populated WebKit print preview. It does not yet
replace the four-page full-ASTER Chromium PDF evidence or claim that a physical
printer was used.

## Cold-launch readiness correction

A post-package smoke check caught a blank WKWebView that recovered only after
**View → Reload**. The production assets and loopback server were healthy; the
host still relied on a fixed 450 ms delay before its first navigation. That
timing assumption was removed. The host now probes the exact loopback root and
loads the interface only after an HTTP 200 response, retrying at 200 ms
intervals for a bounded five-second window and showing an explicit launch
failure if the process exits or never becomes ready.

The signed app was then quit completely, its host and Python server exits were
confirmed, it was rebuilt, and it cold-launched directly to the clean input-
first Overview without a reload. The accessible tree exposed the eight routes,
**No project loaded**, **Setup required**, the three-step page guide and **93%
— 87.2 / 94 weighted hours**. A screenshot was visually checked against that
tree.

## Keyboard-only register editing and error recovery

A temporary controlled E2E project was imported to provide the WP100 registry
needed by the risk form. The schedule picker, import navigation, validation and
commit were operated with Option+Tab/Return. During setup only, macOS's second
**Go to** path field stopped honouring Command+A; its path value and the registry
checkbox were corrected through the accessibility action. Those two setup
actions are not counted as keyboard-only register evidence.

Inside the risk register, no pointer or direct accessibility value action was
used:

1. Option+Tab reached **Add risk** and Return opened the complete editor.
2. The tab sequence accepted `R-KBD-001`, title, WP100, owner, category, the
   cause-event-effect statement, six score controls, treatment, three complete
   dates, early-warning trigger, key control, owner and evidence.
3. Return on **Save risk** persisted the record. The live tree announced
   **Risk R-KBD-001 saved**, the summary changed to one risk, the heatmap cell
   reported one risk, and the register row showed Low, Stable, Clear, Within
   Tolerance and 31 Jul 2026.
4. Option+Tab traversed the five filters and all 25 heatmap buttons to
   **Edit R-KBD-001**. The title was replaced and Return submitted the edit;
   the updated title appeared in both the exception and register row.
5. The edit was reopened, its selected required title was cleared, and Return
   was pressed. WebKit blocked submission, focused the title and visibly showed
   **Fill out this field**. Typing a recovered title and pressing Return saved
   it, proving keyboard-only native error recovery rather than only happy-path
   entry.

This closes the native register-editing item for the user's current macOS link-
focus setting. It is not a VoiceOver result. The temporary project and risk are
awaiting the separately confirmed destructive reset so the origin can be
returned to input-first state.

## Post-inspection release-gate reconciliation

The first post-inspection release run exposed test-host contention rather than
product failures: four unrelated Vitest UI tests crossed their five-second
limit only under file-level parallelism, while each passed in the focused
reproduction. The full-ASTER restore rollback invariant also exceeded its old
15-second test ceiling on the loaded host, completing successfully in about 21
seconds. The evidence was kept at 1,020 rows; its ceiling was raised to 30
seconds rather than replacing it with a smaller fixture.

Vitest files now run serially and Playwright uses the same two-worker discipline
locally and in CI, with tests in a file kept sequential. After correcting the
input-first progress assertion from 93% to 94%, one uninterrupted
`pnpm check:release` passed on 21 July 2026:

- dependency audit: no known vulnerabilities;
- lint and strict application/E2E type checking: passed;
- Vitest: **305/305** tests in 45 files, 48.27 seconds;
- production build: passed;
- native private-server tests: **4/4** passed;
- Playwright: **27/27** journeys across Chromium, Firefox, WebKit and the 390px
  mobile profile, 57.4 seconds.

## Practical Firefox full-ASTER print evidence

A headed Firefox Nightly run repeated the real 60-activity/960-performance-row
import, management-register seeding, five variance sign-offs and immutable
revision publication. `Cmd+P` opened the browser's own preview with four A4
sheets. Page-by-page inspection caught and rejected both a split milestone card
and a Firefox/Quartz black header produced by the layered screen gradient.

Print-only compact milestone evidence and a solid pale header resolved those
engine defects. The accepted PDF has four A4 pages, no JavaScript or encryption,
and was rendered at 144 DPI for inspection of every page. Its SHA-256 is
`8717c5dabb8128d09cbdcdbb145fba00dc600dc02d41964a81bb1ec630296a40`.
This closes practical Firefox printing; it does not replace the remaining
full-ASTER native WKWebView repetition.

## Remaining native release gate

- Run VoiceOver through launch, page landmarks, form names/help, validation
  errors, live import status, milestone recovery and report-publication state.
- Repeat the selected-publication native preview with the full ASTER data pack
  and retain the exported native PDF; live/non-report rejection is already
  verified.
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

After the native print correction and 80% M8 update, the Swift host again
passed type-checking with warnings as errors and the signed bundle was rebuilt
from the exact production assets. The first release-gate run correctly caught
one documentation/test expectation rounded to 87.1 hours while the calculation
produced 87.2. After correcting that bookkeeping value, `pnpm check:release`
passed the dependency audit, lint, strict type checking, **305/305 Vitest
tests**, production build, **4/4 native-server tests** and **26/26 Playwright
runs in 33.7 seconds**.

After the immutable-narrative display and cold-launch readiness corrections,
`pnpm check:release` again passed the dependency audit, lint, strict type
checking, **305/305 Vitest tests**, production build, **4/4 native-server
tests** and **26/26 Playwright runs in 40.2 seconds**. The Swift host separately
passed warnings-as-errors type checking before the final signed cold-launch
inspection.
