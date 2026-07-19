# Project Controls Dashboard data dictionary

**Contract version:** M1 / schema version 1 draft

**Local database schema:** Version 2 (adds revisioned project-configuration history)

**Status date:** 18 July 2026

**Authority:** Master Plan Version 1.1 and ADR-0002

## Boundary conventions

All imported cells enter the schema layer as strings. Parsing never performs
dynamic typing. A row becomes a domain record only after its entire Zod schema
and its row-level refinements pass.

Field parsing and row-level cross-field refinement are deliberately staged. If a
row contains both an invalid scalar and a cross-field violation, the scalar
issue blocks the first preview; cross-field issues are evaluated after the
scalar is corrected. The import never accepts the row between those passes.

| Convention | Definition |
|---|---|
| CSV dialect | Comma-delimited RFC-compatible CSV; quoted commas, doubled quotes, and quoted CR/LF are supported |
| Record identity | One-based CSV record number; header is record 1, first data record is record 2 |
| Physical line | Optional enrichment only; omitted whenever the record scanner and CSV parser do not agree exactly |
| Empty optional value | Empty string |
| Identifier | Uppercase letters, digits, and internal hyphens; leading zeros remain significant strings |
| Date | Real calendar date in exact `YYYY-MM-DD` form |
| Money | Pounds in the CSV; converted once to branded integer pence without floating-point parsing |
| Boolean | Exact lowercase `true` or `false` |
| Percentage | Ordinary decimal notation from 0 through 100; scientific notation is rejected |
| Global limits | 5 MiB per file, 10,000 data records per file, 1,000 JavaScript UTF-16 code units per cell |
| Free text | Kept as inert text; never interpreted as markup, URL, script, or formula |
| Untrusted export text | Leading `=`, `+`, `-`, `@`, tab, CR, or LF is apostrophe-neutralised before RFC quoting |
| Trusted export scalar | May bypass formula neutralisation only through an explicit per-column trust declaration; RFC quoting still applies |

JavaScript string length counts UTF-16 code units. Many emoji therefore count as
two units for M1 length limits. This rule is deterministic and is covered by the
global import limit rather than grapheme-cluster counting.

## `schedule.csv`

The required header is an exact, duplicate-free set. Order is not significant.

| CSV column | Normalised field | Required | Rule |
|---|---|---:|---|
| `project_id` | `projectId: ProjectId` | Yes | Identifier; matches configured project and every imported file |
| `baseline_version` | `baselineVersion: BaselineVersion` | Yes | Identifier; one version across the candidate pair |
| `activity_id` | `activityId: ActivityId` | Yes | Identifier; unique within candidate baseline |
| `wbs_id` | `wbsId: WorkPackageId` | Yes | Identifier; member of proposed first-import or active work-package registry |
| `activity_name` | `activityName` | Yes | 3–120 UTF-16 code units |
| `owner` | `owner` | Yes | 2–80 UTF-16 code units |
| `baseline_start` | `baselineStart: IsoDate` | Yes | On or before baseline finish |
| `baseline_finish` | `baselineFinish: IsoDate` | Yes | On or after baseline start |
| `forecast_start` | `forecastStart: IsoDate` | Yes | On or before forecast finish |
| `forecast_finish` | `forecastFinish: IsoDate` | Yes | On or after forecast start |
| `actual_start` | `actualStart?: IsoDate` | No | Cannot be after the candidate data date |
| `actual_finish` | `actualFinish?: IsoDate` | No | Requires actual start; on/after actual start; cannot be after data date |
| `predecessor_links` | `predecessorLinks[]` | No | Semicolon-separated relationship grammar described below |
| `calendar_id` | `calendarId: CalendarId` | Yes | Identifier; member of proposed or active calendar allowlist |
| `constraint_type` | `constraintType` | No | Blank normalises to `none`; allowed values listed below |
| `constraint_date` | `constraintDate?: IsoDate` | Conditional | Present if and only if constraint type is not `none` |
| `is_milestone` | `isMilestone` | Yes | Boolean; baseline and forecast start/finish pairs must each have zero duration |
| `baseline_budget` | `baselineBudget: Pence` | Yes | Zero or positive money |
| `progress_method` | `progressMethod` | Yes | Exact value `percent_complete` in M1 |
| `commentary` | `commentary` | No | Maximum 500 UTF-16 code units |

Allowed constraint types are `none`, `start-no-earlier-than`,
`finish-no-later-than`, `must-start-on`, and `must-finish-on`.

### Predecessor relationship grammar

Each link is `ACTIVITY_ID|TYPE|LAG_DAYS`; multiple links are separated by a
semicolon. `TYPE` is `FS`, `SS`, `FF`, or `SF`. Lag is a signed safe integer.
Empty segments, extra/missing parts, trailing semicolons, non-integer lag, and
unknown link types block the row. Negative lag and lag above five working days
are accepted with warnings. Self-links, missing activity references, and cycles
are blocking graph issues.

## `performance.csv`

Values are periodic, never cumulative. The required header is an exact,
duplicate-free set and order is not significant.

| CSV column | Normalised field | Required | Rule |
|---|---|---:|---|
| `project_id` | `projectId: ProjectId` | Yes | Matches project configuration and schedule |
| `baseline_version` | `baselineVersion: BaselineVersion` | Yes | Matches the candidate schedule baseline |
| `period_end` | `periodEnd: IsoDate` | Yes | Weekly reporting-period date |
| `activity_id` | `activityId: ActivityId` | Yes | Exists in accepted candidate schedule |
| `pv_period` | `pvPeriod: Pence` | Yes | Zero or positive periodic planned value |
| `ev_period` | `evPeriod: Pence` | Yes | Zero or positive periodic earned value |
| `ac_period` | `acPeriod: Pence` | Yes | Zero or positive periodic actual cost |
| `physical_percent_complete` | `physicalPercentComplete` | Yes | Decimal from 0 through 100 |
| `remaining_cost_forecast` | `remainingCostForecast?: Pence` | No | Zero or positive money |
| `progress_commentary` | `progressCommentary` | No | Maximum 500 UTF-16 code units |

The composite `(activity_id, period_end)` key is unique. Cumulative EV by
activity cannot exceed that activity's baseline budget. The sorted set of
distinct project periods defines the reporting calendar; a gap other than seven
calendar days is a warning. Its latest date is the deterministic import data
date used to validate actual dates.

## Project configuration input

Candidate validation receives configuration explicitly and never queries active
row data. The input contains:

| Field | Meaning |
|---|---|
| `source` | `proposed` for a first import or `active` for later imports |
| `projectId` | Authoritative project identity |
| `workPackageIds` | Confirmed registry membership set |
| `calendarIds` | Confirmed calendar identity allowlist |
| `authorisedStartActivityIds` | Activities exempt from the open-start warning |
| `authorisedFinishActivityIds` | Activities exempt from the open-finish warning |

First-import discovery only produces a proposal. Declining confirmation returns
no configuration. The repository increment must persist a confirmed proposal in
the same transaction as the generation and must write nothing after a decline.

That repository contract is now implemented: a first successful commit converts
the confirmed proposal to an active configuration in the same transaction as
the rows and manifest. Later commits accept only an exact active-registry input;
they cannot update registry membership as a side effect.

A later candidate may separately propose identifiers not present in the active
registry. M1 updates are additive only: the user sees the exact work-package,
calendar and authorised-endpoint additions, confirms a new revision, and then
the files are revalidated. The update transaction compares both the active
generation and registry revision before writing. It never changes the active
dataset pointer, and every accepted revision is retained in
`projectConfigurationHistory`. Removal and silent import-time mutation are
forbidden.

## Worker execution boundary

The browser sends original file bytes and the explicit active configuration to
a versioned Vite module worker. That worker performs checksums, parsing, row
normalisation, cross-file validation and graph analysis through
`processImportFiles`. If module workers are unavailable or fail, the interface
labels the fallback and calls that same pure processor; there is no second
validation implementation. Tests assert structurally identical worker and
fallback results. All worker responses complete before a repository transaction
can open.

## Import preview and quarantine

Quarantine decisions are ordered, explicit records containing file name, record
number, blocking reason code, and rationale. The orchestrator validates each
decision against the current preview before applying it, then re-runs all later
stages. This makes dependent errors visible without silent cascading. A valid
row cannot be quarantined under an invented reason.

For each file:

```text
sourceRows = acceptedRows + blockedRows
quarantinedRows <= blockedRows
```

On a committable preview, every remaining blocked row is explicitly quarantined.
The immutable manifest stores both per-file and total counts, and the detailed
quarantine list must reconcile with those totals.

## Generation storage

Every successful import is an immutable generation keyed by `importId`.

| Store | Primary key / purpose |
|---|---|
| `meta` | `key`; contains schema version and the single `activeImportId` pointer |
| `manifests` | `importId`; immutable history, file checksums, counts, confirmation and previous-generation link |
| `activities` | `(importId, activityId)`; normalised schedule generation rows |
| `performance` | `(importId, activityId, periodEnd)`; normalised performance generation rows |
| `projectConfigurations` | `projectId`; confirmed registries and authorised schedule endpoints |
| `projectConfigurationHistory` | `(projectId, revision)`; immutable creation/additive-update evidence |

The commit transaction reads the expected pointer and checksum history, verifies
configuration, writes configuration when required, writes both row sets and the
manifest, and performs the pointer update as its final database operation. Its
callback contains only Dexie promises and synchronous fault hooks. Checksums,
timestamps, schema work, worker communication, and browser APIs finish before
the transaction opens.

Dataset reads always resolve through `activeImportId`. Revert changes only that
pointer after confirming the previous generation still has rows. Garbage
collection retains the active and previous generations, deletes only older row
generations, and never deletes manifests or checksum history.

## Versioned backup schema

Backup format version 1 exports the current active generation rather than a raw
database copy. It contains the source manifest, normalised activity and
performance rows, confirmed project configuration, and empty reserved arrays
for future risk, change and report-draft records. The active pointer, manifest
identity, project identity, row counts, registry uniqueness, field rules and
schedule relationships must all reconcile. Input is capped at 20 MiB.
Older manifests, checksum-detection history and superseded row generations are
not included, so restoring into a fresh origin cannot reproduce the previous-
generation revert option or the source origin's complete duplicate history.

Restore first parses the strict versioned schema, then re-runs cross-file and
schedule-graph domain validation. A valid preview must be explicitly confirmed.
Commit creates a new immutable `RESTORE-*` generation through the same
pointer-last transaction as import; it does not overwrite the source manifest.
Malformed, unsupported, inconsistent or blocking backups write nothing. Last
backup and last restore timestamps are lifecycle evidence, not part of the
atomic dataset contract.

## Validation issue contract

Every data problem is represented as a `ValidationIssue`; data errors do not
throw. The record contains severity, stable machine-readable code, file, record,
optional physical line, column, truncated supplied value, rule, and suggested
correction. Zod custom issues carry the machine code in `params.validationCode`
so the downloadable report never has to derive rules from prose.

Blocking issues prevent commit unless their source record is explicitly
quarantined and all dependent validation is re-run. Warnings are retained for
management attention. Information issues record harmless normalisation such as
removal of a UTF-8 BOM.
