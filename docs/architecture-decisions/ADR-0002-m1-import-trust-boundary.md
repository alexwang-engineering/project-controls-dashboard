# ADR-0002: M1 import trust boundary and unresolved data-contract decisions

## Status

Accepted on 18 July 2026 before the M1 CSV schemas are frozen.

## Context

The Version 1.1 master plan defines exact `schedule.csv` and `performance.csv`
columns, but it leaves several source-of-truth and validation-order questions
open. These questions were identified in Claude's independent, read-only M1
architecture review:

- Source: `/Users/wjl/Desktop/Claude_M1_Architecture_Review.md`
- SHA-256: `c54338fad4d521d534214ad7628f7a084659424ed173690e57061956eb063d60`

The decisions below are normative for M1. They resolve the six blocking schema
questions, two smaller validation questions, and the parser/storage challenges
raised in that review.

## Decisions

### D1 — Work-package source of truth

The application-managed project configuration is authoritative and will include
a versioned work-package registry containing `wbsId`, display name, owner role,
and active state.

- The Aster demo seeds WP100–WP500.
- For the first import of a new project, preview proposes the distinct schedule
  `wbs_id` values and requires explicit user confirmation before the registry is
  created in the same atomic commit.
- Later imports validate membership against the active registry. An unknown
  `wbs_id` blocks commit until the project configuration is deliberately updated.
- The application never silently invents a work package during commit.

This extends the master plan's project-configuration record so “must match known
work package” has an enforceable meaning without adding another CSV format.

### D2 — Calendar source of truth

The application-managed project configuration owns the calendar allowlist. The
Aster demo seeds `CAL-5D`. A first import for a new project requires the user to
confirm the calendar IDs discovered in the candidate schedule before commit.
Later unknown calendar IDs are blocking errors whose message lists the configured
IDs. M1 validates identity only; calendar-aware duration and CPM calculations
remain out of scope.

### D3 — Data date used by import validation

The import data date is the latest distinct `period_end` in the required
performance file. `actual_start` and `actual_finish` cannot be after that date.
The validator never falls back to the machine's current date. Selecting an
earlier reporting date later does not invalidate the import; it produces a
visible status-date warning in the derived view model.

### D4 — CSV row-number semantics

Validation issues use one-based **record numbers**: the header is record 1 and
the first data record is record 2, even when a quoted field contains a newline.
Reports state this definition. `physicalLineStart` is included when the parser
can establish it reliably and is mandatory for blank-line and structural parser
errors, but record number remains the stable identifier used for quarantine and
manifest reconciliation.
If the boundary scanner and Papa Parse do not produce the same record count, all
physical-line hints for that parse are omitted rather than guessed.

### D5 — Formula-like input and legitimate negative numbers

Typed fields apply their strict grammar before the formula heuristic. A valid
signed monetary grammar is not classified as a formula. A numeric field such as
`ac_period` still rejects `-1200`, but reports the correct non-negative-value
rule rather than a formula warning. Values that fail an identifier, date,
number, enum, boolean, or relationship grammar and begin with `=`, `+`, `-`,
`@`, tab, CR, or LF are blocking formula-like input.

Free text is accepted and rendered only as text. Every CSV export, including
the validation-error report, neutralises untrusted leading formula characters
with an apostrophe before RFC quoting.
Trusted calculated scalars may bypass formula neutralisation only through an
explicit per-column encoder policy; they still receive RFC quoting. This keeps
legitimate negative variance values numeric in future management exports while
making untrusted text the default.

### D6 — Quarantine and dependent rows

Quarantine is explicit and never cascades silently. Excluding a blocked schedule
record re-runs cross-file and graph validation. Newly orphaned performance rows
become blocking issues and require separate user quarantine decisions. Every
excluded record and reason is retained in the import manifest. Commit is enabled
only when no unquarantined blocking issue remains.

### D7 — Weekly cadence

The ordered set of distinct project `period_end` values defines the reporting
calendar. Consecutive distinct dates should be seven calendar days apart. A
different interval is a warning naming the gap; it is not inferred separately
per activity because activities may legitimately be inactive in some periods.
Duplicate `(activity_id, period_end)` keys remain blocking errors.

### D8 — Duplicate checksum scope

Duplicate detection compares each raw-file SHA-256 checksum with all successful
manifest history for the same project, not only the previous import. Manifests
and checksum history are retained even when superseded row generations are
garbage-collected. An identical re-import requires explicit confirmation and the
confirmation is recorded in the new immutable manifest.

Garbage collection may delete superseded activity and performance row
generations only. It never deletes manifests or checksum history. The repository
integration test must assert both survive generation cleanup.

### D9 — Header and scalar normalisation policy

- Parse with `header: false`, `dynamicTyping: false`, and
  `skipEmptyLines: false`.
- Required headers are an exact, duplicate-free set. Column order is not
  significant.
- All values cross the schema boundary as strings.
- Dates use strict `YYYY-MM-DD` syntax plus real-calendar validation.
- Booleans accept only lowercase `true` and `false`.
- Monetary values are converted once to branded integer pence. Scientific
  notation, currency symbols, grouping separators, hexadecimal values, and more
  than two decimal places are rejected.
- M1 cell-length limits use JavaScript string length (UTF-16 code units), so a
  supplementary Unicode character such as many emoji counts as two units.

### D10 — Worker, storage, and demonstration architecture

- Papa Parse runs inside a Vite module worker through a typed message protocol;
  Papa's Blob-based `worker: true` mode is not used.
- Import storage uses immutable generations. A single Dexie transaction writes
  the candidate rows and manifest, then flips `activeImportId` as its final
  Dexie operation.
- Checksums, worker responses, browser APIs, and all other non-Dexie promises
  finish before the transaction opens. There are no foreign awaits inside the
  commit transaction.
- The previous generation is the restorable pre-import snapshot. Garbage
  collection runs later and retains at least the active and previous data
  generations plus all manifests.
- Demo CSV fixtures enter through the same parse, validate, preview, and commit
  pipeline. The current TypeScript snapshot remains only as a temporary M2/M3
  view fixture until adapters are connected.
- Normalised records use opaque/branded types so raw strings cannot be passed to
  calculations, repositories, or UI view models accidentally.

## Failure-invariant contract

M1 implementation and review must preserve these invariants:

1. `activeImportId` points only to a fully committed generation.
2. Dataset reads always resolve through the active pointer.
3. Parsed, accepted, blocked, warning, and quarantined counts reconcile.
4. Raw values cross exactly one validation and normalisation boundary.
5. Checksums cover original bytes and committed manifests are immutable.
6. No foreign promise is awaited inside a Dexie transaction.
7. Money is integer pence after validation.
8. `NaN` and `Infinity` never reach domain or UI code.
9. Candidate validation never mixes candidate rows with active imported rows.
   Membership validation receives project configuration as an explicit input:
   the proposed configuration during a first import and the active configuration
   during later imports.
10. Every CSV export uses the shared injection-safe encoder.
11. Parsing and validation are pure until explicit commit.
12. Backup restore uses the same validated atomic commit path.
13. Quota estimates are advisory; transaction rollback provides safety.
14. Identical re-import requires recorded user confirmation.
15. Worker fallback preserves the same validation contract and results.

## Consequences

- M1 includes a small project-configuration confirmation step for first imports.
- The work-package and calendar registries become explicit repository records.
- Row identity is stable under multiline fields, while physical-line detail is
  retained where it is useful and reliable.
- Generation storage consumes additional temporary space but makes rollback and
  atomicity simple to prove.
- The validation error report is treated as an untrusted export surface.
- The fixture pack and parser/repository tests must be built before the import UI
  is considered complete.

## Required regression additions

- First-project work-package confirmation: accepting proposed IDs creates the
  registry in the same atomic commit; declining writes nothing.
- Later work-package validation: an unknown `wbs_id` blocks against the active
  registry and does not mutate that registry.
- The equivalent first-import confirmation and later unknown-ID cases apply to
  calendars.
- Generation garbage collection removes eligible row data while retaining every
  manifest and checksum-history record.

## Rejected alternatives

- Deriving work packages silently on every import: it makes membership
  validation meaningless and allows accidental WBS drift.
- Falling back to today's date for status validation: it is non-deterministic and
  violates the pure-domain contract.
- Delete-and-replace storage: transactionally possible, but weaker for recovery
  and harder to demonstrate than immutable generations plus pointer swap.
- Papa `header: true`, `dynamicTyping`, `skipEmptyLines`, or Blob-worker mode:
  each conflicts with an explicit validation, precision, blank-line, or CSP
  requirement.
