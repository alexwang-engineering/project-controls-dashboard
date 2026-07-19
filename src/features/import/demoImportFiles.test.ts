import { describe, expect, it } from "vitest";
import { createSyntheticImportFiles } from "./demoImportFiles";
import { processImportFiles } from "./importProcessor";

describe("complete ASTER import demonstration pair", () => {
  it("passes the real pipeline with all agreed counts and control totals", async () => {
    const files = createSyntheticImportFiles();
    const result = await processImportFiles({
      schedule: {
        kind: "schedule",
        fileName: files.schedule.name,
        bytes: await files.schedule.arrayBuffer(),
      },
      performance: {
        kind: "performance",
        fileName: files.performance.name,
        bytes: await files.performance.arrayBuffer(),
      },
    });
    const activities = result.preview?.activities.map((record) => record.value) ?? [];
    const performance = result.preview?.performance.map((record) => record.value) ?? [];
    const total = (field: "pvPeriod" | "evPeriod" | "acPeriod") =>
      performance.reduce((sum, record) => sum + record[field], 0);

    expect(result.preview?.canCommit).toBe(true);
    expect(activities).toHaveLength(60);
    expect(activities.filter((activity) => activity.isMilestone)).toHaveLength(8);
    expect(new Set(activities.map((activity) => activity.wbsId)).size).toBe(5);
    expect(new Set(performance.map((record) => record.periodEnd)).size).toBe(16);
    expect(performance).toHaveLength(960);
    expect(
      activities.reduce((sum, activity) => sum + activity.baselineBudget, 0),
    ).toBe(240_000_000);
    expect(total("pvPeriod")).toBe(150_000_000);
    expect(total("evPeriod")).toBe(135_000_000);
    expect(total("acPeriod")).toBe(144_000_000);
    expect(result.preview?.dataDate).toBe("2026-06-14");
  });
});
