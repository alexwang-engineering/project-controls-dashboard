# M4 milestone-control evidence

**Evidence date:** 20 July 2026
**Milestone assessment:** 100% technical exit criteria
**Scope:** Source-linked milestone status, dependency evidence, movement, recovery and reporting controls

## Outcome

The milestone page now implements the complete M4 control loop. It can create
register records from every milestone in the accepted schedule, calculate one
of six statuses at the active reporting date, compare baseline/previous/current
dates, enumerate predecessor evidence, expose logic-quality concerns and require
a structured recovery record for every adverse outcome or forecast.

The implementation deliberately does not label the enumerated chain as a
critical path. The imported schema does not provide computed total float or a
calendar definition from which this application could independently perform a
defensible CPM calculation. The interface and report therefore say
**dependency evidence**, show the accepted relationship types/lags, and flag
missing, circular, lead/excessive-lag and hard-constraint conditions.

## Acceptance evidence

| Requirement | Implemented evidence |
|---|---|
| MIL-001 | The active schedule supplies `isMilestone`; one explicit action creates every unmatched source-linked milestone and shows the source activity ID. Missing source milestones block report publication. |
| MIL-002 | Outcome/forecast minus baseline uses calendar-day arithmetic and displays signed variance. |
| MIL-003 | A pure reporting-date function covers complete-on-time, complete-late, on-track, forecast-late, overdue and data-issue boundaries. Status is not user-selectable. |
| MIL-004 | All, Exceptions and Next 30 days views use the active imported data date; the boundary is component-tested. |
| MIL-005 | Adverse save requires cause, recovery action, action owner, due date, decision required and control commentary. |
| MIL-006 | Overview and weekly report recalculate status from the same source dates. The report includes every adverse condition and blocks publication for missing recovery evidence. |
| MIL-007 | An iterative graph walk exposes accepted predecessor IDs, names, link types, lags and depth. Missing links/cycles are unresolved; negative or excessive lag and hard constraints are warnings. A 1,500-activity regression proves non-recursive traversal. |
| MIL-008 | Separate cause, recovery action, action owner, due date and management-decision fields are persisted, displayed and included in the weekly report. |
| MIL-009 | The register and report show baseline, previous forecast, current forecast/actual and calendar-day movement. Refreshing a source link advances the old current forecast to previous while preserving recovery evidence. |

## Status rules

1. An actual date on or before baseline is complete on time.
2. An actual date after baseline is complete late.
3. A future actual date relative to the active reporting date is a data issue.
4. Without an actual, a forecast before the reporting date is overdue.
5. Otherwise, a forecast after baseline is forecast late.
6. Otherwise, the milestone is on track.
7. Invalid or contradictory date input is never silently converted to a valid
   management status.

The reporting-date equality boundary is current, not overdue.

## Data-integrity decisions

- The stored `status` remains as a compatibility/cache field, but the register,
  Overview and report derive it again from dates and the active reporting date.
- Version-0/legacy local-storage records migrate non-lossily. Missing new fields
  remain visibly incomplete; migration never invents recovery evidence.
- A linked refresh uses the latest accepted schedule facts for name, owner,
  baseline, forecast, actual and dependency evidence. Human-entered cause,
  recovery, decision and commentary are preserved.
- Unresolved or unlinked dependency evidence blocks weekly-report publication
  for an adverse milestone. A warning trace remains visible but does not claim
  the forecast is critical.

## Interface and accessibility evidence

- Every page action is explained in the three-step page guide.
- The compact register uses six decision-oriented columns, with detailed
  dependency and recovery evidence behind a labelled, keyboard-operable row
  control.
- The row control exposes `aria-expanded`; status and logic quality retain text
  labels rather than relying on colour.
- The filter control exposes `aria-pressed`, and all native form fields keep
  visible labels.
- The detail view explicitly states that it is not a calculated critical path.
- Responsive rules stack the detail panels and input actions on narrow screens;
  reduced-motion behavior continues to use the application-wide preference.

## Automated evidence

- Pure boundary and graph tests cover all six statuses, reporting-date equality,
  recovery completeness, missing predecessors, cycles, a converging diamond,
  lead/constraint warnings, a 1,500-activity chain and source-record creation.
- Schema tests prove status is derived, complete adverse recovery is accepted
  and each missing field blocks save.
- Persistence migration proves legacy commentary is retained and no recovery
  action is manufactured.
- Component journeys cover manual adverse entry, eight-milestone source import,
  dependency expansion, source refresh with recovery preservation, Exceptions
  filtering and Next 30 days filtering.
- Weekly-report tests prove stale stored status cannot override the active data
  date, missing recovery blocks publication, movement fields reconcile, and
  missing dependency evidence is a separate publication control.
- All pre-existing risk and change schema regressions remain in the gate; M4
  coverage was added without replacing adjacent control evidence.

## Visual and supporting review evidence

- The production build was inspected at the normal desktop viewport with the
  controlled editor open. Page guidance, reporting-date explanation, the
  adverse-recovery fieldset and all visible labels were readable without UI
  collision.
- At 390 × 844 the document, body and viewport widths each measured exactly
  390 px; the form and detail layouts stack at the narrow breakpoint. No browser
  warning or error was recorded.
- Hermes was invited to perform a read-only diff review. Its response used
  placeholder paths and repeated the supplied review checklist, so it is not
  claimed as an independent approval. Each checklist item was instead traced to
  the concrete domain/schema/component tests described above.
- The signed AppKit/WebKit package was rebuilt, verified against the production
  `dist` directory byte-for-byte and relaunched from the Desktop link.

## Bounded limitations outside M4

- Management registers still use local-storage persistence rather than the
  revisioned Dexie evidence repository. They are not included in the current
  active-generation backup and are not safe for multi-tab collaborative edits.
- A formal CPM/longest-path engine, total-float evidence and working-time
  calendar definitions are not present. The app makes no critical-path claim.
- Moderated usability research and the full release browser/accessibility matrix
  remain M8 evidence, not hidden M4 acceptance claims.

## Decision

M4 meets its technical exit criteria and can be treated as complete for the
evidence-weighted build position. The application remains pre-release until the
M8 gate is satisfied.
