import { expect, test } from "./support/test";
import { importControlledProject } from "./helpers/importProject";

test("commits a validated CSV pair and calculates the active management position", async ({
  page,
}) => {
  await importControlledProject(page);

  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByText("Active import", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Dashboard data source" }),
  ).toContainText("1 schedule rows and 1 performance rows");

  const indicators = page.getByRole("region", {
    name: "Headline performance indicators",
  });
  await expect(indicators).toContainText("0.833");
  await expect(indicators).toContainText("0.909");
});

test("turns an imported schedule milestone into a controlled exception record", async ({
  page,
}) => {
  await importControlledProject(page);
  await page.getByRole("link", { name: "Milestones", exact: true }).click();

  await expect(
    page.getByRole("heading", { name: "Milestone control", level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add 1 imported milestones" })
    .click();

  const row = page.getByRole("row", { name: /Commissioning gate/ });
  await expect(row).toContainText("Forecast late");
  await expect(row).toContainText("5 fields missing");
  await expect(row).toContainText("Publication blocked");
  await expect(row).toContainText("Not linked");

  await page
    .getByRole("button", {
      name: "Review dependency and recovery for A-001",
    })
    .click();
  await expect(page.getByText("No predecessor chain is available.")).toBeVisible();
  await expect(
    page.getByText(/dependency evidence only, not a calculated critical path/i),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Control record incomplete" }))
    .toBeVisible();

  await page.keyboard.press("Control+K");
  await page
    .getByPlaceholder("Search by name, ID, owner or category")
    .fill("A-001");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/milestones\?.*record=A-001/);
  const inspection = page.getByRole("region", { name: "Commissioning gate" });
  await expect(inspection).toBeFocused();
  await expect(inspection).toContainText("Inspection is read-only");
  await inspection.getByRole("button", { name: "Edit record" }).click();
  await expect(page).toHaveURL(/mode=edit/);
  await expect(
    page.getByRole("heading", { name: "Edit milestone A-001" }),
  ).toBeVisible();
});
