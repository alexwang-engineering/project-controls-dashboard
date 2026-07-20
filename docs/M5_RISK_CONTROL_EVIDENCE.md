# M5 risk-control evidence

**Evidence date:** 20 July 2026

**Milestone assessment:** 90%

**Scope:** Risk identification, prioritisation, control evidence and management exception routing

## Outcome

The risk page now supports the complete working management loop rather than a
residual-score display only. A user can describe a risk in cause–event–effect
form, compare inherent and residual exposure, record the previous residual
position, test a named control, assign a treatment and review date, and route
above-tolerance exposure to escalation or authorised acceptance.

The heatmap is a filterable ordinal view. It deliberately does not sum matrix
scores or present them as financial/probabilistic portfolio exposure.

## Control rules

1. Probability and impact are integers from 1 to 5.
2. Rating boundaries are Low 1–4, Moderate 5–9, High 10–14 and Critical 15–25.
3. Inherent and residual positions remain separate; neither overwrites the other.
4. Trend compares the previous residual score with the current residual score.
5. Default maximum tolerated residual score is 4 for safety/quality and 9 for
   schedule, cost and operational readiness.
6. A risk above tolerance cannot be recorded as within tolerance.
7. Escalation requires a named escalation owner and date.
8. Authorised acceptance requires an authority, rationale and review date.
9. A treatment or review is overdue only when its date is before the reporting
   date; the reporting-date boundary itself is not overdue.
10. Closed risks do not produce active exception flags.
11. Ineffective and not-yet-tested controls are explicit management exceptions.
12. The weekly report includes active high/critical exposure and control,
    trigger, tolerance, review or action exceptions.

## Interface evidence

- Owner, category, status and rating filters combine with AND logic.
- One exposure-basis control switches the heatmap and register together.
- Every 5 × 5 heatmap cell is a keyboard-operable button with a count and risk
  IDs in its accessible name; a selected cell filters the register.
- The current result count is announced and the risk table has an accessible
  caption.
- The exception queue identifies above-tolerance, overdue treatment, overdue
  review, breached-trigger, weak-control and missing-escalation evidence.
- Heatmap controls retain a 44 px minimum target and visible keyboard focus.
- The interface explains that the matrix is an ordinal prioritisation aid and
  does not aggregate exposure.

## Automated evidence

- Boundary tests cover all four rating bands.
- Domain tests cover separate exposures, objective tolerance, three trend
  directions, strict overdue dates and legacy escalation gaps.
- Validation tests cover derived scores, above-tolerance routing and complete
  authorised-acceptance evidence.
- Component tests cover AND filters, exposure switching, accessible cell
  selection, exception presentation and the full controlled-input journey.
- The application navigation test continues to exercise the heatmap through the
  routed application.

## Remaining before formal closure

- Move tolerances from documented defaults to a revisioned project appetite
  configuration with an authorised change history.
- Move the locally persisted management register behind revisioned storage and
  include it in the broader backup policy.
- Add an independent M5 closure review and moderated risk-page usability run.

These limits are why the milestone is assessed at 90%, not complete.
