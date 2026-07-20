import { expect, test } from "./support/test";

test("keeps every input-first route within a 390 pixel viewport", async ({
  page,
}) => {
  const routes = [
    "/",
    "/import",
    "/schedule-cost",
    "/milestones",
    "/risks",
    "/changes",
    "/report",
    "/settings",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const widths = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.body, `${route} body width`).toBeLessThanOrEqual(
      widths.viewport,
    );
    expect(widths.document, `${route} document width`).toBeLessThanOrEqual(
      widths.viewport,
    );
  }
});

test("keeps the controlled milestone editor reachable on mobile", async ({ page }) => {
  await page.goto("/milestones");
  await page.getByRole("button", { name: "Add milestone" }).click();

  await expect(
    page.getByRole("heading", { name: "Add milestone", level: 2 }),
  ).toBeVisible();
  await expect(page.getByLabel("Milestone ID")).toBeVisible();
  await expect(page.getByLabel("Management decision required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save milestone" })).toBeVisible();

  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
});
