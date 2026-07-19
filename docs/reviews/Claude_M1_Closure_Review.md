# Claude Independent Review — M1 Closure Candidate

| Field | Value |
|---|---|
| Review type | Read-only diff review + isolated-worktree gate verification (no repository files modified) |
| Review range | `ce27219..2c858c4` |
| Reviewer | Claude (independent technical reviewer) |
| Date | 19 July 2026 |
| **Code verdict** | **APPROVED for M1 closure.** Every gate criterion independently verified at the committed SHA. |
| **Process flags** | **Two — see §Process. Neither blocks the code, both should be resolved before M1 is recorded as closed.** |

---

## Important: what I actually tested

The main checkout was **not** at `2c858c4` when I reviewed. `HEAD` is `fd45cd4`, and the
working tree carries **uncommitted M3 work** (variance analysis, EAC scenarios). Running the
gate in the live checkout gives **203 tests, 4 failing** — but those 4 failures are all in the
uncommitted M3 files (`VarianceAnalysisPanel`, EAC panels), **not** in the M1 candidate.

To judge M1 fairly I checked out `2c858c4` in an **isolated git worktree** and ran the gate there:

- **189 / 189 tests pass** · lint clean · strict typecheck clean · production build succeeds.
- **Build emits a separate worker asset**: `dist/assets/import.worker-*.js` (~151 kB) — confirms
  the real Vite module worker is packaged (C2 / I15), not inlined.

Codex's "189/189" claim is accurate **for the committed candidate**. The worktree has been removed;
the main checkout was never modified.

## Gate verification (all six review-focus items)

1. **I15 worker parity** — the worker entry (`import.worker.ts`) and the fallback path
   (`importWorkerClient.ts`) both call the *same* `processImportFiles`. Identity is guaranteed by
   construction, not by parallel reimplementation. The client falls back on missing `Worker`,
   construction failure, timeout, `onerror`, `onmessageerror`, or an error response; the fallback
   is tested. Careful detail: the transferred `ArrayBuffer`s are **copies** (`.slice(0)`), so the
   original bytes survive transfer and remain valid for the fallback. **Verified.**
2. **D1/D2 — no side-effect mutation** — a later import validates against the *active* registry and
   an unknown `wbs_id` still blocks; registry evolution is a separate, explicit
   `previewAdditiveUpdate` → `commitAdditiveUpdate` action. **Verified.**
3. **Registry revisions additive + confirmed + CAS + history** — `assertAdditive` rejects any
   removal; the commit transaction re-checks pointer, `expectedRevision`, and a full
   configuration signature (compare-and-set) before writing; a `created`/`additive-update` history
   record is written in the same transaction; confirmation is required. Removals and stale previews
   throw. **Verified.**
4. **Active pointer unchanged by a registry-only revision** — `commitAdditiveUpdate`'s transaction
   scope is `[meta, projectConfigurations, projectConfigurationHistory]` and it only **reads**
   `meta.activeImportId` (for the CAS guard); it never writes it. The active data generation is
   provably untouched. **Verified.**
5. **Complete ASTER through the real pipeline** — `demoImportFiles.test.ts` drives the full pair
   through `processImportFiles` and asserts 60 activities, 8 milestones, 5 WPs, 16 periods, 960
   performance rows, and the §6.5 control totals exactly (BAC £2.4m, PV £1.5m, EV £1.35m, AC
   £1.44m), `canCommit: true`, data date 2026-06-14. This is C4 satisfied. **Verified.**
6. **v2 migration preserves v1 data** — the Dexie v2 upgrade back-fills `revision: 1` on existing
   configurations, creates a `created` history entry per project, preserves the configuration
   payload, and bumps `schemaVersion`; a migration test covers it. **Verified.**

Performance: the timed fixture (1,000 activities + 1,000 performance rows through checksum → parse →
normalise → cross-file → graph) is well under the 2 s portable threshold. My earlier notes are all
resolved: worker boundary (C2/I15), full demo (C4), registry-update path (D1), backup-scope README.

## Process flags (do not block the code, do gate the *record* of closure)

**P1 — The closure was committed before the review it cites.** `HEAD` is `fd45cd4`,
*"docs: close M1 after independent review,"* committed ahead of this review. The independent
approval is happening in this document, now. The outcome is favourable, but the sequencing inverts
the gate: a closure commit should follow the approval it references, not precede it. Recommend the
closure record cite this review by date/name once it exists.

**P2 — M1 closure state is not reproducible from the live checkout.** The main checkout is dirty
with uncommitted M3 work whose tests fail (4 of 203). Anyone who runs the quality gate in the
working tree today sees failures, not 189/189 — so the "gate passing" evidence only holds against
the specific commit, not the tree a reviewer or CI would actually see. This also mixes a *closed*
milestone and an *in-progress* one in a single uncommitted state. **Recommend Codex commit or stash
the M3 work onto its own branch** so `2c858c4` (or a clean closure commit) is the reproducible M1
state. This is exactly the separation the collaboration protocol's worktree rule was meant to keep.

## Verdict

The M1 code is **approved for closure**: worker parity, additive registry control with CAS and
history, the pointer-preserving revision semantics, the full ASTER dataset through the real
pipeline, the v2 migration, and the performance evidence are all correct and independently verified
at `2c858c4`. Resolve P1/P2 so the *record* of closure is as clean as the code.

*— End of review. No repository files were modified; the temporary review worktree was removed.*
