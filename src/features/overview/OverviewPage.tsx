import { AlertTriangle, ArrowRight, Database } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router";
import { useProjectStore } from "../../app/store";
import { useProjectPerformance } from "../../app/useProjectPerformance";
import { MetricCard } from "../../components/MetricCard";
import { PageGuide } from "../../components/PageGuide";
import { PageHeader } from "../../components/PageHeader";
import { ProjectSetupRequired } from "../../components/ProjectSetupRequired";
import { StatusPill } from "../../components/StatusPill";
import { ColumnChooser } from "../../components/ColumnChooser";
import {
  calculateEarnedValue,
  efficiencyStatus,
  efficiencyStatusLabel,
} from "../../domain/calculations/earnedValue";
import { buildManagementExceptions } from "../../domain/managementExceptions";
import {
  cumulativePerformanceForScope,
  resolveWorkPackageScope,
} from "../../domain/viewModels/projectPerformance";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatIndex,
  formatPercent,
} from "../../utils/format";
import { ManagementExceptionQueue } from "./ManagementExceptionQueue";
const PerformanceChart = lazy(() =>
  import("./PerformanceChart").then((module) => ({
    default: module.PerformanceChart,
  })),
);

const workPackageColumns = [
  { id: "owner", label: "Owner" },
  { id: "bac", label: "BAC" },
  { id: "sv", label: "Schedule variance" },
  { id: "cv", label: "Cost variance" },
  { id: "spi", label: "SPI" },
  { id: "cpi", label: "CPI" },
] as const;

export function OverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    selectedWorkPackage,
    milestones,
    risks,
    changes,
    riskAppetite,
  } = useProjectStore();
  const { snapshot, status, error } = useProjectPerformance();
  const requestedColumns = searchParams.get("columns");
  const visibleWorkPackageColumns = new Set(
    requestedColumns === null
      ? workPackageColumns.map(({ id }) => id)
      : requestedColumns.split(",").filter((id) =>
          workPackageColumns.some((column) => column.id === id),
        ),
  );

  const toggleWorkPackageColumn = (id: string) => {
    const nextVisible = new Set(visibleWorkPackageColumns);
    if (nextVisible.has(id)) nextVisible.delete(id);
    else nextVisible.add(id);
    const nextParams = new URLSearchParams(searchParams);
    if (nextVisible.size === workPackageColumns.length) nextParams.delete("columns");
    else {
      nextParams.set(
        "columns",
        workPackageColumns.filter((column) => nextVisible.has(column.id)).map(({ id: columnId }) => columnId).join(","),
      );
    }
    setSearchParams(nextParams);
  };

  if (snapshot === undefined) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Management control room"
          title="Project overview"
          description="Your validated schedule, cost and management-register position will appear here."
        />
        <PageGuide
          pageName="Project overview"
          state="Setup required"
          purpose="Create the project position by importing schedule and performance data, then enter the management registers."
          steps={[
            { title: "Import project data", detail: "Choose your schedule CSV and periodic-performance CSV, then validate and commit them." },
            { title: "Enter the registers", detail: "Add milestones, risks and change requests from their pages." },
            { title: "Review the position", detail: "Return here after import to see calculated schedule, cost and management exceptions." },
          ]}
        />
        {error ? (
          <div className="import-error" role="alert">
            <strong>Local project data could not be read.</strong>
            <span>{error}</span>
          </div>
        ) : null}
        {status === "loading" ? (
          <div className="route-loading" role="status">Checking local project data…</div>
        ) : (
          <ProjectSetupRequired />
        )}
      </div>
    );
  }

  const effectiveWorkPackage = resolveWorkPackageScope(
    snapshot,
    selectedWorkPackage,
  );
  const selectedPackage = snapshot.workPackages.find(
    (workPackage) => workPackage.id === effectiveWorkPackage,
  );
  const scopeLabel = selectedPackage
    ? `${selectedPackage.id} — ${selectedPackage.name}`
    : "Full project";
  const scopeTrend = cumulativePerformanceForScope(
    snapshot,
    effectiveWorkPackage,
  );
  const scopedWorkPackages = selectedPackage
    ? [selectedPackage]
    : [...snapshot.workPackages];
  const scopedMilestones = milestones.filter(
    (milestone) =>
      effectiveWorkPackage === "all" ||
      milestone.wbsId === effectiveWorkPackage,
  );
  const scopedRisks = risks.filter(
    (risk) =>
      effectiveWorkPackage === "all" || risk.wbsId === effectiveWorkPackage,
  );
  const scopedChanges = changes.filter(
    (change) =>
      effectiveWorkPackage === "all" || change.wbsId === effectiveWorkPackage,
  );
  const currentPoint =
    [...scopeTrend]
      .reverse()
      .find((candidate) => candidate.period <= snapshot.project.reportingDate) ??
    scopeTrend.at(-1);
  if (currentPoint === undefined) {
    throw new Error("The selected dataset has no performance periods.");
  }
  const projectMetrics = calculateEarnedValue({
    bac: selectedPackage?.bac ?? snapshot.project.originalBac,
    pv: currentPoint.pv,
    ev: currentPoint.ev,
    ac: currentPoint.ac,
  });
  const selectedActivities = selectedPackage
    ? snapshot.activities.filter(
        (activity) => activity.wbsId === selectedPackage.id,
      )
    : [...snapshot.activities];
  const baselineFinish =
    [...selectedActivities]
      .sort((left, right) => right.baselineFinish.localeCompare(left.baselineFinish))
      .at(0)?.baselineFinish ?? snapshot.project.baselineFinish;
  const forecastFinish =
    selectedPackage?.forecastFinish ?? snapshot.project.forecastFinish;
  const finishVarianceDays = differenceInCalendarDays(
    parseISO(forecastFinish),
    parseISO(baselineFinish),
  );
  const sourceDescription = `${snapshot.importId} is active: ${snapshot.activities.length} schedule rows and ${snapshot.performance.length} performance rows feed these figures.`;
  const managementExceptions = buildManagementExceptions({
    reportingDate: snapshot.project.reportingDate,
    scopeId: effectiveWorkPackage,
    scopeOwner: selectedPackage?.owner ?? "Project Controls Manager",
    metrics: {
      spi: projectMetrics.spi,
      cpi: projectMetrics.cpi,
    },
    finishVarianceDays,
    milestones: scopedMilestones,
    risks: scopedRisks,
    changes: scopedChanges,
    riskAppetite,
    bac: projectMetrics.bac,
  });
  const managementAction = managementExceptions.at(0);
  const attentionNeeded = managementExceptions.some(
    ({ severity }) => severity === "attention" || severity === "recovery",
  );
  const recoveryRequired = managementExceptions.some(
    ({ severity }) => severity === "recovery",
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Management control room"
        title="Project overview"
        description="A decision-first view of the latest validated schedule, cost and delivery position."
      />

      <section
        className="source-banner source-banner--active source-banner--compact"
        aria-label="Dashboard data source"
      >
        <Database size={19} aria-hidden="true" />
        <div>
          <strong>
            {status === "loading" ? "Checking local data…" : "Validated active generation"}
          </strong>
          <span>{error ? `Local read failed: ${error}` : sourceDescription}</span>
        </div>
      </section>

      <section className="decision-banner" aria-labelledby="decision-title">
        <div className="decision-banner__icon" aria-hidden="true">
          <AlertTriangle size={22} />
        </div>
        <div>
          <p className="eyebrow">Management attention</p>
          <h2 id="decision-title">
            {recoveryRequired
              ? "Recovery action is needed to protect the current forecast."
              : attentionNeeded
                ? "Management attention is needed to protect the current forecast."
                : `The current ${selectedPackage ? "work-package" : "project"} position is within the control thresholds.`}
          </h2>
          <p>
            {scopeLabel} is {formatPercent(projectMetrics.earnedCompletion)} earned
            complete against {formatPercent(projectMetrics.plannedCompletion)} planned.
            The forecast finish is {Math.abs(finishVarianceDays)} calendar days {finishVarianceDays > 0 ? "late" : finishVarianceDays < 0 ? "early" : "on baseline"}. {attentionNeeded ? "Open the priority control record, confirm its evidence and agree the proportionate management response." : "Continue monitoring the validated position at the next reporting period."}
          </p>
          {managementAction ? (
            <dl className="decision-banner__action">
              <div><dt>Priority</dt><dd>{managementAction.kindLabel}: {managementAction.title}</dd></div>
              <div><dt>Owner</dt><dd>{managementAction.owner}</dd></div>
              <div><dt>Next action</dt><dd>{managementAction.action}</dd></div>
              <div><dt>Due</dt><dd>{managementAction.dueDate ? formatDate(managementAction.dueDate) : "This reporting cycle"}</dd></div>
              <div><dt>Why priority</dt><dd>{managementAction.priorityReason}</dd></div>
            </dl>
          ) : null}
        </div>
        <Link className="button button--light" to={managementAction?.route ?? "/schedule-cost"}>
          {managementAction?.cta ?? "Trace variance"} <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <section className="metric-grid" aria-label="Headline performance indicators">
        <MetricCard
          label="Earned completion"
          value={formatPercent(projectMetrics.earnedCompletion)}
          status={efficiencyStatus(projectMetrics.spi)}
          statusLabel={efficiencyStatusLabel(projectMetrics.spi)}
          delta={formatPercent(
            projectMetrics.earnedCompletion === null || projectMetrics.plannedCompletion === null
              ? null
              : projectMetrics.earnedCompletion - projectMetrics.plannedCompletion,
          )}
          detail={formatPercent(projectMetrics.plannedCompletion) + " planned"}
        />
        <MetricCard
          label="Schedule performance index"
          value={formatIndex(projectMetrics.spi)}
          status={efficiencyStatus(projectMetrics.spi)}
          statusLabel={efficiencyStatusLabel(projectMetrics.spi)}
          delta={formatCompactCurrency(projectMetrics.sv)}
          detail="Earned value for each £1.00 planned"
        />
        <MetricCard
          label="Cost performance index"
          value={formatIndex(projectMetrics.cpi)}
          status={efficiencyStatus(projectMetrics.cpi)}
          statusLabel={efficiencyStatusLabel(projectMetrics.cpi)}
          delta={formatCompactCurrency(projectMetrics.cv)}
          detail="Earned value for each £1.00 spent"
        />
        <MetricCard
          label="Forecast finish"
          value={formatDate(forecastFinish)}
          status={finishVarianceDays > 0 ? "adverse" : "positive"}
          statusLabel={finishVarianceDays > 0 ? "Late" : "On baseline"}
          delta={(finishVarianceDays > 0 ? "+" : "") + String(finishVarianceDays) + " days"}
          detail={"Baseline " + formatDate(baselineFinish)}
        />
        <MetricCard
          label="Estimate at completion"
          value={formatCompactCurrency(projectMetrics.managementEac)}
          status={projectMetrics.vac < 0 ? "attention" : "positive"}
          statusLabel={projectMetrics.vac < 0 ? "Above budget" : "Within budget"}
          delta={formatCompactCurrency(-projectMetrics.vac)}
          detail="CPI-based management forecast"
        />
        <MetricCard
          label="To-complete performance"
          value={formatIndex(projectMetrics.tcpiBac)}
          status={projectMetrics.tcpiBac !== null && projectMetrics.tcpiBac > 1.05 ? "adverse" : "positive"}
          statusLabel={projectMetrics.tcpiBac !== null && projectMetrics.tcpiBac > 1.05 ? "Recovery required" : "Achievable"}
          detail="Efficiency needed to recover the original BAC"
        />
      </section>

      <ManagementExceptionQueue exceptions={managementExceptions} />

      <Suspense fallback={<div className="chart-loading" role="status">Loading performance trend…</div>}>
        <PerformanceChart
          trend={scopeTrend}
          reportingPeriod={currentPoint.label}
          reportingDate={snapshot.project.reportingDate}
          scopeLabel={scopeLabel}
        />
      </Suspense>

      <details className="overview-support">
        <summary>Method and page guidance</summary>
        <div className="overview-support__content">
          <PageGuide
            pageName="Project overview"
            purpose="Use the global scope, read the management decision, then trace the numbers that need action."
            steps={[
              {
                title: "Set the scope",
                detail: "Choose the full project or one work package; the scope follows you through management views.",
              },
              {
                title: "Read the position",
                detail: "At or above 1.00 is on plan; 0.98–0.999 is within tolerance; 0.95–0.979 requires attention; below 0.95 requires recovery.",
              },
              {
                title: "Close the action",
                detail: "Confirm the priority owner, next action and due date, then open the supporting register.",
              },
            ]}
          />
        </div>
      </details>

      <section className="panel" aria-labelledby="work-package-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Variance ownership</p>
            <h2 id="work-package-title">Work-package performance</h2>
            <p className="panel__description">
              Current snapshot reconciles to the selected scope BAC, PV, EV and AC totals.
            </p>
          </div>
          <ColumnChooser
            columns={workPackageColumns}
            visible={visibleWorkPackageColumns}
            onToggle={toggleWorkPackageColumn}
          />
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="Work-package performance table; scroll horizontally to see every measure"
          tabIndex={0}
        >
          <table className="performance-table">
            <caption className="sr-only">
              Work-package budget and earned-value performance
            </caption>
            <thead>
              <tr>
                <th scope="col">Work package</th>
                {visibleWorkPackageColumns.has("owner") ? <th scope="col">Owner</th> : null}
                {visibleWorkPackageColumns.has("bac") ? <th scope="col">BAC</th> : null}
                {visibleWorkPackageColumns.has("sv") ? <th scope="col">SV</th> : null}
                {visibleWorkPackageColumns.has("cv") ? <th scope="col">CV</th> : null}
                {visibleWorkPackageColumns.has("spi") ? <th scope="col">SPI</th> : null}
                {visibleWorkPackageColumns.has("cpi") ? <th scope="col">CPI</th> : null}
                <th scope="col">Position</th>
              </tr>
            </thead>
            <tbody>
              {scopedWorkPackages.map((workPackage) => {
                const metrics = calculateEarnedValue(workPackage);
                const combinedStatus =
                  metrics.spi !== null && metrics.cpi !== null
                    ? efficiencyStatus(Math.min(metrics.spi, metrics.cpi))
                    : "neutral";
                const combinedLabel =
                  metrics.spi !== null && metrics.cpi !== null
                    ? efficiencyStatusLabel(Math.min(metrics.spi, metrics.cpi))
                    : "Unavailable";
                return (
                  <tr
                    key={workPackage.id}
                    className={selectedPackage ? "table-row--selected" : undefined}
                  >
                    <th scope="row">
                      <span className="table-primary">{workPackage.id}</span>
                      <span className="table-secondary">{workPackage.name}</span>
                    </th>
                    {visibleWorkPackageColumns.has("owner") ? <td>{workPackage.owner}</td> : null}
                    {visibleWorkPackageColumns.has("bac") ? <td>{formatCurrency(workPackage.bac)}</td> : null}
                    {visibleWorkPackageColumns.has("sv") ? <td className={metrics.sv < 0 ? "number--adverse" : undefined}>
                      {formatCurrency(metrics.sv)}
                    </td> : null}
                    {visibleWorkPackageColumns.has("cv") ? <td className={metrics.cv < 0 ? "number--adverse" : undefined}>
                      {formatCurrency(metrics.cv)}
                    </td> : null}
                    {visibleWorkPackageColumns.has("spi") ? <td>{formatIndex(metrics.spi)}</td> : null}
                    {visibleWorkPackageColumns.has("cpi") ? <td>{formatIndex(metrics.cpi)}</td> : null}
                    <td>
                      <StatusPill status={combinedStatus}>
                        {combinedLabel}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={visibleWorkPackageColumns.has("owner") ? 2 : 1}>{selectedPackage ? "Selected scope" : "Project total"}</th>
                {visibleWorkPackageColumns.has("bac") ? <td>{formatCurrency(projectMetrics.bac)}</td> : null}
                {visibleWorkPackageColumns.has("sv") ? <td className="number--adverse">{formatCurrency(projectMetrics.sv)}</td> : null}
                {visibleWorkPackageColumns.has("cv") ? <td className="number--adverse">{formatCurrency(projectMetrics.cv)}</td> : null}
                {visibleWorkPackageColumns.has("spi") ? <td>{formatIndex(projectMetrics.spi)}</td> : null}
                {visibleWorkPackageColumns.has("cpi") ? <td>{formatIndex(projectMetrics.cpi)}</td> : null}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

    </div>
  );
}
