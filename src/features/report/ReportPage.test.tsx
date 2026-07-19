import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoSnapshot } from "../../data/demo";
import { buildSyntheticPerformanceSnapshot } from "../../domain/viewModels/projectPerformance";
import { buildWeeklyReportSnapshot } from "../../domain/reports/weeklyReport";
import {
  buildReportSourceFingerprint,
  type WeeklyReportPublicationRecord,
  type WeeklyReportSourceEvidence,
} from "../../domain/reports/reportPublication";
import {
  ReportPage,
  type ReportPageDependencies,
} from "./ReportPage";

const performance = {
  ...buildSyntheticPerformanceSnapshot(),
  source: "active-import" as const,
  importId: "IMPORT-REPORT-001",
};

const controlledPerformance = {
  ...performance,
  project: {
    ...performance.project,
    forecastFinish: performance.project.baselineFinish,
  },
  periods: performance.periods.map((period) => ({
    ...period,
    ev: period.pv,
    ac: period.pv,
  })),
  workPackages: performance.workPackages.map((workPackage) => ({
    ...workPackage,
    ev: workPackage.pv,
    ac: workPackage.pv,
    forecastFinish: performance.project.baselineFinish,
  })),
};

const dependencies: ReportPageDependencies = {
  loadSignedAnalyses: vi.fn().mockResolvedValue([]),
  loadPublicationContext: vi.fn().mockResolvedValue({
    publishedRevisions: [],
    retainedDraftCount: 0,
  }),
  saveReportDraft: vi.fn(),
  publishReport: vi.fn(),
  now: () => "2026-07-19T18:00:00.000Z",
  print: vi.fn(),
};

describe("weekly management report page", () => {
  afterEach(() => cleanup());

  it("renders an accessible HTML preview with a visible publication gate", async () => {
    render(
      <ReportPage
        dependencies={dependencies}
        performanceOverride={performance}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Weekly management report",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: "How to use Weekly management report",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "Publication controls need attention",
      }),
    ).toBeInTheDocument();

    const kpis = screen.getByRole("table", {
      name: "Current-period and cumulative performance",
    });
    expect(within(kpis).getByRole("row", { name: /Schedule variance/ })).toHaveTextContent(
      "-£10,000",
    );
    expect(within(kpis).getByRole("row", { name: /Schedule variance/ })).toHaveTextContent(
      "-£150,000",
    );
    expect(screen.getByText("£2,490,000 to £2,684,444")).toBeInTheDocument();
    expect(screen.getByText(/HTML is the authoritative report/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Print selected publication" }),
    ).toBeDisabled();
    expect(dependencies.loadSignedAnalyses).toHaveBeenCalledWith({
      projectId: performance.project.id,
      baselineVersion: performance.project.baselineVersion,
      reportingPeriod: performance.project.reportingDate,
    });
  });

  it("prints only a selected persisted publication revision", async () => {
    const publishedReport = buildWeeklyReportSnapshot({
      performance,
      signedAnalyses: [],
      milestones: [],
      risks: [],
      changes: [],
      generatedAt: "2026-07-19T17:30:00.000Z",
      registerSource: "User-entered local management registers",
    });
    const sourceEvidence: WeeklyReportSourceEvidence = {
      activeImportId: performance.importId,
      signedAnalyses: [],
      milestones: [],
      risks: [],
      changes: [],
    };
    const published: WeeklyReportPublicationRecord = {
      recordId: "REPORT-PUBLISHED::ASTER|B0|2026-06-14::1",
      recordType: "published",
      contextKey: "ASTER|B0|2026-06-14",
      projectId: "ASTER",
      baselineVersion: "B0",
      reportingPeriod: "2026-06-14",
      sourceImportId: performance.importId,
      sourceFingerprint: buildReportSourceFingerprint(
        publishedReport,
        sourceEvidence,
      ),
      report: publishedReport,
      sourceEvidence,
      narrative: {
        author: "Project Controls Manager",
        managementSummary:
          "Management approved this frozen position for the weekly review.",
        decisionsRequired: "Approve recovery resources this week.",
        nextPeriodFocus: "Track and evidence recovery output every day.",
      },
      revision: 1,
      createdAt: "2026-07-19T17:35:00.000Z",
      updatedAt: "2026-07-19T17:35:00.000Z",
      publishedAt: "2026-07-19T17:35:00.000Z",
    };
    const print = vi.fn();
    const withPublication: ReportPageDependencies = {
      ...dependencies,
      loadPublicationContext: vi.fn().mockResolvedValue({
        publishedRevisions: [published],
        retainedDraftCount: 0,
      }),
      print,
    };

    render(
      <ReportPage
        dependencies={withPublication}
        performanceOverride={performance}
      />,
    );

    expect(
      await screen.findByRole("region", { name: "Published revision" }),
    ).toHaveTextContent("Published revision 1");
    expect(screen.getByText(/Management approved this frozen position/)).toBeInTheDocument();
    const printButton = screen.getByRole("button", {
      name: "Print selected publication",
    });
    expect(printButton).toBeEnabled();
    fireEvent.click(printButton);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("requires a current saved draft before publishing an immutable revision", async () => {
    const saveReportDraft = vi.fn().mockImplementation(
      async (input: Parameters<ReportPageDependencies["saveReportDraft"]>[0]) => ({
        recordId: "REPORT-DRAFT::ASTER|B0|2026-06-14::IMPORT-REPORT-001",
        recordType: "draft" as const,
        contextKey: "ASTER|B0|2026-06-14",
        projectId: input.report.identity.projectId,
        baselineVersion: input.report.identity.baselineVersion,
        reportingPeriod: input.report.identity.reportingPeriod,
        sourceImportId: input.report.identity.sourceImportId,
        sourceFingerprint: input.sourceFingerprint,
        report: input.report,
        sourceEvidence: input.evidence,
        narrative: input.narrative,
        createdAt: input.savedAt,
        updatedAt: input.savedAt,
      }),
    );
    const publishReport = vi.fn().mockImplementation(
      async (input: Parameters<ReportPageDependencies["publishReport"]>[0]) => ({
        recordId: "REPORT-PUBLISHED::ASTER|B0|2026-06-14::1",
        recordType: "published" as const,
        contextKey: "ASTER|B0|2026-06-14",
        projectId: input.report.identity.projectId,
        baselineVersion: input.report.identity.baselineVersion,
        reportingPeriod: input.report.identity.reportingPeriod,
        sourceImportId: input.report.identity.sourceImportId,
        sourceFingerprint: input.sourceFingerprint,
        report: input.report,
        sourceEvidence: input.evidence,
        narrative: input.narrative,
        revision: 1,
        createdAt: input.publishedAt,
        updatedAt: input.publishedAt,
        publishedAt: input.publishedAt,
      }),
    );
    const workflowDependencies: ReportPageDependencies = {
      ...dependencies,
      loadPublicationContext: vi.fn().mockResolvedValue({
        publishedRevisions: [],
        retainedDraftCount: 0,
      }),
      saveReportDraft,
      publishReport,
    };

    render(
      <ReportPage
        dependencies={workflowDependencies}
        performanceOverride={controlledPerformance}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Publication controls passed" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /Report author/ }), {
      target: { value: "Project Controls Manager" },
    });
    const publishButton = screen.getByRole("button", {
      name: "Publish immutable revision",
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I confirm this narrative and the frozen source evidence/,
      }),
    );
    expect(publishButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Save current draft" }));
    await waitFor(() => expect(saveReportDraft).toHaveBeenCalledTimes(1));
    expect(publishButton).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I confirm this narrative and the frozen source evidence/,
      }),
    );
    expect(publishButton).toBeEnabled();
    fireEvent.click(publishButton);
    await waitFor(() => expect(publishReport).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("region", { name: "Published revision" }),
    ).toHaveTextContent("Published revision 1");
  });

  it("keeps the baseline mismatch and synthetic register sources explicit", async () => {
    render(
      <ReportPage
        dependencies={dependencies}
        performanceOverride={performance}
        registerOverride={{
          milestones: demoSnapshot.milestones,
          risks: demoSnapshot.risks,
          changes: demoSnapshot.changes,
        }}
      />,
    );

    const baseline = await screen.findByRole("region", {
      name: "Baseline and change reconciliation",
    });
    expect(within(baseline).getByText("£77,000")).toBeInTheDocument();
    expect(within(baseline).getByText("B1")).toBeInTheDocument();
    expect(
      screen.getByText(/User-entered local management registers/),
    ).toBeInTheDocument();
  });
});
