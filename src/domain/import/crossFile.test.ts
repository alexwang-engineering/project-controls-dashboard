import { describe, expect, it } from "vitest";
import {
  projectConfiguration,
  sourcedActivity,
  sourcedPerformance,
} from "../../test/factories/importRows";
import {
  confirmFirstImportConfiguration,
  proposeProjectConfiguration,
} from "./projectConfiguration";
import { validateCrossFile } from "./crossFile";

const codes = (issues: ReturnType<typeof validateCrossFile>["issues"]) =>
  issues.map((issue) => issue.code);

describe("candidate-only cross-file validation", () => {
  it("blocks both rows of a duplicate schedule key", () => {
    const activities = [sourcedActivity({}, 2), sourcedActivity({}, 9)];
    const result = validateCrossFile({
      activities,
      performance: [],
      configuration: projectConfiguration(activities),
    });

    expect(
      result.issues
        .filter((issue) => issue.code === "duplicate_activity_id")
        .map((issue) => issue.recordNumber),
    ).toEqual([2, 9]);
  });

  it("blocks both rows of a duplicate activity-period key", () => {
    const activities = [sourcedActivity()];
    const result = validateCrossFile({
      activities,
      performance: [sourcedPerformance({}, 3), sourcedPerformance({}, 11)],
      configuration: projectConfiguration(activities),
    });

    expect(
      result.issues
        .filter((issue) => issue.code === "duplicate_performance_key")
        .map((issue) => issue.recordNumber),
    ).toEqual([3, 11]);
  });

  it("blocks performance for an unknown activity", () => {
    const activities = [sourcedActivity()];
    const result = validateCrossFile({
      activities,
      performance: [sourcedPerformance({ activity_id: "A-999" })],
      configuration: projectConfiguration(activities),
    });

    expect(codes(result.issues)).toContain("unknown_activity_reference");
  });

  it("blocks project and baseline disagreement between files", () => {
    const activities = [sourcedActivity()];
    const result = validateCrossFile({
      activities,
      performance: [
        sourcedPerformance({ project_id: "ORION", baseline_version: "B1" }),
      ],
      configuration: projectConfiguration(activities),
    });

    expect(codes(result.issues)).toEqual(
      expect.arrayContaining([
        "project_id_mismatch",
        "baseline_version_mismatch",
      ]),
    );
  });

  it("blocks cumulative EV above budget and names the exact pence total", () => {
    const activities = [sourcedActivity({ baseline_budget: "1000" })];
    const result = validateCrossFile({
      activities,
      performance: [
        sourcedPerformance({ period_end: "2026-04-12", ev_period: "600" }),
        sourcedPerformance({ period_end: "2026-04-19", ev_period: "500" }, 3),
      ],
      configuration: projectConfiguration(activities),
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "earned_value_exceeds_budget",
        suppliedValue: "110000 pence cumulative EV",
      }),
    );
  });

  it("warns when distinct project periods are not seven days apart", () => {
    const activities = [sourcedActivity()];
    const result = validateCrossFile({
      activities,
      performance: [
        sourcedPerformance({ period_end: "2026-04-12" }),
        sourcedPerformance({ period_end: "2026-04-26" }, 3),
      ],
      configuration: projectConfiguration(activities),
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "reporting_period_gap",
        suppliedValue: "2026-04-12 to 2026-04-26",
      }),
    );
  });

  it("derives the data date from performance and blocks later actuals", () => {
    const activities = [
      sourcedActivity({ actual_start: "2026-04-13", actual_finish: "" }),
    ];
    const result = validateCrossFile({
      activities,
      performance: [sourcedPerformance({ period_end: "2026-04-12" })],
      configuration: projectConfiguration(activities),
    });

    expect(result.dataDate).toBe("2026-04-12");
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "actual_after_data_date",
        column: "actual_start",
      }),
    );
  });

  it("uses confirmed proposed registries for a first import without writing", () => {
    const activities = [
      sourcedActivity({ wbs_id: "WP900", calendar_id: "CAL-7D" }),
    ];
    const proposed = proposeProjectConfiguration(activities);

    expect(proposed).toMatchObject({
      source: "proposed",
      workPackageIds: ["WP900"],
      calendarIds: ["CAL-7D"],
    });
    expect(proposed && confirmFirstImportConfiguration(proposed, false)).toBeUndefined();
    expect(proposed && confirmFirstImportConfiguration(proposed, true)).toBe(proposed);
    expect(
      proposed &&
        validateCrossFile({
          activities,
          performance: [sourcedPerformance()],
          configuration: proposed,
        }).issues.filter((issue) => issue.code.startsWith("unknown_")),
    ).toEqual([]);
  });

  it("blocks unknown IDs against an active registry without mutating it", () => {
    const configuredActivity = sourcedActivity();
    const configuration = projectConfiguration([configuredActivity], {
      source: "active",
    });
    const originalWorkPackages = [...configuration.workPackageIds];
    const originalCalendars = [...configuration.calendarIds];
    const candidate = sourcedActivity({ wbs_id: "WP900", calendar_id: "CAL-7D" });

    const result = validateCrossFile({
      activities: [candidate],
      performance: [],
      configuration,
    });

    expect(codes(result.issues)).toEqual(
      expect.arrayContaining(["unknown_work_package", "unknown_calendar"]),
    );
    expect(configuration.workPackageIds).toEqual(originalWorkPackages);
    expect(configuration.calendarIds).toEqual(originalCalendars);
  });
});
