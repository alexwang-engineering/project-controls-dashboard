import type { EarnedValueResult } from "./earnedValue";

export type EacScenarioId = "budget-rate" | "cpi" | "composite";

export interface EacScenario {
  id: EacScenarioId;
  label: string;
  shortLabel: string;
  formula: string;
  assumption: string;
  value: number | null;
  available: boolean;
  unavailableReason?: string;
}

export function buildEacScenarios(
  metrics: Pick<
    EarnedValueResult,
    "eacBudgetRate" | "eacCpi" | "eacComposite" | "cpi" | "spi" | "ac"
  >,
): readonly EacScenario[] {
  const cpiUnavailableReason =
    metrics.ac === 0
      ? "CPI is unavailable because actual cost is zero."
      : "CPI is unavailable for the selected scope.";

  return [
    {
      id: "budget-rate",
      label: "Budget-rate EAC",
      shortLabel: "Budget rate",
      formula: "AC + WR",
      assumption:
        "Remaining work is delivered at its original budgeted rate; current inefficiency does not continue.",
      value: metrics.eacBudgetRate,
      available: true,
    },
    {
      id: "cpi",
      label: "CPI-continuation EAC",
      shortLabel: "CPI continues",
      formula: "AC + WR ÷ CPI",
      assumption:
        "Cumulative cost efficiency continues for all remaining work.",
      value: metrics.eacCpi,
      available: metrics.eacCpi !== null,
      ...(metrics.eacCpi === null
        ? { unavailableReason: cpiUnavailableReason }
        : {}),
    },
    {
      id: "composite",
      label: "CPI × SPI sensitivity",
      shortLabel: "Cost and schedule",
      formula: "AC + WR ÷ (CPI × SPI)",
      assumption:
        "Both cumulative cost and schedule efficiency affect remaining work; this is a sensitivity case, not an automatic prediction.",
      value: metrics.eacComposite,
      available: metrics.eacComposite !== null,
      ...(metrics.eacComposite === null
        ? {
            unavailableReason:
              metrics.cpi === null
                ? cpiUnavailableReason
                : "SPI is unavailable because planned value is zero.",
          }
        : {}),
    },
  ];
}
