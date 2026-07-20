import { describe, expect, it } from "vitest";
import { migrateProjectStoreState } from "./store";

describe("management-register persistence migration", () => {
  it("preserves a legacy milestone without inventing new recovery evidence", () => {
    const legacy = {
      milestones: [
        {
          id: "MS-001",
          name: "Mechanical completion",
          wbsId: "WP300",
          owner: "Mechanical lead",
          baselineDate: "2026-06-14",
          previousForecastDate: "2026-06-16",
          forecastDate: "2026-06-21",
          status: "forecast-late",
          commentary: "Legacy recovery commentary remains intact.",
        },
      ],
      risks: [],
      changes: [],
    };

    const migrated = migrateProjectStoreState(legacy, 0) as typeof legacy;

    expect(migrated.milestones[0]).toEqual(legacy.milestones[0]);
    expect(migrated.milestones[0]).not.toHaveProperty("recoveryAction");
  });
});
