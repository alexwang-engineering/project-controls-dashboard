import { describe, expect, it } from "vitest";
import type { Milestone } from "./types";
import {
  buildMilestoneDependencyTrace,
  milestoneFromScheduleActivity,
  milestoneStatusAt,
  missingMilestoneRecoveryFields,
  type MilestoneDependencyActivity,
} from "./milestones";

const activity = (
  overrides: Partial<MilestoneDependencyActivity>,
): MilestoneDependencyActivity => ({
  id: "A-001",
  wbsId: "WP100",
  name: "Foundation released",
  owner: "Civil lead",
  baselineFinish: "2026-06-01",
  forecastFinish: "2026-06-01",
  predecessorLinks: [],
  constraintType: "none",
  isMilestone: false,
  commentary: "Accepted schedule evidence.",
  ...overrides,
});

const milestone = (overrides: Partial<Milestone> = {}): Milestone => ({
  id: "MS-001",
  name: "Mechanical completion",
  wbsId: "WP300",
  owner: "Mechanical lead",
  baselineDate: "2026-06-14",
  previousForecastDate: "2026-06-16",
  forecastDate: "2026-06-21",
  status: "forecast-late",
  commentary: "The completion forecast requires managed recovery.",
  ...overrides,
});

describe("milestone status at the active reporting date", () => {
  it.each([
    [
      "complete-on-time",
      { baselineDate: "2026-06-14", forecastDate: "2026-06-14", actualDate: "2026-06-13" },
      "2026-06-14",
    ],
    [
      "complete-late",
      { baselineDate: "2026-06-14", forecastDate: "2026-06-14", actualDate: "2026-06-15" },
      "2026-06-21",
    ],
    [
      "on-track",
      { baselineDate: "2026-06-21", forecastDate: "2026-06-21" },
      "2026-06-14",
    ],
    [
      "forecast-late",
      { baselineDate: "2026-06-14", forecastDate: "2026-06-21" },
      "2026-06-14",
    ],
    [
      "overdue",
      { baselineDate: "2026-06-10", forecastDate: "2026-06-13" },
      "2026-06-14",
    ],
    [
      "data-issue",
      { baselineDate: "2026-06-14", forecastDate: "2026-06-14", actualDate: "2026-06-15" },
      "2026-06-14",
    ],
  ] as const)("derives %s from dates", (expected, dates, reportingDate) => {
    expect(milestoneStatusAt(dates, reportingDate)).toBe(expected);
  });

  it("treats the reporting-date boundary as current rather than overdue", () => {
    expect(
      milestoneStatusAt(
        { baselineDate: "2026-06-14", forecastDate: "2026-06-14" },
        "2026-06-14",
      ),
    ).toBe("on-track");
  });
});

describe("milestone recovery completeness", () => {
  it("requires every structured recovery field for an adverse milestone", () => {
    expect(missingMilestoneRecoveryFields(milestone())).toEqual([
      "cause",
      "recoveryAction",
      "actionOwner",
      "actionDueDate",
      "decisionRequired",
    ]);
  });

  it("does not manufacture recovery requirements for an on-track milestone", () => {
    expect(
      missingMilestoneRecoveryFields(
        milestone({ status: "on-track", forecastDate: "2026-06-14" }),
      ),
    ).toEqual([]);
  });
});

describe("milestone predecessor evidence", () => {
  it("walks the accepted predecessor chain iteratively without claiming CPM", () => {
    const trace = buildMilestoneDependencyTrace(
      [
        activity({ id: "A-001" }),
        activity({
          id: "A-002",
          name: "Equipment aligned",
          predecessorLinks: [{ activityId: "A-001", type: "SS", lagDays: 1 }],
        }),
        activity({
          id: "A-003",
          name: "Mechanical completion",
          isMilestone: true,
          predecessorLinks: [{ activityId: "A-002", type: "FS", lagDays: 0 }],
        }),
      ],
      "A-003",
    );

    expect(trace.quality).toBe("credible");
    expect(trace.chain.map(({ activityId }) => activityId)).toEqual([
      "A-002",
      "A-001",
    ]);
    expect(trace.chain[0]).toMatchObject({ type: "FS", lagDays: 0, depth: 1 });
    expect(trace.issues).toEqual([]);
  });

  it("flags lag and constraint warnings without rejecting the accepted chain", () => {
    const trace = buildMilestoneDependencyTrace(
      [
        activity({ id: "A-001", constraintType: "must-finish-on" }),
        activity({
          id: "A-002",
          isMilestone: true,
          predecessorLinks: [{ activityId: "A-001", type: "FS", lagDays: -1 }],
        }),
      ],
      "A-002",
    );

    expect(trace.quality).toBe("warning");
    expect(trace.issues.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["negative-lag", "hard-constraint"]),
    );
  });

  it("stops and exposes unresolved missing or circular logic", () => {
    const missing = buildMilestoneDependencyTrace(
      [
        activity({
          id: "A-002",
          isMilestone: true,
          predecessorLinks: [{ activityId: "A-999", type: "FS", lagDays: 0 }],
        }),
      ],
      "A-002",
    );
    const cycle = buildMilestoneDependencyTrace(
      [
        activity({
          id: "A-001",
          predecessorLinks: [{ activityId: "A-002", type: "FS", lagDays: 0 }],
        }),
        activity({
          id: "A-002",
          isMilestone: true,
          predecessorLinks: [{ activityId: "A-001", type: "FS", lagDays: 0 }],
        }),
      ],
      "A-002",
    );

    expect(missing).toMatchObject({ quality: "unresolved" });
    expect(missing.issues.map(({ code }) => code)).toContain("missing-predecessor");
    expect(cycle).toMatchObject({ quality: "unresolved" });
    expect(cycle.issues.map(({ code }) => code)).toContain("cycle");
  });

  it("does not misclassify a converging dependency as a cycle", () => {
    const trace = buildMilestoneDependencyTrace(
      [
        activity({ id: "A-001" }),
        activity({
          id: "A-002",
          predecessorLinks: [{ activityId: "A-001", type: "FS", lagDays: 0 }],
        }),
        activity({
          id: "A-003",
          predecessorLinks: [{ activityId: "A-001", type: "FS", lagDays: 0 }],
        }),
        activity({
          id: "A-004",
          isMilestone: true,
          predecessorLinks: [
            { activityId: "A-002", type: "FS", lagDays: 0 },
            { activityId: "A-003", type: "FS", lagDays: 0 },
          ],
        }),
      ],
      "A-004",
    );

    expect(trace.issues.map(({ code }) => code).filter((code) => code === "cycle"))
      .toHaveLength(0);
  });

  it("traces a long chain without recursive stack growth", () => {
    const activities = Array.from({ length: 1_500 }, (_, index) =>
      activity({
        id: `A-${String(index + 1).padStart(4, "0")}`,
        isMilestone: index === 1_499,
        predecessorLinks:
          index === 0
            ? []
            : [
                {
                  activityId: `A-${String(index).padStart(4, "0")}`,
                  type: "FS",
                  lagDays: 0,
                },
              ],
      }),
    );

    const trace = buildMilestoneDependencyTrace(activities, "A-1500");

    expect(trace).toMatchObject({ quality: "credible" });
    expect(trace.chain).toHaveLength(1_499);
  });

  it("creates a source-linked register record without inventing recovery evidence", () => {
    const record = milestoneFromScheduleActivity(
      activity({
        id: "A-060",
        name: "Operational handover",
        isMilestone: true,
        baselineFinish: "2026-07-26",
        forecastFinish: "2026-08-03",
      }),
      "2026-06-14",
      "2026-07-20T19:00:00.000Z",
    );

    expect(record).toMatchObject({
      id: "A-060",
      sourceActivityId: "A-060",
      status: "forecast-late",
      previousForecastDate: "2026-08-03",
      updatedAt: "2026-07-20T19:00:00.000Z",
    });
    expect(record.recoveryAction).toBeUndefined();
  });
});
