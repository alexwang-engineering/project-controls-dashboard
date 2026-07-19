# ADR-0003: Immutable baseline evidence and effective-period reconciliation

## Status

Accepted on 19 July 2026 for the M6 technical closure candidate.

## Context

The change workflow records approval, implementation, effective date and the
incorporated baseline version. That evidence is insufficient on its own to prove
that an imported revision did not rewrite original BAC, authorised schedule
facts, or historical PV, EV and AC. Superseded activity/performance generations
may also be garbage-collected, while the M6 requirements say pre-change
variance must remain visible.

Hermes independently recommended a pure `original + implemented changes at the
cut-off` derivation and identified effective-date ambiguity as the principal
risk. Local repository inspection added a stronger persistence requirement:
the source facts needed by that derivation must survive row-generation GC.

## Decisions

### D1 — Retained evidence per successful generation

Every successful import stores a compact baseline snapshot in the same Dexie
transaction as its accepted rows and manifest. It contains:

- project, baseline version, import ID, import/data timestamps;
- BAC in integer pence and the project baseline finish;
- a deterministic signature of authorised activity/WBS, baseline dates,
  budget, calendar, constraints, milestone/progress method and predecessor
  logic; and
- project-period PV, EV and AC totals in integer pence.

The snapshot is written before the manifest and final active-pointer flip. It is
rolled back with the generation on any error. No checksum, browser API, worker
response or foreign promise is awaited inside the transaction.

### D2 — Garbage collection and migration

Generation GC may still delete eligible activity and performance rows. It never
deletes baseline snapshots. Database schema version 4 backfills snapshots for
every older manifest whose rows are still retained. Evidence that was already
deleted before the upgrade is not invented; a later reconciliation that needs
it fails closed with `BASELINE_HISTORY_REQUIRED`.

### D3 — Baseline-version immutability

A later import may update forecast and performance status under an existing
baseline version, but its authorised baseline-definition signature must be
identical. Changing scope identity, baseline dates/budget, calendar logic,
constraints, milestone/progress method or predecessor logic requires a new
baseline version. A mismatch aborts the atomic import before any pointer flip.

### D4 — Original and active source of truth

- The original baseline is the earliest successfully retained baseline
  generation for the project.
- The active baseline is the generation selected by `activeImportId`.
- Reverting the pointer does not delete later evidence. An implemented change
  linked to a later version is blocking while an earlier version is active.
- Money remains integer pence in storage and is converted to pounds only at the
  existing view-model boundary.

### D5 — Cost and schedule reconciliation

For the active version path:

```text
original BAC + incorporated implemented cost changes = expected active BAC
active imported BAC - expected active BAC = reconciliation variance
```

Any non-zero monetary difference beyond half a penny is blocking. The schedule
equivalent adds incorporated schedule-impact days to the original project
baseline finish and compares that result with the active imported finish.

The current import contract identifies calendars but does not define working
time. M6 therefore labels and calculates schedule impacts as **calendar days**.
Project-calendar working-day arithmetic requires a later calendar-definition
contract and is not implied by this calculation.

### D6 — Effective-date boundary

An implemented change is effective for a report when
`effectiveDate <= reportingDate`. A period whose end equals the effective date
is post-change. Historical preservation therefore compares every period with
`periodEnd < effectiveDate` exactly between the immediately preceding baseline
version and the active version.

If any pre-effective PV, EV or AC period is missing or has a different value,
publication is blocked with `HISTORICAL_PERFORMANCE_REWRITTEN`. A revised
baseline that is active before its linked change becomes effective is blocked
with `BASELINE_EFFECTIVE_DATE_PENDING`.

### D7 — Before/after performance presentation

For each effective implemented change, the application retains and displays:

- cumulative pre-change SV/CV and other EVM facts using the preceding
  baseline's BAC and periods before the effective date;
- cumulative post-change performance using the active BAC and accepted periods
  through the report date; and
- the from/to versions, effective date and historical-preservation result.

The comparison is derived. It never mutates original schedule, PV, EV, AC or
BAC records.

### D8 — Publication and backup behaviour

Weekly-report publication inherits every baseline reconciliation control. BAC,
finish or historical-performance mismatch disables the print/publish action.
The report snapshot exposes the original/active versions, expected and actual
BAC, variance, finish comparison, effective change IDs and pre/post metrics.

The current JSON backup remains explicitly scoped to the active row generation.
It does not yet preserve the multi-generation baseline ledger or local change
register. Restore still reuses the atomic import path and creates evidence for
the restored generation, but full baseline-history portability remains a named
future backup-version requirement.

## Consequences

- M6 reconciliation remains auditable after normal row GC.
- Importing changed authorised facts under a reused version now fails and asks
  the user to provide a deliberately revised version.
- Old databases are upgraded without fabricating unavailable history.
- Baseline errors are publication controls rather than cosmetic warnings.
- Compact snapshots add small persistent storage growth per successful import;
  this is accepted because period totals and signatures are materially smaller
  than retained raw generations.

## Rejected alternatives

- Deriving original BAC as `active BAC - changes`: this always balances and
  cannot detect a bad revised baseline.
- Keeping evidence only in the change form: user-entered duplicates are not an
  authoritative substitute for committed schedule/cost facts.
- Retaining only the active and previous raw generation: repeated imports or GC
  can erase the baseline needed by a later audit.
- Treating approval as incorporation: an approved change remains separate until
  an implemented, version-linked record exists.
- Comparing only cumulative totals: equal totals can hide a rewritten earlier
  period, so period identity and PV/EV/AC values are compared exactly.
