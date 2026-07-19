import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoSnapshot } from "../../data/demo";
import { buildSyntheticPerformanceSnapshot } from "../../domain/viewModels/projectPerformance";
import {
  ReportPage,
  type ReportPageDependencies,
} from "./ReportPage";

const performance = {
  ...buildSyntheticPerformanceSnapshot(),
  source: "active-import" as const,
  importId: "IMPORT-REPORT-001",
};

const dependencies: ReportPageDependencies = {
  loadSignedAnalyses: vi.fn().mockResolvedValue([]),
  now: () => "2026-07-19T18:00:00.000Z",
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
    expect(dependencies.loadSignedAnalyses).toHaveBeenCalledWith({
      projectId: performance.project.id,
      baselineVersion: performance.project.baselineVersion,
      reportingPeriod: performance.project.reportingDate,
    });
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
