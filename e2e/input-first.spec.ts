import { expect, test } from "./support/test";

test("opens without demonstration data and directs the user to controlled input", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Project overview", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("No project loaded", { exact: true })).toBeVisible();
  await expect(page.getByText("Project setup required", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "MVP build progress" }))
    .toHaveAttribute("value", "92");
  await expect(
    page.getByRole("region", { name: "How to use Project overview" }),
  ).toContainText("Import project data");
  await expect(
    page.getByRole("region", { name: "Headline performance indicators" }),
  ).toHaveCount(0);
});

test("provides a three-step guide on every primary page", async ({ page }) => {
  const routes = [
    ["/", "Project overview"],
    ["/import", "Import and data quality"],
    ["/schedule-cost", "Schedule and cost"],
    ["/milestones", "Milestone control"],
    ["/risks", "Risk exposure"],
    ["/changes", "Change control"],
    ["/report", "Weekly management report"],
    ["/settings", "Settings and data"],
  ] as const;

  for (const [route, title] of routes) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: `How to use ${title}` })
        .getByRole("listitem"),
    ).toHaveCount(3);
  }
});
