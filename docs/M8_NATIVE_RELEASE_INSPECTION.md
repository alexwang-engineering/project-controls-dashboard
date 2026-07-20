# M8 native WKWebView release inspection

**Inspection date:** 20 July 2026

**Artifact:** `/Users/wjl/Desktop/Project Controls Dashboard.app`

**Decision:** Native route and keyboard smoke check passed; assistive-technology
and native input/print approval remain open

## Outcome

The signed macOS application was rebuilt from the security-baseline checkout,
opened as a standalone AppKit/WebKit window and inspected through macOS's live
accessibility interface. All eight primary routes loaded inside the app rather
than an external browser. Each exposed its level-one heading, page guide,
setup/input state and authored controls in the accessibility tree.

The clean native origin remained input-first: it showed no active project, no
demonstration KPI region and no substituted schedule/cost performance. The
visible delivery position reconciles to **91% — 85.1 of 94 evidence-weighted
hours** after this inspection was recorded and the bundle was rebuilt.

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

## Actions deliberately not performed

- No synthetic fixture was imported into the clean review origin; the artifact
  remains ready for the user's own input.
- Reset was not enabled or activated.
- Persistence permission was not requested.
- No backup was downloaded and no file-picker choice was made.
- Print was not invoked from the empty input-first report state.

## Remaining native release gate

- Run VoiceOver through launch, page landmarks, form names/help, validation
  errors, live import status, milestone recovery and report-publication state.
- Use the native file picker to exercise valid input plus at least one malformed
  CSV correction journey, preserving the clean review artifact afterward.
- Confirm keyboard-only register editing and error recovery with the user's
  actual macOS keyboard-navigation settings documented.
- Inspect a selected immutable full-ASTER publication through the native print
  dialog and exported PDF; verify that live-preview printing remains rejected.
- Repeat at enlarged macOS display/text settings and with system contrast
  options where practicable.

Until those tasks pass, this document supports only a **native route, semantic
and keyboard smoke check**.

## Post-inspection release gate

After recording the 70% M8 position, `pnpm check:release` passed the dependency
audit, lint, strict type checking, 305/305 Vitest tests, production build, 4/4
native-server tests and 25/25 Playwright runs. The final browser matrix for this
increment completed in 47.9 seconds with the runtime/external-network diagnostic
enabled.
