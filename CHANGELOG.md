# Changelog

All notable changes to this project are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-22

Initial public release — a tested local-first slice of the Version 1.1 master
plan.

### Added

- Earned-value calculation engine (BAC, PV, EV, AC, SV, CV, SPI, CPI, three EAC
  views, ETC, VAC, TCPI) in a pure domain layer independent of React, storage,
  network state and browser time.
- Guided schedule/performance CSV import with field-level validation, checksum
  control, an isolated module worker, explicit registry confirmation, and
  pointer-last atomic persistence.
- Milestone, risk and change registers persisted as immutable Dexie revisions
  behind a current-head pointer, with stale-writer rejection and mandatory
  post-update revalidation.
- Controlled change-control state machine with an approved-but-not-baselined
  integrity guard, and a selectable 5×5 risk heatmap with immutable authorised
  risk-appetite history.
- Deterministic weekly management report with publication gating — unresolved
  schedule logic, incomplete recovery, or a rewritten historical PV/EV/AC value
  block publication — plus append-only published revisions and an exact source
  fingerprint.
- Accessible HTML as the authoritative report format, with a guarded print/PDF
  path enabled only for a selected persisted publication.
- Compiled macOS AppKit/WebKit host with a hardened `127.0.0.1`-only server and
  checked-in native server tests.
- Twenty-seven cross-browser Playwright journeys (Chromium, Firefox, WebKit and
  a 390×844 mobile project) covering empty first-run, imported calculations,
  milestone recovery, WCAG A/AA axe scans, keyboard/skip/focus, reflow and
  reduced-motion states.
- Restrictive production CSP without `unsafe-eval`; Dependabot and CodeQL
  workflows.
- Apache-2.0 license, plus a case study and a 70-second demo video in the
  README.

[Unreleased]: https://github.com/alexwang-engineering/project-controls-dashboard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/alexwang-engineering/project-controls-dashboard/releases/tag/v0.1.0
