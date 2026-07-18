import { describe, expect, it } from "vitest";
import { deliveryMilestones, deliveryProgress } from "./deliveryProgress";

describe("delivery progress", () => {
  it("reconciles the evidence-weighted assessment to the 94-hour plan", () => {
    expect(deliveryMilestones).toHaveLength(9);
    expect(deliveryProgress.totalPlannedHours).toBe(94);
    expect(deliveryProgress.evidencedPlanHours).toBe(43.8);
    expect(deliveryProgress.completionPercent).toBe(47);
  });

  it("keeps every milestone assessment inside valid percentage bounds", () => {
    for (const milestone of deliveryMilestones) {
      expect(milestone.plannedHours).toBeGreaterThan(0);
      expect(milestone.completionPercent).toBeGreaterThanOrEqual(0);
      expect(milestone.completionPercent).toBeLessThanOrEqual(100);
      expect(milestone.evidence.length).toBeGreaterThan(0);
    }
  });
});
