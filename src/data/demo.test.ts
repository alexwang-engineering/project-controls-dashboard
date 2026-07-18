import { describe, expect, it } from "vitest";
import { demoSnapshot } from "./demo";

describe("Aster demonstration snapshot", () => {
  it("meets the agreed portfolio dataset counts", () => {
    expect(demoSnapshot.workPackages).toHaveLength(5);
    expect(demoSnapshot.activities).toHaveLength(60);
    expect(demoSnapshot.trend).toHaveLength(16);
    expect(demoSnapshot.milestones).toHaveLength(8);
    expect(demoSnapshot.risks).toHaveLength(12);
    expect(demoSnapshot.changes).toHaveLength(6);
  });

  it("reconciles activity and work-package budgets to the original BAC", () => {
    const activityBac = demoSnapshot.activities.reduce(
      (total, activity) => total + activity.baselineBudget,
      0,
    );
    const packageBac = demoSnapshot.workPackages.reduce(
      (total, workPackage) => total + workPackage.bac,
      0,
    );

    expect(activityBac).toBe(2_400_000);
    expect(packageBac).toBe(2_400_000);
    expect(packageBac).toBe(demoSnapshot.project.originalBac);
  });

  it("reproduces the fixed week-10 PV, EV and AC control totals", () => {
    const week10 = demoSnapshot.trend[9];

    expect(week10).toMatchObject({
      pv: 1_500_000,
      ev: 1_350_000,
      ac: 1_440_000,
    });

    expect(
      demoSnapshot.workPackages.reduce(
        (total, workPackage) => total + workPackage.pv,
        0,
      ),
    ).toBe(week10?.pv);
    expect(
      demoSnapshot.workPackages.reduce(
        (total, workPackage) => total + workPackage.ev,
        0,
      ),
    ).toBe(week10?.ev);
    expect(
      demoSnapshot.workPackages.reduce(
        (total, workPackage) => total + workPackage.ac,
        0,
      ),
    ).toBe(week10?.ac);
  });

  it("contains management exceptions across milestones, risks and changes", () => {
    expect(
      demoSnapshot.milestones.some(({ status }) =>
        ["complete-late", "forecast-late", "overdue"].includes(status),
      ),
    ).toBe(true);
    expect(
      demoSnapshot.risks.filter(({ rating }) =>
        ["high", "critical"].includes(rating),
      ).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      demoSnapshot.changes.filter(({ status }) => status === "approved"),
    ).toHaveLength(2);
  });

  it("assigns each risk to the owner of its related work package", () => {
    for (const risk of demoSnapshot.risks) {
      const workPackage = demoSnapshot.workPackages.find(
        (item) => item.id === risk.wbsId,
      );

      expect(risk.owner).toBe(workPackage?.owner);
    }
  });
});
