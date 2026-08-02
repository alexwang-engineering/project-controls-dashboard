import { describe, expect, it } from "vitest";
import {
  calculateEarnedValue,
  efficiencyStatus,
  efficiencyStatusLabel,
  isEfficiencyBreach,
} from "./earnedValue";

describe("calculateEarnedValue", () => {
  it("reproduces the independently checked project fixture", () => {
    const result = calculateEarnedValue({
      bac: 2_400_000,
      pv: 1_500_000,
      ev: 1_350_000,
      ac: 1_440_000,
      managementEac: 2_560_000,
    });

    expect(result.sv).toBe(-150_000);
    expect(result.cv).toBe(-90_000);
    expect(result.spi).toBe(0.9);
    expect(result.cpi).toBe(0.9375);
    expect(result.workRemaining).toBe(1_050_000);
    expect(result.eacBudgetRate).toBe(2_490_000);
    expect(result.eacCpi).toBe(2_560_000);
    expect(result.eacComposite).toBeCloseTo(2_684_444.44, 2);
    expect(result.etc).toBe(1_120_000);
    expect(result.vac).toBe(-160_000);
    expect(result.tcpiBac).toBe(1.09375);
    expect(result.tcpiEac).toBe(0.9375);
    expect(result.plannedCompletion).toBe(0.625);
    expect(result.earnedCompletion).toBe(0.5625);
    expect(result.budgetSpent).toBe(0.6);
  });

  it("returns explicit unavailable states for zero denominators", () => {
    const result = calculateEarnedValue({
      bac: 0,
      pv: 0,
      ev: 0,
      ac: 0,
    });

    expect(result.spi).toBeNull();
    expect(result.cpi).toBeNull();
    expect(result.eacCpi).toBeNull();
    expect(result.eacComposite).toBeNull();
    expect(result.tcpiBac).toBeNull();
    expect(result.tcpiEac).toBeNull();
    expect(result.plannedCompletion).toBeNull();
    expect(result.earnedCompletion).toBeNull();
    expect(result.budgetSpent).toBeNull();
  });
});

describe("efficiencyStatus", () => {
  it.each([
    [1, "positive"],
    [0.9999, "attention"],
    [0.98, "attention"],
    [0.9799, "adverse"],
    [0.95, "adverse"],
    [null, "neutral"],
  ] as const)("maps %s to %s", (metric, expected) => {
    expect(efficiencyStatus(metric)).toBe(expected);
  });

  it("uses the same tolerance for labels and recovery breaches", () => {
    expect(efficiencyStatusLabel(1)).toBe("On plan");
    expect(efficiencyStatusLabel(0.99)).toBe("Within tolerance");
    expect(efficiencyStatusLabel(0.97)).toBe("Recovery required");
    expect(isEfficiencyBreach(0.98)).toBe(false);
    expect(isEfficiencyBreach(0.9799)).toBe(true);
  });
});
