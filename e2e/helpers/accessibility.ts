import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const primaryRoutes = [
  ["/", "Project overview"],
  ["/import", "Import and data quality"],
  ["/schedule-cost", "Schedule and cost"],
  ["/milestones", "Milestone control"],
  ["/risks", "Risk exposure"],
  ["/changes", "Change control"],
  ["/report", "Weekly management report"],
  ["/settings", "Settings and data"],
] as const;

const wcagTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
] as const;

export async function expectNoAutomatedWcagViolations(
  page: Page,
  state: string,
) {
  const result = await new AxeBuilder({ page }).withTags([...wcagTags]).analyze();
  const readableViolations = result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      summary: node.failureSummary,
    })),
  }));

  expect(readableViolations, `${state} WCAG A/AA violations`).toEqual([]);
}

export async function openPrimaryRoute(
  page: Page,
  route: (typeof primaryRoutes)[number],
) {
  const [path, title] = route;
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: title, level: 1 }),
  ).toBeVisible();
}
