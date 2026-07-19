# ADR-0004 — Weekly report publication boundary

**Status:** Accepted  
**Date:** 19 July 2026  
**Decision owner:** Project Controls Dashboard

## Context

The deterministic M7 report builder produced a current HTML preview, but the
preview was recalculated from mutable local registers and could be printed
without an immutable publication record. Management evidence needs to answer
which facts and narrative were approved, by whom, and at what time.

## Decision

1. A report context is `projectId | baselineVersion | reportingPeriod`.
2. One editable draft is retained per context and source generation. Older
   source-generation drafts are audit history, not current drafts.
3. The source fingerprint canonically covers the calculated report (excluding
   generation time), the active import ID, all selected signed variance
   revisions, and the complete milestone, risk and change register inputs.
   Source-array order does not change the fingerprint; a value change does.
4. Draft save and publication compare the expected active import with the
   current pointer inside a Dexie transaction. Fingerprinting, narrative
   validation and timestamp validation finish before that transaction, so no
   foreign promise can weaken atomicity.
5. Publication requires passed report controls, complete named-authority
   narrative and an exact saved draft match. The transaction reads the current
   draft, allocates the next revision, inserts one append-only published record,
   then removes only that draft. Duplicate concurrent publish attempts cannot
   create two revisions from one draft.
6. Each published record embeds the exact report, narrative and source evidence.
   Loading rechecks identity, fingerprint, timestamps and publication metadata.
7. Print/PDF remains a secondary rendering of accessible HTML and is enabled
   only when a persisted revision is selected. The live preview is never
   described as an approved printable snapshot.
8. Database schema version 5 adds `reportPublications`. Import row garbage
   collection never deletes report records. Explicit full local reset does.
9. The version-1 active-generation JSON backup remains deliberately narrow and
   does not include report drafts or publications. This limitation is visible
   in the README; a future full-audit backup requires a separately versioned
   schema and restore contract.

## Consequences

- A manager can edit decision-focused text without changing calculated facts.
- Published revisions are reproducible after source data or registers move.
- Active-generation races, stale drafts and double publish clicks fail safely.
- Stored evidence is larger because each publication contains its source
  registers and report snapshot; M7 volumes are small and local-first.
- Formal A4 page-count, clipping and cross-engine PDF approval remains an M7
  release gate rather than being inferred from storage correctness.
