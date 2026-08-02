import { describe, expect, it } from "vitest";
import { controlRoute, controlViews } from "./controlViews";

describe("control views", () => {
  it("provides the five governed named views", () => {
    expect(controlViews.map(({ label }) => label)).toEqual([
      "Executive position",
      "Overdue actions",
      "Forecast threats",
      "Pending decisions",
      "Data-quality exceptions",
    ]);
  });

  it("builds a bookmarkable route without adding a full-project scope", () => {
    expect(
      controlRoute({
        pathname: "/changes",
        parameters: { view: "pending" },
        scope: "all",
        reportingDate: "2026-08-02",
      }),
    ).toBe("/changes?view=pending&date=2026-08-02");
  });

  it("preserves work-package context in a saved view", () => {
    expect(
      controlRoute({
        pathname: "/milestones",
        parameters: { filter: "exceptions" },
        scope: "WP300",
        reportingDate: "2026-08-02",
      }),
    ).toBe("/milestones?filter=exceptions&scope=WP300&date=2026-08-02");
  });
});
