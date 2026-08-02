# ADR-0006: Performance threshold semantics

## Status

Accepted for the Project Control Panel Phase 0 baseline on 2 August 2026.

## Context

Master Plan v1.1 defines SPI and CPI control thresholds as green at or above 0.98, amber from 0.95 to below 0.98, and red below 0.95. A later overview work-in-progress split “on plan” from “within tolerance”, but unintentionally collapsed the approved amber and red conditions into one recovery state below 0.98.

That collapse made a small tolerance breach look identical to a material recovery condition and allowed the UI, variance gate, and weekly-report wording to describe the same number differently.

## Decision

SPI and CPI use four explicit textual meanings while retaining the approved three control tones:

| Value | Meaning | Control tone | Variance analysis |
|---:|---|---|---|
| `>= 1.00` | On plan | Positive | Not required by SPI/CPI |
| `0.98–<1.00` | Within tolerance | Positive | Not required by SPI/CPI |
| `0.95–<0.98` | Attention required | Attention | Required |
| `<0.95` | Recovery required | Adverse | Required |
| Unavailable | Unavailable | Neutral | Not inferred |

The boundary functions live in the pure earned-value calculation module. Overview cards, Schedule & Cost cards and rows, variance analysis, and weekly-report headlines consume those functions rather than repeating numeric literals.

Forecast-finish variance retains the Master Plan boundaries: up to zero days late is controlled, one to five days late requires attention, and more than five days late requires recovery.

## Consequences

- “On plan” and “within tolerance” are distinct in text without claiming that 0.99 equals 1.00.
- An amber performance condition still opens the governed variance-analysis workflow at below 0.98.
- “Recovery required” is reserved for the red condition below 0.95.
- Missing values remain unavailable and are never converted to a controlled status.
- Project-configurable, authorised, revisioned performance thresholds remain a later controlled enhancement; until then these documented defaults are the single source of truth.
