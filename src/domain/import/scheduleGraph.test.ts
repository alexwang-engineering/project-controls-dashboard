import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import type { ActivityId } from "../records";
import {
  projectConfiguration,
  sourcedActivity,
} from "../../test/factories/importRows";
import { validateScheduleGraph } from "./scheduleGraph";

const issueCodes = (issues: ReturnType<typeof validateScheduleGraph>) =>
  issues.map((issue) => issue.code);

describe("iterative candidate schedule graph validation", () => {
  it("blocks a self-link", () => {
    const activities = [sourcedActivity({ predecessor_links: "A-001|FS|0" })];
    const issues = validateScheduleGraph({
      activities,
      configuration: projectConfiguration(activities),
    });

    expect(issues).toContainEqual(
      expect.objectContaining({ code: "self_link", suppliedValue: "A-001" }),
    );
  });

  it("blocks a missing predecessor reference", () => {
    const activities = [sourcedActivity({ predecessor_links: "A-999|FS|0" })];
    const issues = validateScheduleGraph({
      activities,
      configuration: projectConfiguration(activities),
    });

    expect(issueCodes(issues)).toContain("missing_predecessor");
  });

  it.each([
    [
      "two-node",
      [
        sourcedActivity(
          { activity_id: "A-001", predecessor_links: "A-002|FS|0" },
          2,
        ),
        sourcedActivity(
          { activity_id: "A-002", predecessor_links: "A-001|FS|0" },
          3,
        ),
      ],
      ["A-001", "A-002"],
    ],
    [
      "three-node",
      [
        sourcedActivity(
          { activity_id: "A-001", predecessor_links: "A-003|FS|0" },
          2,
        ),
        sourcedActivity(
          { activity_id: "A-002", predecessor_links: "A-001|FS|0" },
          3,
        ),
        sourcedActivity(
          { activity_id: "A-003", predecessor_links: "A-002|FS|0" },
          4,
        ),
      ],
      ["A-001", "A-002", "A-003"],
    ],
  ])("identifies every member and an example path for a %s cycle", (_, activities, ids) => {
    const issues = validateScheduleGraph({
      activities,
      configuration: projectConfiguration(activities),
    });
    const cycle = issues.find((issue) => issue.code === "schedule_cycle");

    expect(cycle?.suppliedValue).toBe(ids.join(", "));
    expect(cycle?.rule).toContain("→");
    for (const id of ids) expect(cycle?.rule).toContain(id);
  });

  it("reports only cycle members when another component is a valid DAG", () => {
    const activities = [
      sourcedActivity(
        { activity_id: "A-001", predecessor_links: "A-002|FS|0" },
        2,
      ),
      sourcedActivity(
        { activity_id: "A-002", predecessor_links: "A-001|FS|0" },
        3,
      ),
      sourcedActivity({ activity_id: "A-100", predecessor_links: "" }, 4),
      sourcedActivity(
        { activity_id: "A-101", predecessor_links: "A-100|FS|0" },
        5,
      ),
    ];
    const configuration = projectConfiguration(activities, {
      authorisedStartActivityIds: ["A-100" as ActivityId],
      authorisedFinishActivityIds: ["A-101" as ActivityId],
    });
    const cycleIssues = validateScheduleGraph({ activities, configuration }).filter(
      (issue) => issue.code === "schedule_cycle",
    );

    expect(cycleIssues).toHaveLength(1);
    expect(cycleIssues[0]?.suppliedValue).toBe("A-001, A-002");
    expect(cycleIssues[0]?.suppliedValue).not.toContain("A-100");
  });

  it("excludes a node downstream of a cycle from the cycle membership", () => {
    const activities = [
      sourcedActivity(
        { activity_id: "A-001", predecessor_links: "A-002|FS|0" },
        2,
      ),
      sourcedActivity(
        { activity_id: "A-002", predecessor_links: "A-001|FS|0" },
        3,
      ),
      sourcedActivity(
        { activity_id: "A-003", predecessor_links: "A-002|FS|0" },
        4,
      ),
    ];
    const cycle = validateScheduleGraph({
      activities,
      configuration: projectConfiguration(activities),
    }).find((issue) => issue.code === "schedule_cycle");

    expect(cycle?.suppliedValue).toBe("A-001, A-002");
    expect(cycle?.suppliedValue).not.toContain("A-003");
  });

  it("warns for negative and excessive lag", () => {
    const activities = [
      sourcedActivity({ activity_id: "A-001", predecessor_links: "" }),
      sourcedActivity({
        activity_id: "A-002",
        predecessor_links: "A-001|FS|-1",
      }),
      sourcedActivity({
        activity_id: "A-003",
        predecessor_links: "A-002|FS|6",
      }),
    ];
    const issues = validateScheduleGraph({
      activities,
      configuration: projectConfiguration(activities),
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "warning", code: "negative_lag" }),
        expect.objectContaining({ severity: "warning", code: "excessive_lag" }),
      ]),
    );
  });

  it("warns on both open ends for an unauthorised isolated activity", () => {
    const activities = [sourcedActivity()];
    const issues = validateScheduleGraph({
      activities,
      configuration: projectConfiguration(activities),
    });

    expect(issueCodes(issues)).toEqual(
      expect.arrayContaining(["open_start", "open_finish"]),
    );
  });

  it("warns on a hard constraint", () => {
    const activities = [
      sourcedActivity({
        constraint_type: "must-start-on",
        constraint_date: "2026-04-06",
      }),
    ];
    const issues = validateScheduleGraph({
      activities,
      configuration: projectConfiguration(activities),
    });

    expect(issueCodes(issues)).toContain("hard_constraint");
  });

  it("validates a 10,000-node chain without recursion in under 500 ms", () => {
    const activities = Array.from({ length: 10_000 }, (_, index) => {
      const current = "A-" + String(index + 1).padStart(5, "0");
      const predecessor = "A-" + String(index).padStart(5, "0");
      return sourcedActivity(
        {
          activity_id: current,
          predecessor_links: index === 0 ? "" : predecessor + "|FS|0",
        },
        index + 2,
      );
    });
    const configuration = projectConfiguration(activities, {
      authorisedStartActivityIds: ["A-00001" as ActivityId],
      authorisedFinishActivityIds: ["A-10000" as ActivityId],
    });

    const start = performance.now();
    const issues = validateScheduleGraph({ activities, configuration });
    const elapsed = performance.now() - start;

    expect(issues).toEqual([]);
    expect(elapsed).toBeLessThan(500);
  });
});
