import { AlertTriangle, ArrowRight, CalendarDays, Database } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { useProjectStore } from "../../app/store";
import { useProjectPerformance } from "../../app/useProjectPerformance";
import { MetricCard } from "../../components/MetricCard";
import { PageGuide } from "../../components/PageGuide";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { demoSnapshot } from "../../data/demo";
import {
  calculateEarnedValue,
  efficiencyStatus,
} from "../../domain/calculations/earnedValue";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatIndex,
  formatPercent,
} from "../../utils/format";
import { PerformanceChart } from "./PerformanceChart";

const criticalRiskCount = demoSnapshot.risks.filter(
  (risk) => risk.rating === "critical",
).length;

export function OverviewPage() {
  const { selectedWorkPackage, setSelectedWorkPackage } = useProjectStore();
  const { snapshot, status, error } = useProjectPerformance();
  const currentPoint =
    [...snapshot.trend]
      .reverse()
      .find((candidate) => candidate.period <= snapshot.project.reportingDate) ??
    snapshot.trend.at(-1);
  if (currentPoint === undefined) {
    throw new Error("The selected dataset has no performance periods.");
  }
  const projectMetrics = calculateEarnedValue({
    bac: snapshot.project.originalBac,
    pv: currentPoint.pv,
    ev: currentPoint.ev,
    ac: currentPoint.ac,
  });
  const finishVarianceDays = differenceInCalendarDays(
    parseISO(snapshot.project.forecastFinish),
    parseISO(snapshot.project.baselineFinish),
  );
  const effectiveWorkPackage = snapshot.workPackages.some(
    (workPackage) => workPackage.id === selectedWorkPackage,
  )
    ? selectedWorkPackage
    : "all";
  const selectedPackage = snapshot.workPackages.find(
    (workPackage) => workPackage.id === effectiveWorkPackage,
  );
  const sourceDescription =
    snapshot.source === "active-import"
      ? `${snapshot.importId} is active: ${snapshot.activities.length} schedule rows and ${snapshot.performance.length} performance rows feed these figures.`
      : "No validated generation is active in this browser, so the labelled synthetic demonstration snapshot is shown.";

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
        className={
          "source-banner " +
          (snapshot.source === "active-import"
            ? "source-banner--active"
            : "source-banner--fallback")
        }
        aria-label="Dashboard data source"
      >
        <Database size={19} aria-hidden="true" />
        <div>
          <strong>
            {status === "loading"
              ? "Checking local data…"
              : snapshot.source === "active-import"
                ? "Validated active generation"
                : "Synthetic fallback in use"}
          </strong>
          <span>{error ? `Local read failed: ${error}` : sourceDescription}</span>
        </div>
      </section>

      <PageGuide
        pageName="Project overview"
        purpose="Start here each week: narrow the scope, read the exceptions first, then trace the numbers that need action."
        steps={[
          {
            title: "Set the scope",
            detail: "Choose all work packages for the project position, or one package to highlight its result.",
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

      <section className="filter-bar" aria-label="Dashboard filters">
        <label htmlFor="work-package-filter">Work package</label>
        <select
          id="work-package-filter"
          value={effectiveWorkPackage}
          onChange={(event) => setSelectedWorkPackage(event.target.value)}
        >
          <option value="all">All work packages</option>
          {snapshot.workPackages.map((workPackage) => (
            <option key={workPackage.id} value={workPackage.id}>
              {workPackage.id} — {workPackage.name}
            </option>
          ))}
        </select>
        <p>
          {selectedPackage
            ? "Highlighting " + selectedPackage.id + " in the work-package table."
            : "Showing the full-project performance position."}
        </p>
      </section>

      <section className="decision-banner" aria-labelledby="decision-title">
        <div className="decision-banner__icon" aria-hidden="true">
          <AlertTriangle size={22} />
        </div>
        <div>
          <p className="eyebrow">Management attention</p>
          <h2 id="decision-title">
            Recovery action is needed to protect the current forecast.
          </h2>
          <p>
            The project is {formatPercent(projectMetrics.earnedCompletion)} earned
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
          value={formatDate(snapshot.project.forecastFinish)}
          status={finishVarianceDays > 0 ? "adverse" : "positive"}
          statusLabel={finishVarianceDays > 0 ? "Late" : "On baseline"}
          delta={(finishVarianceDays > 0 ? "+" : "") + String(finishVarianceDays) + " days"}
          detail={"Baseline " + formatDate(snapshot.project.baselineFinish)}
        />
        <MetricCard
          label="Estimate at completion"
          value={formatCompactCurrency(projectMetrics.managementEac)}
          status="attention"
          statusLabel="Above budget"
          delta={formatCompactCurrency(-projectMetrics.vac)}
          detail="CPI-based management forecast"
        />
        <MetricCard
          label="To-complete performance"
          value={formatIndex(projectMetrics.tcpiBac)}
          status="adverse"
          statusLabel="Recovery required"
          detail="Efficiency needed to recover the original BAC"
        />
      </section>

      <PerformanceChart
        trend={[...snapshot.trend]}
        reportingPeriod={currentPoint.label}
        reportingDate={snapshot.project.reportingDate}
      />

      <section className="panel" aria-labelledby="work-package-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Variance ownership</p>
            <h2 id="work-package-title">Work-package performance</h2>
            <p className="panel__description">
              Current snapshot reconciles to the project BAC, PV, EV and AC totals.
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
              {snapshot.workPackages.map((workPackage) => {
                const metrics = calculateEarnedValue(workPackage);
                const combinedStatus =
                  metrics.spi !== null && metrics.cpi !== null
                    ? efficiencyStatus(Math.min(metrics.spi, metrics.cpi))
                    : "neutral";
                const isSelected = effectiveWorkPackage === workPackage.id;

                return (
                  <tr
                    key={workPackage.id}
                    className={isSelected ? "table-row--selected" : undefined}
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
                <th scope="row" colSpan={2}>Project total</th>
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
        <strong>Supporting registers remain synthetic.</strong>
        <span>Milestone, risk and change editing will be connected to controlled local stores in later increments.</span>
      </section>

      <section className="exception-grid" aria-label="Management exceptions">
        <article className="panel exception-card">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Milestone movement</p>
              <h2>Two forecast late</h2>
            </div>
            <Link to="/milestones">View register</Link>
          </div>
          <ul className="exception-list">
            {demoSnapshot.milestones
              .filter((milestone) => milestone.status === "forecast-late")
              .map((milestone) => (
                <li key={milestone.id}>
                  <div>
                    <strong>{milestone.name}</strong>
                    <span>{milestone.owner}</span>
                  </div>
                  <span>{formatDate(milestone.forecastDate)}</span>
                </li>
              ))}
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
            {demoSnapshot.risks.slice(0, 2).map((risk) => (
              <li key={risk.id}>
                <div>
                  <strong>{risk.title}</strong>
                  <span>{risk.owner}</span>
                </div>
                <StatusPill status={risk.rating === "critical" ? "adverse" : "attention"}>
                  {String(risk.residualScore)} / 25
                </StatusPill>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel exception-card">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Change control</p>
              <h2>Two decisions pending</h2>
            </div>
            <Link to="/changes">View changes</Link>
          </div>
          <ul className="exception-list">
            {demoSnapshot.changes
              .filter((change) => change.status === "submitted")
              .map((change) => (
                <li key={change.id}>
                  <div>
                    <strong>{change.title}</strong>
                    <span>{change.id + " · " + change.wbsId}</span>
                  </div>
                  <span>{formatCompactCurrency(change.costImpact)}</span>
                </li>
              ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
