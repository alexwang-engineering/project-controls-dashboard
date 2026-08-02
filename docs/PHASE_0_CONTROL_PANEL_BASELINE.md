# Project Control Panel Phase 0 Baseline

## Decision

Phase 0 completed on 2 August 2026. The Project Control Panel first delivery wave may proceed to Phase 1 from the verified `codex/project-control-panel-phase-0` branch.

## Preservation and integration evidence

- Original local/Claude work was preserved in commit `f968e04` after rebasing.
- The planner was preserved in commit `ebe2a6e` after rebasing.
- Pre-rebase commits remain recoverable from branch `backup/project-control-panel-wip-20260802`.
- Remote `origin/main` commits through `17cb3fb` are ancestors of the Phase 0 branch.
- The Router 8 conflicts were limited to `AppShell.tsx` and `OverviewPage.tsx`. Resolution retained the remote `react-router` imports and the local overview/lazy-chart work.
- The original local `main` branch was not rewritten.

## Threshold-control decision

Commit `27dd22d` implements and tests four explicit SPI/CPI meanings while retaining the approved control thresholds:

- At or above 1.00: On plan.
- 0.98 to below 1.00: Within tolerance.
- 0.95 to below 0.98: Attention required; variance analysis required.
- Below 0.95: Recovery required; variance analysis required.
- Missing denominator: Unavailable; no condition inferred.

The decision and consequences are recorded in `architecture-decisions/ADR-0006-performance-threshold-semantics.md`.

## Release evidence

One uninterrupted final `pnpm check:release` completed successfully after installing the Playwright browser versions required by the updated lockfile:

- Dependency audit: no known vulnerabilities.
- Lint: passed with warnings denied.
- Strict TypeScript build: passed.
- Vitest: 47 files, 320 tests passed.
- Vite production build: passed.
- Native loopback server: 4 tests passed.
- Playwright: 27 journeys passed across Chromium, Firefox, WebKit, and the 390 px mobile project.

The first release-gate attempt passed Chromium and mobile coverage but could not launch Firefox or WebKit because the remote Playwright update required new local browser binaries. No application assertion failed in that run. After installing the exact required Firefox and WebKit builds, the entire gate was restarted and passed.

## Phase 1 entry conditions

- Worktree is committed and recoverable.
- Remote security fixes are integrated.
- Threshold labels, UI tones, variance gates, and weekly-report wording use one documented domain source.
- Existing EVM fixtures and immutable evidence boundaries remain intact.
- Phase 1 may introduce the pure `ManagementException` model and Overview control loop without changing stored governed records.
