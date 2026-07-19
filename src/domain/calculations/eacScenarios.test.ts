import { describe, expect, it } from "vitest";
import { calculateEarnedValue } from "./earnedValue";
import { buildEacScenarios } from "./eacScenarios";

describe("buildEacScenarios", () => {
  it("labels and reconciles the three independently checked forecast cases", () => {
    const scenarios = buildEacScenarios(
      calculateEarnedValue({
        bac: 2_400_000,
        pv: 1_500_000,
        ev: 1_350_000,
        ac: 1_440_000,
      }),
    );

    expect(scenarios).toEqual([
      expect.objectContaining({
        id: "budget-rate",
        label: "Budget-rate EAC",
        formula: "AC + WR",
        value: 2_490_000,
        available: true,
      }),
      expect.objectContaining({
        id: "cpi",
        label: "CPI-continuation EAC",
        formula: "AC + WR ÷ CPI",
        value: 2_560_000,
        available: true,
      }),
      expect.objectContaining({
        id: "composite",
        label: "CPI × SPI sensitivity",
        formula: "AC + WR ÷ (CPI × SPI)",
        value: 2_684_444.4444444445,
        available: true,
      }),
    ]);
  });

  it("marks only index-dependent cases unavailable when their denominator is missing", () => {
    const scenarios = buildEacScenarios(
      calculateEarnedValue({ bac: 100, pv: 0, ev: 0, ac: 0 }),
    );

    expect(scenarios.map(({ id, available }) => ({ id, available }))).toEqual([
      { id: "budget-rate", available: true },
      { id: "cpi", available: false },
      { id: "composite", available: false },
    ]);
    expect(scenarios[1]?.unavailableReason).toBe(
      "CPI is unavailable because actual cost is zero.",
    );
  });
});
