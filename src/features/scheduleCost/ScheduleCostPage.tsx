import { BarChart3, CalendarDays, Database, SearchCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import {
  buildEacScenarios,
  type EacScenarioId,
} from "../../domain/calculations/eacScenarios";
import { createVarianceAnalysisContext } from "../../domain/varianceAnalysis";
import {
  activityPerformanceAtPeriod,
  periodicPerformanceForScope,
  resolveWorkPackageScope,
  type ProjectPerformanceSnapshot,
} from "../../domain/viewModels/projectPerformance";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatIndex,
  formatPercent,
} from "../../utils/format";
import { EacScenarioPanel } from "./EacScenarioPanel";
import { VarianceAnalysisPanel } from "./VarianceAnalysisPanel";

export function ScheduleCostPage() {
  const { snapshot } = useProjectPerformance();

  if (snapshot === undefined) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="M2–M3 performance"
          title="Schedule and cost"
          description="Calculated schedule and cost performance will appear after your project data is imported."
        />
        <PageGuide
          pageName="Schedule and cost"
          state="Setup required"
          purpose="Import a matching schedule and periodic-performance pair before calculating variances or forecasts."
          steps={[
            { title: "Prepare the files", detail: "Use the schedule and performance CSV templates described on the data-input page." },
            { title: "Validate and commit", detail: "Resolve every blocking validation issue and confirm the project registry." },
            { title: "Analyse performance", detail: "Return here to trace PV, EV, AC, schedule variance, cost variance and EAC." },
          ]}
        />
        <ProjectSetupRequired
          title="Import schedule and cost data to calculate performance"
          detail="No figures are calculated or displayed until your validated schedule and periodic-performance files are active."
        />
      </div>
    );
  }

  return <ScheduleCostWorkspace key={snapshot.importId} snapshot={snapshot} />;
}

function ScheduleCostWorkspace({
  snapshot,
}: {
  snapshot: ProjectPerformanceSnapshot;
}) {
  const selectedWorkPackage = useProjectStore(
    (state) => state.selectedWorkPackage,
  );
  const workPackageId = resolveWorkPackageScope(
    snapshot,
    selectedWorkPackage,
  );
  const [selectedPeriod, setSelectedPeriod] = useState(
    snapshot.project.reportingDate,
  );
  const [managementScenario, setManagementScenario] =
    useState<EacScenarioId>("cpi");

  const scopedPeriods = useMemo(
    () => periodicPerformanceForScope(snapshot, workPackageId),
    [snapshot, workPackageId],
  );

  useEffect(() => {
    if (!scopedPeriods.some((period) => period.period === selectedPeriod)) {
      setSelectedPeriod(
        scopedPeriods.at(-1)?.period ?? snapshot.project.reportingDate,
      );
    }
  }, [scopedPeriods, selectedPeriod, snapshot.project.reportingDate]);

  const selectedPackage = snapshot.workPackages.find(
    (workPackage) => workPackage.id === workPackageId,
  );
  const cumulativeRows = scopedPeriods.reduce(
    (rows, period) => {
      const previous = rows.at(-1) ?? { cumulativePv: 0, cumulativeEv: 0, cumulativeAc: 0 };
      rows.push({
        ...period,
        cumulativePv: previous.cumulativePv + period.pv,
        cumulativeEv: previous.cumulativeEv + period.ev,
        cumulativeAc: previous.cumulativeAc + period.ac,
      });
      return rows;
    },
    [] as Array<
      (typeof scopedPeriods)[number] & {
        cumulativePv: number;
        cumulativeEv: number;
        cumulativeAc: number;
      }
    >,
  );
  const selectedRow =
    cumulativeRows.find((period) => period.period === selectedPeriod) ??
    cumulativeRows.at(-1);
  const bac = selectedPackage?.bac ?? snapshot.project.originalBac;
  const baseMetrics = calculateEarnedValue({
    bac,
    pv: selectedRow?.cumulativePv ?? 0,
    ev: selectedRow?.cumulativeEv ?? 0,
    ac: selectedRow?.cumulativeAc ?? 0,
  });
  const scenarios = buildEacScenarios(baseMetrics);
  const selectedScenario = scenarios.find(
    (scenario) => scenario.id === managementScenario,
  );
  const selectedManagementEac =
    selectedScenario?.available === true ? selectedScenario.value : null;
  const metrics = calculateEarnedValue({
    bac,
    pv: selectedRow?.cumulativePv ?? 0,
    ev: selectedRow?.cumulativeEv ?? 0,
    ac: selectedRow?.cumulativeAc ?? 0,
    ...(selectedManagementEac === null || selectedManagementEac === undefined
      ? {}
      : { managementEac: selectedManagementEac }),
  });
  const effectiveScenario =
    selectedScenario?.available === true ? managementScenario : "budget-rate";
  const varianceContext = createVarianceAnalysisContext({
    projectId: snapshot.project.id,
    baselineVersion: snapshot.project.baselineVersion,
    scopeId: workPackageId,
    reportingPeriod: selectedPeriod,
    sourceImportId:
      snapshot.source === "active-import"
        ? snapshot.importId
        : `SYNTHETIC-${snapshot.importId}`,
    expectedActiveImportId:
      snapshot.source === "active-import" ? snapshot.importId : null,
    managementScenario: effectiveScenario,
    metrics,
  });
  const scopedActivities = snapshot.activities.filter(
    (activity) =>
      workPackageId === "all" || activity.wbsId === workPackageId,
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="M2–M3 performance"
        title="Schedule and cost"
        description="Trace planned value, earned value and actual cost from the selected control period to its accountable activity."
        actions={
          <div className="snapshot-chip">
            <CalendarDays size={17} aria-hidden="true" />
            <span>
              <small>Selected period</small>
              {formatDate(selectedPeriod)}
            </span>
          </div>
        }
      />

      <PageGuide
        pageName="Schedule and cost"
        purpose="Use this page after spotting an adverse headline: retain the global scope, compare schedule and cost efficiency, then trace the variance to an activity and owner."
        steps={[
          {
            title: "Set scope and period",
            detail: "Use the global bar above for the whole project or one work package, then select the control period to investigate.",
          },
          {
            title: "Compare the indices",
            detail: "SPI below 1.00 is behind plan; CPI below 1.00 means the work is costing more than its earned value.",
          },
          {
            title: "Trace and assign",
            detail: "Select a stated EAC assumption, trace the source evidence, then save and sign a complete cause-impact-action record.",
          },
        ]}
      />

      <section
        className="source-banner source-banner--active"
        aria-label="Performance data source"
      >
        <Database size={19} aria-hidden="true" />
        <div>
          <strong>
            Calculated from the active project import
          </strong>
          <span>
            {snapshot.importId} · {snapshot.activities.length} activities · {snapshot.periods.length} reporting period{snapshot.periods.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      <section className="filter-bar" aria-label="Schedule and cost filters">
        <label htmlFor="performance-period">Reporting period</label>
        <select
          id="performance-period"
          value={selectedPeriod}
          onChange={(event) => setSelectedPeriod(event.target.value)}
        >
          {scopedPeriods.map((period) => (
            <option key={period.period} value={period.period}>
              {period.label} — {formatDate(period.period)}
            </option>
          ))}
        </select>
        <p>
          {selectedPackage
            ? `${selectedPackage.owner} owns ${selectedPackage.id}; the global scope is retained across management views.`
            : "Project totals include every accepted work package."}
        </p>
      </section>

      <section className="metric-grid" aria-label="Selected scope performance indicators">
        <MetricCard
          label="Planned value"
          value={formatCompactCurrency(metrics.pv)}
          status="neutral"
          statusLabel="To period"
          detail={`BAC ${formatCompactCurrency(metrics.bac)}`}
        />
        <MetricCard
          label="Earned value"
          value={formatCompactCurrency(metrics.ev)}
          status={efficiencyStatus(metrics.spi)}
          statusLabel={metrics.sv < 0 ? "Behind plan" : "On plan"}
          delta={formatCompactCurrency(metrics.sv)}
          detail={`${formatPercent(metrics.earnedCompletion)} earned complete`}
        />
        <MetricCard
          label="Actual cost"
          value={formatCompactCurrency(metrics.ac)}
          status={efficiencyStatus(metrics.cpi)}
          statusLabel={metrics.cv < 0 ? "Over cost" : "Controlled"}
          delta={formatCompactCurrency(metrics.cv)}
          detail={`${formatPercent(metrics.budgetSpent)} of BAC spent`}
        />
        <MetricCard
          label="Schedule performance index"
          value={formatIndex(metrics.spi)}
          status={efficiencyStatus(metrics.spi)}
          statusLabel={metrics.sv < 0 ? "Adverse" : "Controlled"}
          detail="EV ÷ PV; below 1.00 is behind plan"
        />
        <MetricCard
          label="Cost performance index"
          value={formatIndex(metrics.cpi)}
          status={efficiencyStatus(metrics.cpi)}
          statusLabel={metrics.cv < 0 ? "Adverse" : "Controlled"}
          detail="EV ÷ AC; below 1.00 is inefficient"
        />
        <MetricCard
          label="Estimate at completion"
          value={formatCompactCurrency(metrics.managementEac)}
          status={metrics.vac < 0 ? "attention" : "positive"}
          statusLabel={metrics.vac < 0 ? "Above budget" : "Within budget"}
          delta={formatCompactCurrency(metrics.vac)}
          detail={`TCPI ${formatIndex(metrics.tcpiBac)} to recover BAC`}
        />
      </section>

      <EacScenarioPanel
        scenarios={scenarios}
        selectedScenarioId={effectiveScenario}
        metrics={metrics}
        onSelect={setManagementScenario}
      />

      <section className="panel" aria-labelledby="period-trace-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Period reconciliation</p>
            <h2 id="period-trace-title">Periodic and cumulative performance</h2>
            <p className="panel__description">Each cumulative row is the sum of accepted periodic records up to that date.</p>
          </div>
          <span className="reporting-period">{scopedPeriods.length} period{scopedPeriods.length === 1 ? "" : "s"}</span>
        </div>
        <div
          className="table-scroll"
          role="region"
          aria-label="Periodic and cumulative performance table; scroll horizontally to see every measure"
          tabIndex={0}
        >
          <table>
            <caption className="sr-only">Periodic and cumulative earned-value performance</caption>
            <thead>
              <tr><th scope="col">Period</th><th scope="col">PV period</th><th scope="col">EV period</th><th scope="col">AC period</th><th scope="col">PV cumulative</th><th scope="col">EV cumulative</th><th scope="col">AC cumulative</th></tr>
            </thead>
            <tbody>
              {cumulativeRows.map((period) => (
                <tr key={period.period} className={period.period === selectedPeriod ? "table-row--selected" : undefined}>
                  <th scope="row"><span className="table-primary">{period.label}</span><span className="table-secondary">{formatDate(period.period)}</span></th>
                  <td>{formatCurrency(period.pv)}</td><td>{formatCurrency(period.ev)}</td><td>{formatCurrency(period.ac)}</td>
                  <td>{formatCurrency(period.cumulativePv)}</td><td>{formatCurrency(period.cumulativeEv)}</td><td>{formatCurrency(period.cumulativeAc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" aria-labelledby="activity-trace-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Source trace</p>
            <h2 id="activity-trace-title">Activity performance evidence</h2>
            <p className="panel__description">Cumulative values and latest progress commentary for the selected scope and period.</p>
          </div>
          <span className="reporting-period"><SearchCheck size={15} aria-hidden="true" /> {scopedActivities.length} activities</span>
        </div>
        {snapshot.performance.length === 0 ? (
          <div className="trace-empty">
            <BarChart3 size={23} aria-hidden="true" />
            <div><strong>No activity-period records are active.</strong><span>Import a performance file containing accepted activity-period records to enable the source trace.</span></div>
          </div>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Activity performance evidence table; scroll horizontally to see every measure"
            tabIndex={0}
          >
            <table className="activity-trace-table">
              <caption className="sr-only">Activity-level schedule and cost evidence</caption>
              <thead><tr><th scope="col">Activity</th><th scope="col">Owner</th><th scope="col">BAC</th><th scope="col">PV</th><th scope="col">EV</th><th scope="col">AC</th><th scope="col">SV</th><th scope="col">CV</th><th scope="col">Physical complete</th><th scope="col">Evidence</th></tr></thead>
              <tbody>
                {scopedActivities.map((activity) => {
                  const performance = activityPerformanceAtPeriod(snapshot, activity.id, selectedPeriod);
                  const activityMetrics = calculateEarnedValue({ bac: activity.bac, ...performance });
                  const position = efficiencyStatus(
                    activityMetrics.spi === null || activityMetrics.cpi === null
                      ? null
                      : Math.min(activityMetrics.spi, activityMetrics.cpi),
                  );
                  return (
                    <tr key={activity.id}>
                      <th scope="row"><span className="table-primary">{activity.id} · {activity.name}</span><span className="table-secondary">{activity.wbsId} · forecast {formatDate(activity.forecastFinish)}</span></th>
                      <td>{activity.owner}</td><td>{formatCurrency(activity.bac)}</td><td>{formatCurrency(performance.pv)}</td><td>{formatCurrency(performance.ev)}</td><td>{formatCurrency(performance.ac)}</td>
                      <td className={activityMetrics.sv < 0 ? "number--adverse" : undefined}>{formatCurrency(activityMetrics.sv)}</td>
                      <td className={activityMetrics.cv < 0 ? "number--adverse" : undefined}>{formatCurrency(activityMetrics.cv)}</td>
                      <td>{performance.physicalPercentComplete === undefined ? "Not reported" : `${performance.physicalPercentComplete.toFixed(1)}%`}</td>
                      <td><StatusPill status={position}>{position === "positive" ? "Controlled" : position === "attention" ? "Watch" : "Recover"}</StatusPill><span className="table-secondary">{performance.commentary ?? activity.commentary}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <VarianceAnalysisPanel context={varianceContext} />
    </div>
  );
}
