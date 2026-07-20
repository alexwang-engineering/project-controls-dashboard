import { AlertTriangle, ArrowRight, CalendarDays, Database } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { useProjectStore } from "../../app/store";
import { useProjectPerformance } from "../../app/useProjectPerformance";
import { MetricCard } from "../../components/MetricCard";
import { PageGuide } from "../../components/PageGuide";
import { PageHeader } from "../../components/PageHeader";
import { ProjectSetupRequired } from "../../components/ProjectSetupRequired";
import { StatusPill } from "../../components/StatusPill";
import {
  calculateEarnedValue,
  efficiencyStatus,
} from "../../domain/calculations/earnedValue";
import { riskExposure } from "../../domain/risks";
import {
  isAdverseMilestoneStatus,
  milestoneStatusAt,
} from "../../domain/milestones";
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
import { PerformanceChart } from "./PerformanceChart";

export function OverviewPage() {
  const {
    selectedWorkPackage,
    milestones,
    risks,
    changes,
  } = useProjectStore();
  const { snapshot, status, error } = useProjectPerformance();

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
  const activeRisks = scopedRisks.filter((risk) => risk.status !== "closed");
  const criticalRiskCount = activeRisks.filter(
    (risk) => riskExposure(risk, "residual").rating === "critical",
  ).length;
  const lateMilestones = scopedMilestones
    .map((milestone) => ({
      ...milestone,
      status: milestoneStatusAt(milestone, snapshot.project.reportingDate),
    }))
    .filter((milestone) => isAdverseMilestoneStatus(milestone.status));
  const pendingChanges = scopedChanges.filter(
    (change) => change.status === "submitted",
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
  const recoveryNeeded =
    (projectMetrics.spi !== null && projectMetrics.spi < 0.98) ||
    (projectMetrics.cpi !== null && projectMetrics.cpi < 0.98) ||
    finishVarianceDays > 0;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Management control room"
        title="Project overview"
        description="A decision-first view of the latest validated schedule, cost and delivery position."
        actions={
          <div className="snapshot-chip">
            <CalendarDays size={17} aria-hidden="true" />
            <span>
              <small>Data date</small>
              {formatDate(snapshot.project.reportingDate)}
            </span>
          </div>
        }
      />

      <section
        className="source-banner source-banner--active"
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

      <PageGuide
        pageName="Project overview"
        purpose="Start here each week: use the global scope, read the exceptions first, then trace the numbers that need action."
        steps={[
          {
            title: "Set the scope",
            detail: "Use the global bar above to choose the full project or one work package; the same scope follows you through each management view.",
          },
          {
            title: "Read the position",
            detail: "Start with adverse cards; SPI or CPI below 1.00 means behind plan or over cost.",
          },
          {
            title: "Follow the exception",
            detail: "Open the milestone, risk or change register and confirm an owner, action and due date.",
          },
        ]}
      />

      <section className="decision-banner" aria-labelledby="decision-title">
        <div className="decision-banner__icon" aria-hidden="true">
          <AlertTriangle size={22} />
        </div>
        <div>
          <p className="eyebrow">Management attention</p>
          <h2 id="decision-title">
            {recoveryNeeded
              ? "Recovery action is needed to protect the current forecast."
              : `The current ${selectedPackage ? "work-package" : "project"} position is within the control thresholds.`}
          </h2>
          <p>
            {scopeLabel} is {formatPercent(projectMetrics.earnedCompletion)} earned
            complete against {formatPercent(projectMetrics.plannedCompletion)} planned.
            The forecast finish is {Math.abs(finishVarianceDays)} calendar days {finishVarianceDays > 0 ? "late" : finishVarianceDays < 0 ? "early" : "on baseline"}. Trace the adverse variance to its work package and activity before agreeing recovery action.
          </p>
        </div>
        <Link className="button button--light" to="/schedule-cost">
          Trace variance <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <section className="metric-grid" aria-label="Headline performance indicators">
        <MetricCard
          label="Earned completion"
          value={formatPercent(projectMetrics.earnedCompletion)}
          status={efficiencyStatus(projectMetrics.spi)}
          statusLabel={projectMetrics.spi !== null && projectMetrics.spi >= 0.98 ? "On plan" : "Behind plan"}
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
          statusLabel={projectMetrics.spi !== null && projectMetrics.spi >= 0.98 ? "Controlled" : "Adverse"}
          delta={formatCompactCurrency(projectMetrics.sv)}
          detail="Earned value for each £1.00 planned"
        />
        <MetricCard
          label="Cost performance index"
          value={formatIndex(projectMetrics.cpi)}
          status={efficiencyStatus(projectMetrics.cpi)}
          statusLabel={projectMetrics.cpi !== null && projectMetrics.cpi >= 0.98 ? "Controlled" : "Adverse"}
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

      <PerformanceChart
        trend={scopeTrend}
        reportingPeriod={currentPoint.label}
        reportingDate={snapshot.project.reportingDate}
        scopeLabel={scopeLabel}
      />

      <section className="panel" aria-labelledby="work-package-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Variance ownership</p>
            <h2 id="work-package-title">Work-package performance</h2>
            <p className="panel__description">
              Current snapshot reconciles to the selected scope BAC, PV, EV and AC totals.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="performance-table">
            <caption className="sr-only">
              Work-package budget and earned-value performance
            </caption>
            <thead>
              <tr>
                <th scope="col">Work package</th>
                <th scope="col">Owner</th>
                <th scope="col">BAC</th>
                <th scope="col">SV</th>
                <th scope="col">CV</th>
                <th scope="col">SPI</th>
                <th scope="col">CPI</th>
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
                return (
                  <tr
                    key={workPackage.id}
                    className={selectedPackage ? "table-row--selected" : undefined}
                  >
                    <th scope="row">
                      <span className="table-primary">{workPackage.id}</span>
                      <span className="table-secondary">{workPackage.name}</span>
                    </th>
                    <td>{workPackage.owner}</td>
                    <td>{formatCurrency(workPackage.bac)}</td>
                    <td className={metrics.sv < 0 ? "number--adverse" : undefined}>
                      {formatCurrency(metrics.sv)}
                    </td>
                    <td className={metrics.cv < 0 ? "number--adverse" : undefined}>
                      {formatCurrency(metrics.cv)}
                    </td>
                    <td>{formatIndex(metrics.spi)}</td>
                    <td>{formatIndex(metrics.cpi)}</td>
                    <td>
                      <StatusPill status={combinedStatus}>
                        {combinedStatus === "positive"
                          ? "Controlled"
                          : combinedStatus === "attention"
                            ? "Watch"
                            : "Recover"}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>{selectedPackage ? "Selected scope" : "Project total"}</th>
                <td>{formatCurrency(projectMetrics.bac)}</td>
                <td className="number--adverse">{formatCurrency(projectMetrics.sv)}</td>
                <td className="number--adverse">{formatCurrency(projectMetrics.cv)}</td>
                <td>{formatIndex(projectMetrics.spi)}</td>
                <td>{formatIndex(projectMetrics.cpi)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="register-source-note" aria-label="Supporting register data source">
        <strong>Supporting registers follow the global work-package scope.</strong>
        <span>Add or edit milestones, risks and changes on their register pages; matching entries appear here immediately.</span>
      </section>

      <section className="exception-grid" aria-label="Management exceptions">
        <article className="panel exception-card">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Milestone movement</p>
              <h2>{lateMilestones.length} require attention</h2>
            </div>
            <Link to="/milestones">View register</Link>
          </div>
          <ul className="exception-list">
            {lateMilestones.map((milestone) => (
                <li key={milestone.id}>
                  <div>
                    <strong>{milestone.name}</strong>
                    <span>{milestone.owner}</span>
                  </div>
                  <span>{formatDate(milestone.forecastDate)}</span>
                </li>
              ))}
            {lateMilestones.length === 0 ? <li>No milestone exception is recorded.</li> : null}
          </ul>
        </article>

        <article className="panel exception-card">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Risk exposure</p>
              <h2>
                {criticalRiskCount +
                  (criticalRiskCount === 1 ? " critical risk" : " critical risks")}
              </h2>
            </div>
            <Link to="/risks">Open heatmap</Link>
          </div>
          <ul className="exception-list">
            {[...activeRisks]
              .sort(
                (left, right) =>
                  riskExposure(right, "residual").score -
                  riskExposure(left, "residual").score,
              )
              .slice(0, 2)
              .map((risk) => {
                const exposure = riskExposure(risk, "residual");
                return (
              <li key={risk.id}>
                <div>
                  <strong>{risk.title}</strong>
                  <span>{risk.owner}</span>
                </div>
                <StatusPill status={exposure.rating === "critical" ? "adverse" : "attention"}>
                  {String(exposure.score)} / 25
                </StatusPill>
              </li>
                );
              })}
            {activeRisks.length === 0 ? <li>No active risk is entered.</li> : null}
          </ul>
        </article>

        <article className="panel exception-card">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Change control</p>
              <h2>{pendingChanges.length} decisions pending</h2>
            </div>
            <Link to="/changes">View changes</Link>
          </div>
          <ul className="exception-list">
            {pendingChanges.map((change) => (
                <li key={change.id}>
                  <div>
                    <strong>{change.title}</strong>
                    <span>{change.id + " · " + change.wbsId}</span>
                  </div>
                  <span>{formatCompactCurrency(change.costImpact)}</span>
                </li>
              ))}
            {pendingChanges.length === 0 ? <li>No submitted change is awaiting a decision.</li> : null}
          </ul>
        </article>
      </section>
    </div>
  );
}
