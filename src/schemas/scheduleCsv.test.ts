import { describe, expect, it } from "vitest";
import {
  rawRecord,
  validScheduleRow,
} from "../test/factories/importRows";
import { validationCodeFromIssue } from "./fields";
import {
  SCHEDULE_CSV_HEADERS,
  scheduleRowSchema,
  validateScheduleCsvRows,
} from "./scheduleCsv";

const codesFor = (overrides: Parameters<typeof validScheduleRow>[0]) => {
  const result = scheduleRowSchema.safeParse(validScheduleRow(overrides));
  if (result.success) return [];
  return result.error.issues.map(validationCodeFromIssue);
};

describe("schedule CSV row boundary", () => {
  it("normalises a golden row into branded domain-shaped values", () => {
    expect(scheduleRowSchema.parse(validScheduleRow())).toMatchObject({
      projectId: "ASTER",
      baselineVersion: "B0",
      activityId: "A-001",
      wbsId: "WP100",
      predecessorLinks: [],
      baselineBudget: 10_000_000,
      progressMethod: "percent_complete",
    });
  });

  it.each([
    ["2026-02-30"],
    ["2026-13-01"],
    ["31/12/2026"],
    ["2026-1-1"],
    ["2026-04-05T00:00:00Z"],
  ])("blocks invalid or non-canonical date %s", (date) => {
    expect(codesFor({ baseline_start: date })).toContain("invalid_date");
  });

  it("blocks reversed baseline, forecast, and actual date pairs", () => {
    expect(codesFor({ baseline_finish: "2026-04-05" })).toContain(
      "invalid_date_order",
    );
    expect(codesFor({ forecast_finish: "2026-04-05" })).toContain(
      "invalid_date_order",
    );
    expect(codesFor({ actual_finish: "2026-04-05" })).toContain(
      "invalid_date_order",
    );
  });

  it("requires actual start before actual finish", () => {
    expect(codesFor({ actual_start: "", actual_finish: "2026-04-10" })).toContain(
      "actual_start_required",
    );
  });

  it("blocks non-zero milestone duration", () => {
    expect(codesFor({ is_milestone: "true" })).toContain("milestone_duration");
  });

  it("enforces constraint date in both directions", () => {
    expect(codesFor({ constraint_type: "must-start-on" })).toContain(
      "constraint_date_required",
    );
    expect(codesFor({ constraint_date: "2026-04-06" })).toContain(
      "unexpected_constraint_date",
    );
  });

  it.each(["1e5", "0x10", "1,000", "£100", "100.999"])(
    "blocks non-canonical money %s",
    (money) => {
      expect(codesFor({ baseline_budget: money })).toContain("invalid_money");
    },
  );

  it("preserves an all-digit ID as a string and blocks lowercase or underscore", () => {
    expect(scheduleRowSchema.parse(validScheduleRow({ activity_id: "007" })).activityId).toBe(
      "007",
    );
    expect(codesFor({ activity_id: "a_007" })).toContain("invalid_identifier");
  });

  it("enforces field-specific text limits", () => {
    expect(codesFor({ activity_name: "AB" })).toContain("invalid_length");
    expect(codesFor({ activity_name: "A".repeat(121) })).toContain(
      "invalid_length",
    );
    expect(codesFor({ commentary: "A".repeat(501) })).toContain(
      "invalid_length",
    );
  });

  it.each(["TRUE", "1", "yes"])("blocks non-canonical boolean %s", (value) => {
    expect(codesFor({ is_milestone: value })).toContain("invalid_boolean");
  });

  it("reports an empty required field with its stable machine code", () => {
    const result = validateScheduleCsvRows(
      "schedule.csv",
      SCHEDULE_CSV_HEADERS,
      [rawRecord(SCHEDULE_CSV_HEADERS, validScheduleRow({ activity_name: "" }))],
    );

    expect(result.records).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "required_field",
        column: "activity_name",
        suppliedValue: "",
      }),
    );
  });

  it("blocks an unsupported progress method and lists the MVP method", () => {
    const result = scheduleRowSchema.safeParse(
      validScheduleRow({ progress_method: "milestone_weight" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        params: { validationCode: "invalid_enum" },
        message: expect.stringContaining("percent_complete"),
      });
    }
  });

  it.each(["A-001|XX|0", "A-001|FS|1.5", "A-001|FS|0;", "A-001||0"])(
    "blocks malformed predecessor grammar %s",
    (links) => {
      expect(codesFor({ predecessor_links: links })).toContain(
        "invalid_relationship",
      );
    },
  );
});
