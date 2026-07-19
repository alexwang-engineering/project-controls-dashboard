import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useProjectPerformance } from "../../app/useProjectPerformance";
import { PageGuide } from "../../components/PageGuide";
import { PageHeader } from "../../components/PageHeader";
import { demoSnapshot } from "../../data/demo";
import {
  buildWeeklyReportSnapshot,
  type WeeklyReportSnapshot,
} from "../../domain/reports/weeklyReport";
import type {
  ChangeRequest,
  Milestone,
  Risk,
} from "../../domain/types";
import type {
  ProjectPerformanceSnapshot,
} from "../../domain/viewModels/projectPerformance";
import { getBrowserRepositories } from "../../repositories/browserRepositories";
import {
  VarianceAnalysisRepository,
  type SignedReportAnalysisQuery,
} from "../../repositories/varianceAnalysisRepository";
import type { VarianceAnalysisRecord } from "../../domain/varianceAnalysis";
import {
  formatCurrency,
  formatDate,
  formatIndex,
} from "../../utils/format";

export interface ReportPageDependencies {
  loadSignedAnalyses: (
    query: SignedReportAnalysisQuery,
  ) => Promise<readonly VarianceAnalysisRecord[]>;
  now: () => string;
}

export interface ReportRegisterInput {
  milestones: readonly Milestone[];
  risks: readonly Risk[];
  changes: readonly ChangeRequest[];
}

const defaultDependencies: ReportPageDependencies = {
  loadSignedAnalyses: (query) =>
    new VarianceAnalysisRepository(
      getBrowserRepositories().db,
    ).loadSignedForReport(query),
  now: () => new Date().toISOString(),
};

const defaultRegisters: ReportRegisterInput = {
  milestones: demoSnapshot.milestones,
  risks: demoSnapshot.risks,
  changes: demoSnapshot.changes,
};

const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const metricRows = (report: WeeklyReportSnapshot) => [
  {
    metric: "Planned value",
    current: formatCurrency(report.currentPeriod.metrics.pv),
    cumulative: formatCurrency(report.cumulative.metrics.pv),
  },
  {
    metric: "Earned value",
    current: formatCurrency(report.currentPeriod.metrics.ev),
    cumulative: formatCurrency(report.cumulative.metrics.ev),
  },
  {
    metric: "Actual cost",
    current: formatCurrency(report.currentPeriod.metrics.ac),
    cumulative: formatCurrency(report.cumulative.metrics.ac),
  },
  {
    metric: "Schedule variance",
    current: formatCurrency(report.currentPeriod.metrics.sv),
    cumulative: formatCurrency(report.cumulative.metrics.sv),
  },
  {
    metric: "Cost variance",
    current: formatCurrency(report.currentPeriod.metrics.cv),
    cumulative: formatCurrency(report.cumulative.metrics.cv),
  },
  {
    metric: "Schedule performance index",
    current: formatIndex(report.currentPeriod.metrics.spi),
    cumulative: formatIndex(report.cumulative.metrics.spi),
  },
  {
    metric: "Cost performance index",
    current: formatIndex(report.currentPeriod.metrics.cpi),
    cumulative: formatIndex(report.cumulative.metrics.cpi),
  },
];

export function ReportPage({
  dependencies = defaultDependencies,
  performanceOverride,
  registerOverride = defaultRegisters,
}: {
  dependencies?: ReportPageDependencies;
  performanceOverride?: ProjectPerformanceSnapshot;
  registerOverride?: ReportRegisterInput;
}) {
  const performanceState = useProjectPerformance();
  const performance = performanceOverride ?? performanceState.snapshot;
  const [report, setReport] = useState<WeeklyReportSnapshot>();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setReport(undefined);
    setError("");
    dependencies
      .loadSignedAnalyses({
        projectId: performance.project.id,
        baselineVersion: performance.project.baselineVersion,
        reportingPeriod: performance.project.reportingDate,
      })
      .then((signedAnalyses) => {
        if (!active) return;
        setReport(
          buildWeeklyReportSnapshot({
            performance,
            signedAnalyses,
            milestones: registerOverride.milestones,
            risks: registerOverride.risks,
            changes: registerOverride.changes,
            generatedAt: dependencies.now(),
            registerSource: "Synthetic ASTER management registers",
          }),
        );
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The weekly report snapshot could not be built.",
        );
      });
    return () => {
      active = false;
    };
  }, [
    dependencies,
    performance,
    registerOverride.changes,
    registerOverride.milestones,
    registerOverride.risks,
  ]);

  return (
    <div className="page-stack report-page">
      <PageHeader
        eyebrow="M7 reporting"
        title="Weekly management report"
        description="A deterministic HTML management snapshot built from the same performance facts, signed variance evidence and controlled baseline position as the dashboard."
        actions={
          <button
            className="button button--secondary no-print"
            type="button"
            disabled={report?.canPublish !== true}
            onClick={() => window.print()}
          >
            <Printer size={17} aria-hidden="true" /> Print approved snapshot
          </button>
        }
      />

      <PageGuide
        pageName="Weekly management report"
        purpose="Use this page to reconcile the reporting facts, resolve every publication blocker, then print the same accessible HTML snapshot."
        steps={[
          {
            title: "Check the gate",
            detail:
              "Start with source, baseline, decision authority and signed-variance controls; blocked evidence cannot be published.",
          },
          {
            title: "Review the position",
            detail:
              "Compare current-period with cumulative metrics, the EAC range and every cause-impact-action exception.",
          },
          {
            title: "Publish one snapshot",
            detail:
              "Use HTML as the authoritative report; print or PDF must reproduce the same generated timestamp and values.",
          },
        ]}
      />

      {error ? (
        <div className="import-error" role="alert">
          <strong>Report snapshot could not be loaded.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {report === undefined && !error ? (
        <div className="route-loading" role="status">
          Reconciling report controls…
        </div>
      ) : null}

      {report ? (
        <article className="report-document" aria-labelledby="report-document-title">
          <header className="report-document__header">
            <div>
              <p className="eyebrow">Weekly control snapshot</p>
              <h2 id="report-document-title">{report.identity.projectName}</h2>
              <p>{report.headline}</p>
            </div>
            <dl className="report-metadata">
              <div><dt>Reporting date</dt><dd>{formatDate(report.identity.reportingPeriod)}</dd></div>
              <div><dt>Baseline</dt><dd>{report.identity.baselineVersion}</dd></div>
              <div><dt>Generated</dt><dd>{formatTimestamp(report.identity.generatedAt)}</dd></div>
              <div><dt>Source</dt><dd>{report.identity.sourceImportId}</dd></div>
            </dl>
          </header>

          <section
            className={`report-gate ${report.canPublish ? "report-gate--passed" : "report-gate--blocked"}`}
            aria-labelledby="report-gate-title"
          >
            {report.canPublish ? (
              <CheckCircle2 size={24} aria-hidden="true" />
            ) : (
              <ShieldAlert size={24} aria-hidden="true" />
            )}
            <div>
              <h2 id="report-gate-title">
                {report.canPublish
                  ? "Publication controls passed"
                  : "Publication controls need attention"}
              </h2>
              {report.controls.length === 0 ? (
                <p>Every current threshold breach has a matching signed revision and no baseline or decision control is blocking publication.</p>
              ) : (
                <ul>
                  {report.controls.map((control, index) => (
                    <li key={`${control.code}-${control.scopeId ?? "project"}-${String(index)}`}>
                      <strong>{control.code.replaceAll("_", " ")}</strong>
                      <span>{control.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="report-section report-executive" aria-labelledby="report-executive-title">
            <p className="eyebrow">Decision-first position</p>
            <h2 id="report-executive-title">Executive position</h2>
            <p className="report-lead">{report.executiveSummary}</p>
            <div className="report-callout">
              <strong>Movement this period</strong>
              <p>{report.movement}</p>
            </div>
          </section>

          <section className="report-section" aria-labelledby="report-kpi-title">
            <div className="report-section__heading">
              <div><p className="eyebrow">Performance reconciliation</p><h2 id="report-kpi-title">Current-period and cumulative status</h2></div>
              <span>{report.currentPeriod.label} · {formatDate(report.currentPeriod.period)}</span>
            </div>
            <div className="table-scroll">
              <table>
                <caption>Current-period and cumulative performance</caption>
                <thead><tr><th scope="col">Metric</th><th scope="col">Current period</th><th scope="col">Cumulative</th></tr></thead>
                <tbody>
                  {metricRows(report).map((row) => (
                    <tr key={row.metric}><th scope="row">{row.metric}</th><td>{row.current}</td><td>{row.cumulative}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-section" aria-labelledby="report-forecast-title">
            <div className="report-section__heading">
              <div><p className="eyebrow">Forecast sensitivity</p><h2 id="report-forecast-title">EAC range and selected basis</h2></div>
              <strong>{formatCurrency(report.forecast.minimumEac)} to {formatCurrency(report.forecast.maximumEac)}</strong>
            </div>
            <div className="report-scenario-grid">
              {report.forecast.scenarios.map((scenario) => (
                <article key={scenario.id} className={scenario.id === report.forecast.selectedScenario ? "report-scenario report-scenario--selected" : "report-scenario"}>
                  <span>{scenario.id === report.forecast.selectedScenario ? "Selected basis" : "Sensitivity"}</span>
                  <h3>{scenario.label}</h3>
                  <strong>{scenario.value === null ? "Not available" : formatCurrency(scenario.value)}</strong>
                  <code>{scenario.formula}</code>
                  <p>{scenario.unavailableReason ?? scenario.assumption}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="report-section" aria-labelledby="report-variance-title">
            <div className="report-section__heading">
              <div><p className="eyebrow">Cause, impact and action</p><h2 id="report-variance-title">Work-package variance exceptions</h2></div>
              <span>{report.varianceExceptions.length} threshold exception{report.varianceExceptions.length === 1 ? "" : "s"}</span>
            </div>
            {report.varianceExceptions.length === 0 ? <p>No variance exception is required.</p> : (
              <div className="table-scroll"><table><caption>Signed variance-analysis coverage</caption><thead><tr><th scope="col">Scope</th><th scope="col">Metrics</th><th scope="col">Analysis</th><th scope="col">Cause and impact</th><th scope="col">Action / owner / due</th></tr></thead><tbody>
                {report.varianceExceptions.map((exception) => (
                  <tr key={exception.scopeId}><th scope="row"><span className="table-primary">{exception.scopeName}</span><span className="table-secondary">{exception.scopeId === "all" ? "Project total" : exception.scopeId}</span></th><td>{exception.breachedMetrics.join(" · ")}</td><td>{exception.analysisStatus === "signed" ? `Signed revision ${String(exception.signedRevision)}` : exception.analysisStatus === "stale" ? "Stale — re-sign required" : "Required before publication"}</td><td>{exception.rootCause ? <><span className="table-primary">{exception.rootCause}</span><span className="table-secondary">{exception.impact}</span></> : "No approved causal evidence"}</td><td>{exception.correctiveAction ? <><span className="table-primary">{exception.correctiveAction}</span><span className="table-secondary">{exception.owner} · {exception.dueDate ? formatDate(exception.dueDate) : "No due date"}</span></> : `${exception.accountableOwner} must complete the analysis.`}</td></tr>
                ))}
              </tbody></table></div>
            )}
          </section>

          <section className="report-section" aria-labelledby="report-milestone-title">
            <div className="report-section__heading"><div><p className="eyebrow">Commitments</p><h2 id="report-milestone-title">Milestone exceptions</h2></div><span>{report.milestoneExceptions.length} exceptions</span></div>
            {report.milestoneExceptions.length === 0 ? <p>No milestone exception is recorded.</p> : <ul className="report-record-list">{report.milestoneExceptions.map((milestone) => <li key={milestone.id}><AlertTriangle size={18} aria-hidden="true" /><div><strong>{milestone.name} · +{milestone.varianceDays} days</strong><span>{milestone.owner} · {formatDate(milestone.outcomeDate)}</span><p>{milestone.commentary}</p></div></li>)}</ul>}
          </section>

          <section className="report-section report-two-column" aria-label="Risk and decision exceptions">
            <div><p className="eyebrow">Residual exposure</p><h2>Top risks</h2>{report.topRisks.length === 0 ? <p>No high, critical or triggered risk is recorded.</p> : <ol className="report-compact-list">{report.topRisks.map((risk) => <li key={risk.id}><strong>{risk.id} · {risk.title}</strong><span>{risk.owner} · score {risk.residualScore} · trigger {risk.triggerStatus}</span></li>)}</ol>}</div>
            <div><p className="eyebrow">Leadership input</p><h2>Decisions required</h2>{report.changeDecisions.length === 0 ? <p>No submitted change decision is due.</p> : <ol className="report-compact-list">{report.changeDecisions.map((change) => <li key={change.id}><strong>{change.id} · {change.title}</strong><span>Authority not supplied · required {formatDate(change.requiredBy)} · {formatCurrency(change.costImpact)}</span></li>)}</ol>}</div>
          </section>

          <section className="report-section" aria-labelledby="report-actions-title">
            <div className="report-section__heading"><div><p className="eyebrow">Next period</p><h2 id="report-actions-title">Owned corrective actions</h2></div><span>{report.actions.length} signed actions</span></div>
            {report.actions.length === 0 ? <p>No publishable action is available until current variance analyses are signed.</p> : <div className="table-scroll"><table><caption>Corrective actions for the next period</caption><thead><tr><th scope="col">Scope</th><th scope="col">Action</th><th scope="col">Owner</th><th scope="col">Due</th><th scope="col">Status / evidence</th></tr></thead><tbody>{report.actions.map((action) => <tr key={action.scopeId}><th scope="row">{action.scopeId}</th><td>{action.action}</td><td>{action.owner}</td><td>{formatDate(action.dueDate)}</td><td><span className="table-primary">{action.status}</span><span className="table-secondary">{action.evidence}</span></td></tr>)}</tbody></table></div>}
          </section>

          <section className="report-section" aria-labelledby="report-baseline-title">
            <div className="report-section__heading"><div><p className="eyebrow">Change integrity</p><h2 id="report-baseline-title">Baseline and change reconciliation</h2></div><FileCheck2 size={22} aria-hidden="true" /></div>
            <div className="report-baseline-grid">
              <div><span>Active baseline</span><strong>{report.baseline.activeVersion}</strong><small>{formatCurrency(report.baseline.activeBac)} BAC</small></div>
              <div><span>Incorporated in active baseline</span><strong>{formatCurrency(report.baseline.incorporatedInActiveBaseline)}</strong></div>
              <div><span>Approved, not incorporated</span><strong>{formatCurrency(report.baseline.approvedNotIncorporated)}</strong></div>
              <div><span>Other referenced baselines</span><strong>{report.baseline.otherBaselineVersions.length === 0 ? "None" : report.baseline.otherBaselineVersions.join(", ")}</strong></div>
            </div>
          </section>

          <section className="report-section report-sources" aria-labelledby="report-sources-title">
            <p className="eyebrow">Assumptions and traceability</p><h2 id="report-sources-title">Sources and data-quality notes</h2>
            <ul>{report.sourceNotes.map((note) => <li key={note}>{note}</li>)}</ul>
          </section>
        </article>
      ) : null}
    </div>
  );
}
