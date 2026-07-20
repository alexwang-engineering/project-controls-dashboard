import { expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures",
);

export async function importControlledProject(page: Page) {
  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "Import and data quality", level: 1 }),
  ).toBeVisible();

  await page.getByLabel("Schedule CSV").setInputFiles(
    path.join(fixturesDirectory, "controlled-schedule.csv"),
  );
  await page.getByLabel("Performance CSV").setInputFiles(
    path.join(fixturesDirectory, "controlled-performance.csv"),
  );
  await page.getByRole("button", { name: "Validate both files" }).click();

  await expect(
    page.getByRole("heading", {
      name: "The data pair is technically valid.",
      level: 2,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Validation summary")).toContainText(
    "2026-04-12",
  );
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
  await expect(page.getByText("This is the first controlled active generation."))
    .toBeVisible();
}
