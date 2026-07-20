import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  importFullAsterProject,
  seedFullAsterManagementRegisters,
  signFullAsterVarianceAnalyses,
} from "./helpers/fullAsterReport";
import { test, expect } from "./support/test";

test("publishes and renders the full ASTER weekly report to A4", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);

  await importFullAsterProject(page);
  await seedFullAsterManagementRegisters(page);
  await signFullAsterVarianceAnalyses(page);

  await page.goto("/report");
  await expect(
    page.getByRole("heading", { name: "Publication controls passed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", {
      name: "Current-period and cumulative performance",
    }),
  ).toContainText("£1,500,000");
  await expect(page.getByText("5 threshold exceptions")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Milestone exceptions" }),
  ).toContainText("3 exceptions");

  await page.getByLabel("Report author").fill("Alex Wang");
  await page.getByRole("button", { name: "Save current draft" }).click();
  await expect(
    page.getByText("Draft saved against the current source fingerprint."),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "I confirm this narrative and the frozen source evidence are ready to publish.",
    })
    .check();

  const publishButton = page.getByRole("button", {
    name: "Publish immutable revision",
  });
  await expect(publishButton).toBeEnabled();
  await publishButton.click();

  await expect(
    page.getByRole("region", { name: "Published revision" }),
  ).toContainText("Published revision 1");
  await expect(page.locator(".report-page")).toHaveAttribute(
    "data-print-state",
    "published",
  );
  await expect(page.locator(".report-document")).toHaveAttribute(
    "data-publication-state",
    "published",
  );
  await expect(
    page.getByRole("button", { name: "Print selected publication" }),
  ).toBeEnabled();

  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("region", { name: "Publication scope boundary" }),
  ).toBeHidden();
  const configuredOutput = process.env.ASTER_PDF_OUTPUT;
  const pdfPath = configuredOutput ?? testInfo.outputPath("full-aster-report.pdf");
  await mkdir(path.dirname(pdfPath), { recursive: true });
  const pdf = await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
  });

  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(pdf.byteLength).toBeGreaterThan(80_000);
  await testInfo.attach("full-aster-report.pdf", {
    body: pdf,
    contentType: "application/pdf",
  });
});
