import {
  expectNoAutomatedWcagViolations,
  openPrimaryRoute,
  primaryRoutes,
} from "./helpers/accessibility";
import { importControlledProject } from "./helpers/importProject";
import { expect, test } from "./support/test";

test("has no automatically detectable WCAG A or AA violations on input-first routes", async ({
  page,
}) => {
  for (const route of primaryRoutes) {
    await openPrimaryRoute(page, route);
    await expectNoAutomatedWcagViolations(page, `${route[0]} input-first`);
  }
});

test("keeps imported and expanded control states free of automated WCAG violations", async ({
  page,
}) => {
  await importControlledProject(page);
  await expectNoAutomatedWcagViolations(page, "committed import receipt");

  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project overview", level: 1 }),
  ).toBeVisible();
  await expectNoAutomatedWcagViolations(page, "active project overview");

  for (const route of primaryRoutes.filter(([path]) =>
    ["/schedule-cost", "/risks", "/changes", "/report", "/settings"].includes(
      path,
    ),
  )) {
    await openPrimaryRoute(page, route);
    await expectNoAutomatedWcagViolations(page, `${route[0]} active project`);
  }

  await openPrimaryRoute(page, ["/milestones", "Milestone control"]);
  await page.getByRole("button", { name: "Add 1 imported milestones" }).click();
  await page
    .getByRole("button", {
      name: "Review dependency and recovery for A-001",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Control record incomplete" }),
  ).toBeVisible();
  await expectNoAutomatedWcagViolations(
    page,
    "expanded imported milestone exception",
  );
});

test("supports skip navigation, visible keyboard focus and 400 percent equivalent reflow", async ({
  page,
  browserName,
}) => {
  if (browserName !== "webkit") {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Import project data to continue",
        level: 2,
      }),
    ).toBeVisible();

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Import project data to continue",
        level: 2,
      }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Overview", exact: true }))
      .toBeFocused();
    await page.keyboard.press("Tab");
    const importLink = page.getByRole("link", { name: "Import & quality" });
    await expect(importLink).toBeFocused();
    const focusIndicator = await importLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
      };
    });
    expect(focusIndicator.style).not.toBe("none");
    expect(focusIndicator.width).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Import and data quality", level: 1 }),
    ).toBeVisible();
  }

  await page.setViewportSize({ width: 320, height: 800 });
  await page.addStyleTag({
    content: `
      * { letter-spacing: 0.12em !important; line-height: 1.5 !important; word-spacing: 0.16em !important; }
      p { margin-bottom: 2em !important; }
    `,
  });
  for (const route of primaryRoutes) {
    await openPrimaryRoute(page, route);
    const widths = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.body, `${route[0]} body reflow width`).toBeLessThanOrEqual(
      widths.viewport,
    );
    expect(
      widths.document,
      `${route[0]} document reflow width`,
    ).toBeLessThanOrEqual(widths.viewport);
  }
});
