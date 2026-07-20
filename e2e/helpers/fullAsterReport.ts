import { expect, type Page } from "@playwright/test";
import { demoSnapshot } from "../../src/data/demo";
import { createSyntheticImportFiles } from "../../src/features/import/demoImportFiles";

const registerStorageKey = "project-controls-management-registers-v1";

export async function importFullAsterProject(page: Page) {
  const files = createSyntheticImportFiles();
  const [scheduleBuffer, performanceBuffer] = await Promise.all([
    files.schedule.arrayBuffer().then((bytes) => Buffer.from(bytes)),
    files.performance.arrayBuffer().then((bytes) => Buffer.from(bytes)),
  ]);

  await page.goto("/import");
  await page.getByLabel("Schedule CSV").setInputFiles({
    name: files.schedule.name,
    mimeType: files.schedule.type,
    buffer: scheduleBuffer,
  });
  await page.getByLabel("Performance CSV").setInputFiles({
    name: files.performance.name,
    mimeType: files.performance.type,
    buffer: performanceBuffer,
  });
  await page.getByRole("button", { name: "Validate both files" }).click();

  await expect(
    page.getByRole("heading", {
      name: "The data pair is technically valid.",
      level: 2,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Validation summary")).toContainText("1020");
  await expect(
    page.getByText("Validated in the isolated module worker"),
  ).toBeVisible();

  await page
    .getByRole("checkbox", {
      name: "I confirm this proposed project registry.",
    })
    .check();
  await page.getByRole("button", { name: "Commit validated import" }).click();

  await expect(
    page.getByRole("heading", {
      name: "The validated generation is now active.",
      level: 2,
    }),
  ).toBeVisible();
  await expect(page.getByText("1020 records were stored locally")).toBeVisible();
}

export async function seedFullAsterManagementRegisters(page: Page) {
  await page.evaluate(
    ({ storageKey, milestones, risks }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: {
            milestones,
            risks,
            changes: [],
          },
          version: 2,
        }),
      );
    },
    {
      storageKey: registerStorageKey,
      milestones: demoSnapshot.milestones,
      risks: demoSnapshot.risks,
    },
  );
  await page.reload();

  await page.goto("/milestones");
  await expect(page.getByLabel("Milestone summary")).toContainText(
    "Milestones recorded8",
  );
  await expect(page.getByLabel("Milestone summary")).toContainText(
    "Recovery incomplete0",
  );

  await page.goto("/risks");
  await expect(page.getByLabel("Risk summary")).toContainText("Risks shown11");
}

const varianceNarrative = {
  rootCause:
    "Late panel release and access constraints reduced planned production.",
  dependencyImpact:
    "Mechanical completion and test entry depend on the recovery sequence.",
  milestoneImpact:
    "Mechanical completion and handover remain later than baseline.",
  criticalPathImpact:
    "The source schedule does not identify total float or a calculated critical path.",
  costEacEffect:
    "CPI continuation indicates an adverse forecast requiring cost control.",
  correctiveAction:
    "Add a recovery shift, resequence testing and verify quantities weekly.",
  owner: "Project Controls Manager",
  dueDate: "2026-06-21",
  recoveryEvidence:
    "Earned quantities, released panels and test packs will evidence recovery.",
  expectedRecoveryPeriod: "2026-06-28",
  author: "Alex Wang",
} as const;

export async function signFullAsterVarianceAnalyses(page: Page) {
  await page.goto("/schedule-cost");
  const scopeControl = page.getByLabel("Global work package scope");
  const panel = page.locator("section.variance-analysis");

  for (const scope of ["all", "WP200", "WP300", "WP400", "WP500"] as const) {
    await scopeControl.selectOption(scope);
    await expect(
      panel.getByText(scope === "all" ? /Project ·/ : new RegExp(`${scope} ·`)),
    ).toBeVisible();
    await expect(panel.getByLabel("Root cause")).toHaveValue("");

    for (const [label, value] of Object.entries({
      "Root cause": varianceNarrative.rootCause,
      "Dependency impact": varianceNarrative.dependencyImpact,
      "Milestone impact": varianceNarrative.milestoneImpact,
      "Critical or near-critical path impact":
        varianceNarrative.criticalPathImpact,
      "Cost and EAC effect": varianceNarrative.costEacEffect,
      "Corrective action": varianceNarrative.correctiveAction,
      "Accountable owner": varianceNarrative.owner,
      "Action due date": varianceNarrative.dueDate,
      "Recovery evidence": varianceNarrative.recoveryEvidence,
      "Expected recovery period": varianceNarrative.expectedRecoveryPeriod,
      "Prepared by": varianceNarrative.author,
    })) {
      await panel.getByLabel(label).fill(value);
    }
    await panel.getByLabel("Workflow status").selectOption("monitoring");

    await panel.getByRole("button", { name: "Save current draft" }).click();
    await expect(
      panel.getByText(
        "Draft saved against the current source generation and forecast selection.",
      ),
    ).toBeVisible();

    const signButton = panel.getByRole("button", {
      name: "Sign off immutable revision",
    });
    await expect(signButton).toBeEnabled();
    await signButton.click();
    await expect(
      panel.getByText("Revision 1 was signed and locked."),
    ).toBeVisible();
  }
}
