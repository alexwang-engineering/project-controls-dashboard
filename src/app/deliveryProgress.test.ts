import { describe, expect, it } from "vitest";
import { deliveryMilestones, deliveryProgress } from "./deliveryProgress";

describe("delivery progress", () => {
  it("reconciles the evidence-weighted assessment to the 94-hour plan", () => {
    expect(deliveryMilestones).toHaveLength(9);
    expect(deliveryProgress.totalPlannedHours).toBe(94);
    expect(deliveryProgress.evidencedPlanHours).toBe(86.4);
    expect(deliveryProgress.completionPercent).toBe(92);
    expect(deliveryMilestones.find(({ id }) => id === "M4")).toMatchObject({
      completionPercent: 100,
    });
  });

  it("records the evidenced cross-browser, accessibility and security M8 gate", () => {
    expect(deliveryMilestones.find(({ id }) => id === "M8")).toMatchObject({
      completionPercent: 75,
    });
  });

  it("records the independently approved M1 gate as complete", () => {
    expect(deliveryMilestones.find(({ id }) => id === "M1")).toMatchObject({
      completionPercent: 100,
    });
  });

  it("records the evidenced M3 forecasting and report reconciliation", () => {
    expect(deliveryMilestones.find(({ id }) => id === "M3")).toMatchObject({
      completionPercent: 95,
    });
  });

  it("records the global M2 work-package scope", () => {
    expect(deliveryMilestones.find(({ id }) => id === "M2")).toMatchObject({
      completionPercent: 90,
    });
  });

  it("records the evidenced M7 publication and print boundary", () => {
    expect(deliveryMilestones.find(({ id }) => id === "M7")).toMatchObject({
      completionPercent: 95,
    });
  });

  it("records the controlled M6 workflow and decision history", () => {
    expect(deliveryMilestones.find(({ id }) => id === "M6")).toMatchObject({
      completionPercent: 100,
    });
  });

  it("records the evidenced M5 risk-control workflow", () => {
    expect(deliveryMilestones.find(({ id }) => id === "M5")).toMatchObject({
      completionPercent: 90,
    });
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
