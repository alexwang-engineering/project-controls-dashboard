# M1 closure-candidate evidence

**Evidence date:** 19 July 2026  
**Candidate base:** `ce27219`  
**Status:** Implementation complete; independent diff review and live module-worker confirmation pending.

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
| Quality gate | Lint, strict typecheck, all 189 tests and production build | Pass |

## Performance environment

- Apple M4, arm64
- 16 GiB memory
- macOS 26.5.2
- Node.js 24.14.0
- Vitest timed test: `src/features/import/importPerformanceEvidence.test.ts`
- Measured processor stages: SHA-256, RFC CSV parsing, row normalisation, cross-file validation and 1,000-node schedule-graph analysis
- The timed fixture contains 1,000 activity records and 1,000 matching performance records.

The 41 ms value is a recorded development-machine observation, while the automated acceptance assertion remains the plan's portable under-two-second threshold.

## Review focus

Review the next commit range against:

1. I15: module-worker and fallback results must remain structurally identical.
2. D1/D2: a later import cannot mutate configuration as a side effect.
3. Registry revisions must be additive, explicitly confirmed, CAS-protected and history-preserving.
4. The active dataset pointer must remain unchanged by a registry-only revision.
5. The complete ASTER example must enter through the same import pipeline as user-selected files.
6. Storage schema v2 migration must preserve existing v1 configuration data.

