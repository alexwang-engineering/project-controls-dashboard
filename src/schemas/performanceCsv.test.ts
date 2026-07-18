import { describe, expect, it } from "vitest";
import {
  rawRecord,
  validPerformanceRow,
} from "../test/factories/importRows";
import { validationCodeFromIssue } from "./fields";
import {
  PERFORMANCE_CSV_HEADERS,
  performanceRowSchema,
  validatePerformanceCsvRows,
} from "./performanceCsv";
import { formatValidationIssue } from "./validationIssue";

const codesFor = (overrides: Parameters<typeof validPerformanceRow>[0]) => {
  const result = performanceRowSchema.safeParse(validPerformanceRow(overrides));
  if (result.success) return [];
  return result.error.issues.map(validationCodeFromIssue);
};

describe("performance CSV row boundary", () => {
  it("normalises the golden row with integer-pence money", () => {
    expect(performanceRowSchema.parse(validPerformanceRow())).toEqual({
      projectId: "ASTER",
      baselineVersion: "B0",
      periodEnd: "2026-04-12",
      activityId: "A-001",
      pvPeriod: 2_500_000,
      evPeriod: 2_500_000,
      acPeriod: 2_400_000,
      physicalPercentComplete: 25,
      remainingCostForecast: 7_500_000,
      progressCommentary: "First reporting period",
    });
  });

  it("retains the negative-value code and produces a management-readable issue", () => {
    const row = validPerformanceRow({ ac_period: "-1200" });
    const result = validatePerformanceCsvRows(
      "performance.csv",
      PERFORMANCE_CSV_HEADERS,
      [rawRecord(PERFORMANCE_CSV_HEADERS, row, 18)],
    );

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      code: "negative_not_allowed",
      recordNumber: 18,
      column: "ac_period",
      suppliedValue: "-1200",
      rule: "Actual cost must be zero or positive.",
    });
    expect(formatValidationIssue(result.issues[0]!)).toBe(
      "performance.csv, record 18, field ac_period: “-1200” is invalid. Actual cost must be zero or positive. Correct the value or remove the record before importing again.",
    );
  });

  it("distinguishes formula-like numeric input from a negative number", () => {
    expect(codesFor({ ac_period: "=1+1" })).toContain("formula_like");
    expect(codesFor({ ac_period: "-1200" })).toContain("negative_not_allowed");
  });

  it.each(["-1", "100.5", "1e2", "NaN"])(
    "blocks invalid physical percentage %s",
    (value) => {
      expect(codesFor({ physical_percent_complete: value })).toContain(
        "invalid_percentage",
      );
    },
  );

  it("accepts a decimal physical percentage within range", () => {
    expect(
      performanceRowSchema.parse(
        validPerformanceRow({ physical_percent_complete: "37.5" }),
      ).physicalPercentComplete,
    ).toBe(37.5);
  });

  it("accepts a blank optional remaining-cost forecast", () => {
    expect(
      performanceRowSchema.parse(
        validPerformanceRow({ remaining_cost_forecast: "" }),
      ).remainingCostForecast,
    ).toBeUndefined();
  });
});
