import { describe, expect, it } from "vitest";
import { encodeCsv } from "../../utils/safeCsvExport";
import { processImportFiles } from "./importProcessor";

const scheduleHeader = [
  "project_id", "baseline_version", "activity_id", "wbs_id",
  "activity_name", "owner", "baseline_start", "baseline_finish",
  "forecast_start", "forecast_finish", "actual_start", "actual_finish",
  "predecessor_links", "calendar_id", "constraint_type", "constraint_date",
  "is_milestone", "baseline_budget", "progress_method", "commentary",
];

const performanceHeader = [
  "project_id", "baseline_version", "period_end", "activity_id",
  "pv_period", "ev_period", "ac_period", "physical_percent_complete",
  "remaining_cost_forecast", "progress_commentary",
];

const activityId = (index: number) => `A-${String(index).padStart(4, "0")}`;

describe("M1 import performance evidence", () => {
  it("processes 1,000 activities through the real parser and validator in under two seconds", async () => {
    const scheduleRows = Array.from({ length: 1_000 }, (_, offset) => {
      const index = offset + 1;
      return [
        "PERF", "B0", activityId(index), "WP100",
        `Performance evidence activity ${index}`, "Controls lead",
        "2026-04-06", "2026-04-10", "2026-04-06", "2026-04-10",
        "", "", index === 1 ? "" : `${activityId(index - 1)}|FS|0`,
        "CAL-5D", "none", "", "false", "1000", "percent_complete",
        "Deterministic performance fixture.",
      ];
    });
    const performanceRows = Array.from({ length: 1_000 }, (_, offset) => [
      "PERF", "B0", "2026-04-12", activityId(offset + 1),
      "0", "0", "0", "0", "1000", "Performance fixture.",
    ]);
    const encoder = new TextEncoder();
    const startedAt = performance.now();
    const result = await processImportFiles({
      schedule: {
        kind: "schedule",
        fileName: "performance-schedule.csv",
        bytes: encoder.encode(encodeCsv([scheduleHeader, ...scheduleRows])).buffer,
      },
      performance: {
        kind: "performance",
        fileName: "performance-period.csv",
        bytes: encoder.encode(encodeCsv([performanceHeader, ...performanceRows])).buffer,
      },
    });
    const durationMs = performance.now() - startedAt;

    expect(result.preview?.canCommit).toBe(true);
    expect(result.preview?.scheduleCounts.acceptedRows).toBe(1_000);
    expect(result.preview?.performanceCounts.acceptedRows).toBe(1_000);
    expect(durationMs).toBeLessThan(2_000);
  });
});
