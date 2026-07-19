# M1 closure evidence

**Evidence date:** 19 July 2026<br>
**Reviewed range:** `ce27219..2c858c4`<br>
**Status:** Closed and post-review ratified; independently approved with no blocking findings and live module-worker operation confirmed.

## Gate results

| Gate | Evidence | Result |
|---|---|---|
| I15 worker parity | Versioned request/response protocol; worker harness and forced-construction-failure fallback both equal the direct `processImportFiles` result | Pass |
| Vite worker packaging | Production build emits a separate `import.worker-*.js` module asset | Pass |
| Complete ASTER pair | 60 activities, 8 schedule milestones, 5 WPs, 16 distinct weekly periods and 960 performance rows pass the real pipeline | Pass |
| Control reconciliation | BAC £2.4m, PV £1.5m, EV £1.35m and AC £1.44m are reproduced from normalised imported records | Pass |
| D1/D2 update semantics | Unknown identifiers block; an additive revision requires confirmation, CAS protection and automatic revalidation; removals and stale previews fail | Pass |
| Registry history migration | Dexie v1 registries migrate to revision 1 in storage schema v2; later accepted revisions are immutable history records | Pass |
| Performance | 1,000 schedule activities plus 1,000 matching performance rows processed in 41 ms; threshold is under 2,000 ms | Pass |
| Candidate quality gate | Claude independently reproduced 189/189 tests, lint, strict typecheck and build at `2c858c4`; the later closure-record checkout passed 190 tests | Pass |
| Independent review | Hermes and Claude reviewed the committed range in isolated checkouts and approved it with no blocking findings | Pass |
| Live packaged-app worker check | The complete ASTER example processed 1,020 accepted source rows in the isolated module worker in 74 ms, with zero blocking issues | Pass |

## Independent closure review

Hermes Agent reviewed `ce27219..2c858c4` read-only from a disposable clone on
19 July 2026. It inspected the implementation and tests for worker/fallback
parity, the complete ASTER pipeline, performance evidence, additive registry
revisions, compare-and-set protection, history preservation, active-pointer
safety and backup documentation. The verdict was **APPROVED**, with no blocking
findings.

Hermes could not run `pnpm` because the disposable environment did not inherit
the project's bundled runtime path. Codex therefore reran the complete quality
gate in the real clean checkout: lint, strict TypeScript, 190 tests and the
production build all passed.

The packaged Desktop build was then exercised at `/import`. The complete ASTER
example produced 60 schedule activities and 960 performance records, displayed
1,020 accepted rows, zero blocking issues and the explicit status **Validated
in the isolated module worker**. The observed worker time was 74 ms. The one
open-finish warning reflected the existing browser origin's older authorised
finish and correctly exposed the controlled additive registry-update flow.

## Performance environment

- Apple M4, arm64
- 16 GiB memory
- macOS 26.5.2
- Node.js 24.14.0
- Vitest timed test: `src/features/import/importPerformanceEvidence.test.ts`
- Measured processor stages: SHA-256, RFC CSV parsing, row normalisation, cross-file validation and 1,000-node schedule-graph analysis
- The timed fixture contains 1,000 activity records and 1,000 matching performance records.

The 41 ms value is a recorded development-machine observation, while the automated acceptance assertion remains the plan's portable under-two-second threshold.

## Claude ratification and process-flag resolution

Claude independently reviewed `ce27219..2c858c4` on 19 July 2026 in an
isolated worktree and approved the M1 code for closure. The complete read-only
review is preserved at
[`Claude_M1_Closure_Review.md`](reviews/Claude_M1_Closure_Review.md).
Its source Desktop copy had SHA-256
`a96c24fc7797274a874725d9170386a0e4822674b2ca451b2f8f60ee595b96ea`.

The review raised two non-code process flags. They are resolved by the
post-review ratification commit that contains this section:

| Flag | Resolution |
|---|---|
| P1 — closure record predated Claude's approval | This later documentation commit records the real review by reviewer, date, range and preserved report; history is not rewritten. |
| P2 — live checkout mixed dirty M3 work with the closed M1 state | M3 is separately committed as `263db1d`; the main tree is clean, and the current complete gate passes 205/205 tests, lint, strict typecheck and build. The exact M1 candidate remains reproducible at `2c858c4`. |

## Reviewed scope

The independent review assessed the range against:

1. I15: module-worker and fallback results must remain structurally identical.
2. D1/D2: a later import cannot mutate configuration as a side effect.
3. Registry revisions must be additive, explicitly confirmed, CAS-protected and history-preserving.
4. The active dataset pointer must remain unchanged by a registry-only revision.
5. The complete ASTER example must enter through the same import pipeline as user-selected files.
6. Storage schema v2 migration must preserve existing v1 configuration data.
