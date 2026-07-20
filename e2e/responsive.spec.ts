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

    const undersizedTargets = await page
      .locator(
        ".button, button:not([disabled]), select, textarea, summary, input:not([type='checkbox']):not([type='radio']):not([type='hidden'])",
      )
      .evaluateAll((elements) =>
        elements
          .filter((element) => {
            const style = getComputedStyle(element);
            const bounds = element.getBoundingClientRect();
            return (
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              bounds.width > 0 &&
              bounds.height > 0 &&
              (bounds.width < 24 || bounds.height < 24)
            );
          })
          .map((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              name:
                element.getAttribute("aria-label") ??
                element.textContent?.trim().slice(0, 80) ??
                element.tagName,
              width: Math.round(bounds.width),
              height: Math.round(bounds.height),
            };
          }),
      );
    expect(undersizedTargets, `${route} target size`).toEqual([]);
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
