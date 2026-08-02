# Project Control Panel Evolution Planner

> Status: First delivery wave approved; Phases 0–1 completed; Phase 2 in progress
>
> Prepared: 2 August 2026
>
> Implementation authority: Phases 0–2 approved by the user on 2 August 2026. Phases 3–5 remain separate decision gates.

## 1. Outcome

Evolve the current Project Controls Dashboard from a strong, auditable reporting application into a focused **project control room** that closes the weekly management loop:

1. Detect the material exception.
2. Explain the evidence and likely impact.
3. Identify the decision or recovery action.
4. Assign an owner and due date.
5. Navigate directly to the governed record.
6. Verify in the next reporting period whether the action changed the forecast.

The product must remain local-first, deterministic, accessible, and evidence-led. It should not become a generic Jira clone or an imitation enterprise suite.

## 2. First-principles product test

The control panel succeeds when a manager can answer these questions in 30 seconds:

- What is the current schedule and cost position?
- What changed since the previous status date?
- What is the single most material exception?
- What decision or action is required now?
- Who owns it, when is it due, and what evidence supports it?
- Where can I inspect the exact source, calculation, or governed register revision?

Every proposed feature must improve at least one of those answers without weakening traceability, baseline integrity, accessibility, or local data ownership.

## 3. Current baseline

The product already has unusually strong foundations:

- Auditable EVM calculations and source trace.
- Immutable project, risk, milestone, change, variance, and report evidence.
- Controlled baseline reconciliation and change state transitions.
- Data-quality and schedule-logic validation before authoritative reporting.
- Local-only storage, CSP/security controls, backup/restore, and a native macOS wrapper.
- Cross-browser, accessibility, keyboard, print, and mobile evidence.
- Input-first behaviour: a clean installation does not pretend that demonstration data is live project data.

Therefore, the next iteration should preserve the domain and governance architecture. The main opportunity is **information hierarchy, cross-module prioritisation, direct navigation, schedule intelligence, and the closed-loop recovery workflow**.

## 4. Current work-in-progress review

The uncommitted local work appears to be an unfinished improvement slice. It must be preserved and reviewed, not overwritten.

### Keep

- Removing internal “Product build / Release evidence” progress from the operational product shell. Development evidence belongs in release documentation, not the manager’s control room.
- Showing project, baseline, and data date more compactly in the top bar.
- Renaming “Reset view” to “Clear filters & scope”.
- Adding priority, owner, next action, and due date to the management banner.
- Centralising SPI/CPI labels and threshold checks instead of repeating literals.
- Lazy-loading the performance chart and reserving fallback space.
- Moving long page instructions into optional supporting detail.

### Resolve before accepting

1. **Threshold semantics conflict with the approved specification.**
   - Master Plan v1.1 defines green at `>= 0.98`, amber at `0.95–<0.98`, and red below `0.95`.
   - Current work changes this to “On plan” at `>= 1.00`, “Within tolerance” at `0.98–<1.00`, and “Recovery required” below `0.98`.
   - This removes the previous amber/red distinction and changes report/variance behaviour.
   - Recommended resolution: use four explicit meanings — On plan, Within tolerance, Attention required, Recovery/escalation required — backed by an authorised, revisioned threshold configuration. The exact control bands must be approved before code changes.

2. **Priority selection is type-first, not materiality-first.**
   - The current algorithm always chooses a late milestone before any risk or change, even if another record is more urgent or material.
   - Recommended resolution: build one deterministic `ManagementException` model with an explainable priority score based on severity, threshold breach, overdue time, forecast impact, decision due date, and evidence completeness.

3. **The call to action does not deep-link to the record.**
   - “Open milestone/risk/change” currently opens the register page rather than the selected governed record.
   - Recommended resolution: retain global scope and open the exact item in a keyboard-accessible detail panel via URL state.

4. **Provenance becomes too easy to miss.**
   - Long guidance can be collapsed, but baseline, data date, generation freshness, and data-quality condition are control facts and should remain visible.
   - Recommended resolution: keep a compact, persistent trust strip; place row counts, method explanation, and page guidance in the disclosure.

5. **Lazy loading needs an experience gate.**
   - Keep it only if it does not create layout shift, repeated screen-reader announcements, or a perceptible blank state in the native app.

## 5. External benchmark findings

| Reference | Useful pattern | Apply here | Do not copy now |
|---|---|---|---|
| [OpenProject](https://github.com/opf/openproject) and its [work-package views](https://www.openproject.org/docs/user-guide/work-packages/work-package-views/) | Saved filters, table/Gantt/board modes, split-screen record details | Saved control views, configurable columns, and a right-side governed detail panel | Accounts, collaboration, meetings, wiki, and generic task-management breadth |
| [Plane](https://github.com/makeplane/plane) | Fast navigation, triage-oriented hierarchy, modern information density | Command search and clean exception navigation | Sprint/cycle semantics that do not represent project controls |
| [Vikunja views](https://vikunja.io/help/views/) and [saved filters](https://vikunja.io/help/saved-filters/) | Multiple views over the same records, bookmarkable sorting, saved cross-project filters, command access | URL-backed scope/filter state and named local views such as “Overdue actions” | Generic to-do model and collaboration features |
| [ProjectLibre](https://www.projectlibre.com/sites/default/files/document/2023-08/ProjectLibre%20Cloud%20Document%20%281%29.pdf) | WBS, Gantt, dependency logic, and Critical Path Method | Working calendars and a verified CPM engine before adding a read-only Gantt | A full interactive scheduling authoring tool in the first wave |
| [Oracle Primavera Cloud portfolios](https://primavera.oraclecloud.com/help/en/user/90205.htm), [scorecards](https://primavera.oraclecloud.com/help/en/user/99400.htm), and [dashboard tiles](https://primavera.oraclecloud.com/help/en/user/99151.htm) | Role-specific dashboards, configurable measures, thresholds, and drill-down scorecards | Curated Executive / Controls / Delivery views and governed thresholds | Arbitrary dashboard builder and multi-project portfolio hierarchy until single-project control is excellent |
| [InEight Project Controls](https://ineight.com/products/ineight-project-controls/) and [InEight Control](https://ineight.com/products/ineight-control/) | Integrated cost, scope, schedule, EVM, change, forecast versions, and what-if scenarios | One cross-domain exception model and transparent forecast comparisons | ERP integrations and enterprise workflow infrastructure |
| [Deltek Acumen](https://www.deltek.com/products/delivery-assurance/ppm/acumen/) | Schedule diagnostics, generation comparison, risk drivers, and scenario modelling | Schedule-quality score, forensic generation diff, and quality gates before quantitative risk | Monte Carlo before the schedule network and calendars are credible |

### Benchmark conclusion

The strongest differentiator for this product is not feature volume. It is the combination of:

- enterprise-style control logic;
- transparent calculations;
- strong local privacy;
- immutable evidence;
- a much simpler manager experience.

The planner therefore adopts professional project-control patterns while rejecting enterprise administration and collaboration overhead.

## 6. Target experience

### 6.1 Persistent trust and scope bar

Always visible:

- Project and selected work-package scope.
- Data date and active baseline.
- Active import generation and age.
- Data/schedule quality condition.
- Clear-scope control.

Supporting detail may disclose checksums, row counts, methodology, and guidance.

### 6.2 Overview hierarchy

1. Management position: one plain-language conclusion and period movement.
2. Priority control item: exception, owner, action/decision, due date, impact, and direct link.
3. Four primary indicators: delivery, schedule, cost, and forecast confidence.
4. Unified exception queue: Now / This period / Monitor.
5. Trend and forecast comparison.
6. Work-package contribution table.
7. Method, source detail, and page guidance.

Secondary metrics such as EAC sensitivities, VAC, and TCPI remain available without forcing every value into the first visual scan.

### 6.3 Governed record detail

Selecting an exception opens a stable detail panel containing:

- Current fact and threshold.
- Source generation/revision.
- Cause and impact.
- Decision or recovery action.
- Owner, due date, and status.
- Evidence and sign-off state.
- Previous-period position and expected recovery period.
- Link to the complete register/history.

The URL must preserve record, scope, reporting date, and return location.

## 7. Delivery plan

### Phase 0 — Preserve, reconcile, and establish the new baseline

**Estimate:** 6–10 focused hours  
**Dependency:** Approval to begin

Work:

- Preserve the existing uncommitted changes before touching branch history.
- Integrate the five remote `main` commits separately from product changes.
- Review the open dependency PR separately; never bundle dependency risk with UI/domain redesign.
- Resolve the threshold semantics decision and update plan, domain tests, UI labels, variance gates, and report wording as one controlled change.
- Verify current priority banner, lazy chart, responsive CSS, reduced motion, and accessibility behaviour.
- Run the complete local quality gate from a clean integration state.

Exit criteria:

- No local or Claude-authored work is lost.
- Remote security fixes are present.
- One documented threshold model is used by calculations, status colours, variance analysis, weekly reports, and tests.
- Existing fixed EVM results and immutable evidence remain unchanged.
- `pnpm check:release` passes before the UI evolution begins.

### Phase 1 — Close the management-action loop

**Estimate:** 14–20 focused hours  
**Dependency:** Phase 0

Work:

- Introduce a pure, deterministic `ManagementException` view model across variance, milestone, risk, change, and overdue action records.
- Define an explainable priority policy; expose “Why this is priority”.
- Add Now / This period / Monitor queues.
- Add exact-record deep links with scope and reporting-date preservation.
- Rebuild the Overview hierarchy around management position, priority decision, primary KPIs, and exception queue.
- Keep compact provenance visible and move only secondary methodology into the disclosure.
- Add previous-period movement and expected recovery evidence to the priority detail.

Exit criteria:

- The highest-priority record is selected by materiality and urgency, not module order.
- Every item has type, severity, reason, owner, due date, evidence state, and a stable target route.
- Keyboard and screen-reader users can open, inspect, close, and return without losing context.
- A test user can identify the position, priority item, owner, and due date within 30 seconds.

### Phase 2 — Saved control views and faster navigation

**Estimate:** 12–18 focused hours  
**Dependency:** Phase 1

Work:

- Move global scope, reporting date, table sort, filters, selected record, and tab into URL state where safe.
- Add named local views: Executive position, Overdue actions, Forecast threats, Pending decisions, and Data-quality exceptions.
- Add configurable columns for dense registers and tables.
- Add a command/search surface for pages, records, and saved views.
- Use split-panel navigation for inspection; require deliberate edit mode for governed changes.

Exit criteria:

- Refresh, back/forward, and direct links retain the intended context.
- Clearing scope is reversible and does not alter project data.
- Saved views are versioned in backup/restore or explicitly documented as disposable preferences.
- Command navigation is fully keyboard-operable and does not bypass governance.

### Phase 3 — Credible schedule intelligence

**Estimate:** 30–45 focused hours  
**Dependency:** Phases 0–2; separate design decision required

Work:

- Add versioned project calendars, working days, holidays, and lag units.
- Implement and independently verify CPM, total float, free float, critical path, and near-critical thresholds.
- Add generation-to-generation schedule comparison: progress, logic, dates, scope, constraints, and baseline movement.
- Build an explainable schedule-quality score with each contributing finding visible.
- Add a read-only Gantt/network view with baseline, current forecast, data date, critical/near-critical emphasis, and accessible table alternative.
- Link milestone recovery evidence to the actual driving path where the source supports it.

Exit criteria:

- No critical-path claim is shown until calendar and relationship checks pass.
- CPM fixtures are independently calculated and boundary-tested.
- A user can explain what changed between schedule generations without relying on colour or animation.
- Dragging the Gantt cannot silently edit an approved baseline.

### Phase 4 — Forecast, risk, and change scenarios

**Estimate:** 24–36 focused hours  
**Dependency:** Phase 3 for quantitative schedule risk

Work:

- Compare management EAC versions and show forecast movement as a waterfall or reconciled bridge.
- Link qualitative risks and changes to affected work packages, activities, milestones, cost items, and objectives.
- Add controlled before/after change scenarios without rewriting the approved baseline.
- Show risk and change contribution in the unified exception queue.
- Only after schedule-quality gates pass, prototype deterministic Monte Carlo inputs and P50/P80 outputs with uncertainty, assumptions, seed control, and accessible result tables.

Exit criteria:

- Scenario output never presents a proposal as the approved forecast.
- Original, current approved, approved-not-incorporated, and scenario values remain visibly distinct.
- Quantitative risk output is blocked when schedule quality is insufficient.
- Every scenario can be reproduced from stored inputs and a recorded model version.

### Phase 5 — Evidence completeness and release assurance

**Estimate:** 16–24 focused hours  
**Dependency:** Selected feature phases

Work:

- Upgrade backup format to include older register revisions, variance analyses, publications, manifests, and revert evidence.
- Complete VoiceOver evidence, moderated comprehension testing, and the full-ASTER native WKWebView print repetition.
- Re-test at 320 px, 390 px, desktop, high contrast, forced colours, 400% zoom, keyboard-only, and reduced motion.
- Measure interaction latency, layout shift, import responsiveness, and table scale.
- Update walkthrough, screenshots, limitations, roadmap, and release evidence.

Exit criteria:

- Backup/restore preserves the complete governed history selected for the release scope.
- No serious accessibility finding remains in the core control loop.
- Users complete the priority-item journey unaided at the agreed target rate.
- Performance and motion budgets below are evidenced on web and native builds.

## 8. Motion and smoothness contract

Motion must explain state change, not decorate financial or schedule facts.

### Durations

- Immediate feedback: 100–140 ms.
- Standard hover, focus, selection, and small fade: 160–200 ms.
- Panel, disclosure, and route-context transition: 220–280 ms.
- Chart series update: 280–420 ms, once per deliberate filter/status-date change.
- Exit should normally be slightly faster than entry.

### Behaviour

- Prefer `transform` and `opacity`; avoid animating layout-heavy properties across large tables.
- Reserve final space for lazy-loaded charts and panels to prevent content jumps.
- Scroll smoothly only after explicit user navigation; never steal scroll position on background updates.
- Do not animate numbers counting up; audited values should become correct immediately, with an optional short highlight of what changed.
- Toasts and save confirmations must remain long enough to read and must not be the only record of success/failure.
- Preserve focus through panel and route transitions.
- `prefers-reduced-motion: reduce` removes non-essential movement and smooth scrolling while preserving state feedback.

### Performance targets

- Visual response to input: under 100 ms where possible.
- Scope/filter result: p95 under 200 ms on the full ASTER fixture.
- No material layout shift when charts or route chunks load.
- Maintain a 16.7 ms frame budget as the baseline; target 11.1 ms at 90 Hz and 8.3 ms at 120 Hz for simple transform/opacity transitions on capable hardware.
- Never sacrifice correctness, accessible announcements, or immutable writes to claim a frame rate.

## 9. Validation plan

### Domain and unit tests

- Threshold boundaries and authorised revisions.
- Cross-module exception normalisation and priority tie-breaking.
- Previous-period movement and expected recovery period.
- Stable deep-link encoding/decoding.
- CPM/calendar and scenario fixtures when those phases are authorised.

### Integration tests

- Scope, data date, and selected record reconcile across Overview, register, and report.
- Priority item changes deterministically after source updates.
- Back/forward navigation restores the same control context.
- Backup/restore preserves saved-view and governed-history boundaries as specified.

### End-to-end and usability tests

- Identify position, top priority, owner, and due date in 30 seconds.
- Navigate Overview → exact exception → evidence → return with keyboard only.
- Verify reduced-motion and screen-reader announcements.
- Confirm no horizontal overflow at 320/390 px.
- Test readable loading, empty, stale, warning, error, conflict, and success states.

### Performance tests

- Full ASTER import and initial overview.
- Rapid scope changes without stale chart/table output.
- 1,000+ row tables with configured columns.
- Native route chunk loading and panel transitions on 60/90/120 Hz displays where available.

## 10. Recommended approval boundary

Approve **Phases 0–2 as the first delivery wave**, then re-evaluate before implementing CPM, Gantt, Monte Carlo, portfolio, or broader scenario features.

Expected first-wave effort: **32–48 focused hours**.

This first wave produces the highest user value with the lowest domain risk:

- it safely integrates existing work;
- fixes the current threshold and prioritisation ambiguity;
- makes the overview decisively action-oriented;
- adds direct navigation and reusable control views;
- retains all existing governance and privacy strengths.

Phases 3–5 remain planned options, not pre-approved scope.

## 11. Explicitly deferred

- Cloud backend, authentication, permissions, notifications, and real-time collaboration.
- Arbitrary drag-and-drop dashboard builder.
- Multi-project portfolio/EPS hierarchy.
- AI-generated management narrative or opaque AI priority scoring.
- Editable Gantt that can alter approved dates or logic.
- Monte Carlo before calendar, CPM, schedule quality, and reproducibility gates exist.
- Production or confidential project data.

## 12. Start gate

Satisfied on 2 August 2026 when the user explicitly said **“好，从你的 planner 开始”**.

Phase 0 preserved the dirty worktree, reconciled remote security changes, documented the threshold decision, and passed the complete release baseline before Phase 1 product work began. See `PHASE_0_CONTROL_PANEL_BASELINE.md`.
