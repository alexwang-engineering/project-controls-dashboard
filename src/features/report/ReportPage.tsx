import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FilePlus2,
  History,
  Printer,
  Save,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useProjectStore } from "../../app/store";
import { useProjectPerformance } from "../../app/useProjectPerformance";
import { PageGuide } from "../../components/PageGuide";
import { PageHeader } from "../../components/PageHeader";
import { ProjectSetupRequired } from "../../components/ProjectSetupRequired";
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
  buildReportSourceFingerprint,
  emptyReportNarrative,
  validateReportNarrativeForPublication,
  type WeeklyReportNarrative,
  type WeeklyReportPublicationRecord,
  type WeeklyReportSourceEvidence,
} from "../../domain/reports/reportPublication";
import {
  type PublishReportInput,
  type ReportPublicationContextState,
  type ReportPublicationQuery,
  type SaveReportDraftInput,
} from "../../repositories/reportPublicationRepository";
import {
  formatCurrency,
  formatDate,
  formatIndex,
} from "../../utils/format";

export interface ReportPageDependencies {
  loadSignedAnalyses: (
    query: SignedReportAnalysisQuery,
  ) => Promise<readonly VarianceAnalysisRecord[]>;
  loadPublicationContext: (
    query: ReportPublicationQuery,
  ) => Promise<ReportPublicationContextState>;
  saveReportDraft: (
    input: SaveReportDraftInput,
  ) => Promise<WeeklyReportPublicationRecord>;
  publishReport: (
    input: PublishReportInput,
  ) => Promise<WeeklyReportPublicationRecord>;
  now: () => string;
  print: () => void;
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
  loadPublicationContext: (query) =>
    getBrowserRepositories().reportPublications.loadContext(query),
  saveReportDraft: (input) =>
    getBrowserRepositories().reportPublications.saveDraft(input),
  publishReport: (input) =>
    getBrowserRepositories().reportPublications.publish(input),
  now: () => new Date().toISOString(),
  print: () => window.print(),
};

const generatedNarrative = (report: WeeklyReportSnapshot): WeeklyReportNarrative => ({
  ...emptyReportNarrative,
  managementSummary: report.executiveSummary,
  decisionsRequired:
    report.changeDecisions.length === 0
      ? "No additional management decision is currently required."
      : `Decide ${report.changeDecisions.map(({ id }) => id).join(", ")} within the recorded required dates.`,
  nextPeriodFocus:
    report.actions.length === 0
      ? "Maintain the current controls and prepare the next reporting update."
      : `Complete and evidence ${report.actions.length} owned corrective action${report.actions.length === 1 ? "" : "s"}.`,
});

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
  registerOverride,
}: {
  dependencies?: ReportPageDependencies;
  performanceOverride?: ProjectPerformanceSnapshot;
  registerOverride?: ReportRegisterInput;
}) {
  const performanceState = useProjectPerformance();
  const {
    milestones,
    risks,
    changes,
  } = useProjectStore();
  const performance = performanceOverride ?? performanceState.snapshot;
  const registers = registerOverride ?? { milestones, risks, changes };

  if (performance === undefined) {
    return (
      <div className="page-stack report-page">
        <PageHeader
          eyebrow="M7 reporting"
          title="Weekly management report"
          description="The management report is generated only from your active project data and entered registers."
        />
        <PageGuide
          pageName="Weekly management report"
          state="Setup required"
          purpose="Complete the project input and control evidence before generating a management report."
          steps={[
            { title: "Import project data", detail: "Commit a validated schedule and periodic-performance pair." },
            { title: "Complete control records", detail: "Enter milestones, risks and change requests, then sign required variance analyses." },
            { title: "Generate the report", detail: "Return here to reconcile the facts and print an approved snapshot." },
          ]}
        />
        <ProjectSetupRequired
          title="Import project data before generating a report"
          detail="The app will not create a report from placeholders. Your active import and local management-register entries are required."
        />
      </div>
    );
  }

  return (
    <ReportWorkspace
      dependencies={dependencies}
      performance={performance}
      registers={registers}
    />
  );
}

function ReportWorkspace({
  dependencies,
  performance,
  registers,
}: {
  dependencies: ReportPageDependencies;
  performance: ProjectPerformanceSnapshot;
  registers: ReportRegisterInput;
}) {
  const [liveReport, setLiveReport] = useState<WeeklyReportSnapshot>();
  const [sourceEvidence, setSourceEvidence] =
    useState<WeeklyReportSourceEvidence>();
  const [sourceFingerprint, setSourceFingerprint] = useState("");
  const [narrative, setNarrative] =
    useState<WeeklyReportNarrative>(emptyReportNarrative);
  const [publicationState, setPublicationState] =
    useState<ReportPublicationContextState>({
      publishedRevisions: [],
      retainedDraftCount: 0,
    });
  const [selectedPublication, setSelectedPublication] =
    useState<WeeklyReportPublicationRecord>();
  const [publicationConfirmed, setPublicationConfirmed] = useState(false);
  const [publicationMessage, setPublicationMessage] = useState("");
  const [publicationBusy, setPublicationBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLiveReport(undefined);
    setSourceEvidence(undefined);
    setSourceFingerprint("");
    setSelectedPublication(undefined);
    setPublicationMessage("");
    setError("");
    dependencies
      .loadSignedAnalyses({
        projectId: performance.project.id,
        baselineVersion: performance.project.baselineVersion,
        reportingPeriod: performance.project.reportingDate,
      })
      .then((signedAnalyses) => {
        if (!active) return;
        const built = buildWeeklyReportSnapshot({
            performance,
            signedAnalyses,
            milestones: registers.milestones,
            risks: registers.risks,
            changes: registers.changes,
            generatedAt: dependencies.now(),
            registerSource: "User-entered local management registers",
          });
        const evidence: WeeklyReportSourceEvidence = {
          activeImportId: performance.importId,
          signedAnalyses,
          milestones: registers.milestones,
          risks: registers.risks,
          changes: registers.changes,
        };
        const fingerprint = buildReportSourceFingerprint(built, evidence);
        return dependencies
          .loadPublicationContext({
            projectId: built.identity.projectId,
            baselineVersion: built.identity.baselineVersion,
            reportingPeriod: built.identity.reportingPeriod,
            sourceImportId: built.identity.sourceImportId,
          })
          .then((stored) => {
            if (!active) return;
            setLiveReport(built);
            setSourceEvidence(evidence);
            setSourceFingerprint(fingerprint);
            setPublicationState(stored);
            setSelectedPublication(stored.publishedRevisions[0]);
            setNarrative(
              stored.currentDraft?.sourceFingerprint === fingerprint
                ? stored.currentDraft.narrative
                : generatedNarrative(built),
            );
          });
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
    registers.changes,
    registers.milestones,
    registers.risks,
  ]);

  const report = selectedPublication?.report ?? liveReport;
  const narrativeErrors = validateReportNarrativeForPublication(narrative);
  const publicationInput =
    liveReport === undefined || sourceEvidence === undefined
      ? undefined
      : {
          report: liveReport,
          evidence: sourceEvidence,
          sourceFingerprint,
          narrative,
        };
  const currentDraftMatches =
    publicationState.currentDraft?.sourceFingerprint === sourceFingerprint &&
    JSON.stringify(publicationState.currentDraft.narrative) ===
      JSON.stringify(narrative);

  const updateNarrative = (field: keyof WeeklyReportNarrative, value: string) => {
    setNarrative((current) => ({ ...current, [field]: value }));
    setPublicationConfirmed(false);
    setPublicationMessage("");
  };

  const saveDraft = () => {
    if (publicationInput === undefined) return;
    setPublicationBusy(true);
    setPublicationMessage("");
    dependencies
      .saveReportDraft({
        ...publicationInput,
        savedAt: dependencies.now(),
      })
      .then((saved) => {
        setPublicationState((current) => ({ ...current, currentDraft: saved }));
        setNarrative(saved.narrative);
        setPublicationConfirmed(false);
        setPublicationMessage("Draft saved against the current source fingerprint.");
      })
      .catch((saveError: unknown) =>
        setPublicationMessage(
          saveError instanceof Error ? saveError.message : "The draft could not be saved.",
        ),
      )
      .finally(() => setPublicationBusy(false));
  };

  const publish = () => {
    if (publicationInput === undefined || !publicationConfirmed) return;
    setPublicationBusy(true);
    setPublicationMessage("");
    dependencies
      .publishReport({
        ...publicationInput,
        publishedAt: dependencies.now(),
      })
      .then((published) => {
        setPublicationState((current) => ({
          ...current,
          currentDraft: undefined,
          publishedRevisions: [published, ...current.publishedRevisions],
        }));
        setSelectedPublication(published);
        setPublicationConfirmed(false);
        setPublicationMessage(`Published immutable revision ${String(published.revision)}.`);
      })
      .catch((publishError: unknown) =>
        setPublicationMessage(
          publishError instanceof Error
            ? publishError.message
            : "The report could not be published.",
        ),
      )
      .finally(() => setPublicationBusy(false));
  };

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
            disabled={selectedPublication === undefined}
            onClick={dependencies.print}
          >
            <Printer size={17} aria-hidden="true" /> Print selected publication
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

      {liveReport === undefined && !error ? (
        <div className="route-loading" role="status">
          Reconciling report controls…
        </div>
      ) : null}

      {liveReport ? (
        <section className="report-publication no-print" aria-labelledby="report-publication-title">
          <div className="report-section__heading">
            <div>
              <p className="eyebrow">Controlled publication</p>
              <h2 id="report-publication-title">Management narrative and immutable history</h2>
            </div>
            <span>{publicationState.publishedRevisions.length} published revision{publicationState.publishedRevisions.length === 1 ? "" : "s"}</span>
          </div>
          <p>
            Edit the decision-focused narrative, save it against the current source fingerprint, then publish. Published revisions cannot be overwritten; print uses only the selected stored revision.
          </p>
          <div className="report-publication__form">
            <label>
              Report author
              <input aria-label="Report author" aria-invalid={!narrativeErrors.success && narrativeErrors.fieldErrors.author !== undefined} aria-describedby={!narrativeErrors.success && narrativeErrors.fieldErrors.author !== undefined ? "report-author-error" : undefined} value={narrative.author} maxLength={80} onChange={(event) => updateNarrative("author", event.target.value)} />
              {narrativeErrors.success ? null : <small id="report-author-error">{narrativeErrors.fieldErrors.author}</small>}
            </label>
            <label className="report-publication__wide">
              Management summary
              <textarea aria-label="Management summary" aria-invalid={!narrativeErrors.success && narrativeErrors.fieldErrors.managementSummary !== undefined} aria-describedby={!narrativeErrors.success && narrativeErrors.fieldErrors.managementSummary !== undefined ? "report-summary-error" : undefined} value={narrative.managementSummary} maxLength={2_000} rows={4} onChange={(event) => updateNarrative("managementSummary", event.target.value)} />
              {narrativeErrors.success ? null : <small id="report-summary-error">{narrativeErrors.fieldErrors.managementSummary}</small>}
            </label>
            <label>
              Decisions required
              <textarea aria-label="Decisions required" aria-invalid={!narrativeErrors.success && narrativeErrors.fieldErrors.decisionsRequired !== undefined} aria-describedby={!narrativeErrors.success && narrativeErrors.fieldErrors.decisionsRequired !== undefined ? "report-decisions-error" : undefined} value={narrative.decisionsRequired} maxLength={1_500} rows={3} onChange={(event) => updateNarrative("decisionsRequired", event.target.value)} />
              {narrativeErrors.success ? null : <small id="report-decisions-error">{narrativeErrors.fieldErrors.decisionsRequired}</small>}
            </label>
            <label>
              Next-period focus
              <textarea aria-label="Next-period focus" aria-invalid={!narrativeErrors.success && narrativeErrors.fieldErrors.nextPeriodFocus !== undefined} aria-describedby={!narrativeErrors.success && narrativeErrors.fieldErrors.nextPeriodFocus !== undefined ? "report-focus-error" : undefined} value={narrative.nextPeriodFocus} maxLength={1_500} rows={3} onChange={(event) => updateNarrative("nextPeriodFocus", event.target.value)} />
              {narrativeErrors.success ? null : <small id="report-focus-error">{narrativeErrors.fieldErrors.nextPeriodFocus}</small>}
            </label>
          </div>
          <div className="report-publication__actions">
            <button className="button button--secondary" type="button" disabled={publicationBusy} onClick={saveDraft}>
              <Save size={17} aria-hidden="true" /> Save current draft
            </button>
            <label className="checkbox-row">
              <input type="checkbox" checked={publicationConfirmed} onChange={(event) => setPublicationConfirmed(event.target.checked)} />
              I confirm this narrative and the frozen source evidence are ready to publish.
            </label>
            <button className="button button--primary" type="button" disabled={publicationBusy || !publicationConfirmed || !narrativeErrors.success || !liveReport.canPublish || !currentDraftMatches} onClick={publish}>
              <FilePlus2 size={17} aria-hidden="true" /> Publish immutable revision
            </button>
          </div>
          {publicationMessage ? <p className="form-status" role="status">{publicationMessage}</p> : null}
          {publicationState.retainedDraftCount > 0 ? <p className="control-note">{publicationState.retainedDraftCount} draft{publicationState.retainedDraftCount === 1 ? "" : "s"} from earlier source generations remain retained for audit.</p> : null}
          <div className="report-publication__history" aria-label="Published report history">
            <History size={19} aria-hidden="true" />
            <button className={selectedPublication === undefined ? "button button--small button--active" : "button button--small"} type="button" onClick={() => setSelectedPublication(undefined)}>View current live draft</button>
            {publicationState.publishedRevisions.map((published) => (
              <button key={published.recordId} className={selectedPublication?.recordId === published.recordId ? "button button--small button--active" : "button button--small"} type="button" onClick={() => setSelectedPublication(published)}>
                Revision {String(published.revision)} · {published.publishedAt ? formatTimestamp(published.publishedAt) : "Published"}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {report ? (
        <article className="report-document" aria-labelledby="report-document-title">
          {selectedPublication ? (
            <section className="report-publication-banner" aria-label="Published revision">
              <strong>Published revision {String(selectedPublication.revision)}</strong>
              <span>{selectedPublication.publishedAt ? formatTimestamp(selectedPublication.publishedAt) : "Publication time unavailable"} · {selectedPublication.narrative.author}</span>
            </section>
          ) : null}
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
            <p className="report-lead">{selectedPublication?.narrative.managementSummary ?? report.executiveSummary}</p>
            <div className="report-callout">
              <strong>Movement this period</strong>
              <p>{report.movement}</p>
            </div>
            {selectedPublication ? (
              <div className="report-management-narrative">
                <div><strong>Decisions required</strong><p>{selectedPublication.narrative.decisionsRequired}</p></div>
                <div><strong>Next-period focus</strong><p>{selectedPublication.narrative.nextPeriodFocus}</p></div>
              </div>
            ) : null}
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
            <div><p className="eyebrow">Leadership input</p><h2>Decisions required</h2>{report.changeDecisions.length === 0 ? <p>No submitted change decision is due.</p> : <ol className="report-compact-list">{report.changeDecisions.map((change) => <li key={change.id}><strong>{change.id} · {change.title}</strong><span>{change.decisionOwner ?? "Authority not supplied"} · required {formatDate(change.requiredBy)} · {formatCurrency(change.costImpact)}</span></li>)}</ol>}</div>
          </section>

          <section className="report-section" aria-labelledby="report-actions-title">
            <div className="report-section__heading"><div><p className="eyebrow">Next period</p><h2 id="report-actions-title">Owned corrective actions</h2></div><span>{report.actions.length} signed actions</span></div>
            {report.actions.length === 0 ? <p>No publishable action is available until current variance analyses are signed.</p> : <div className="table-scroll"><table><caption>Corrective actions for the next period</caption><thead><tr><th scope="col">Scope</th><th scope="col">Action</th><th scope="col">Owner</th><th scope="col">Due</th><th scope="col">Status / evidence</th></tr></thead><tbody>{report.actions.map((action) => <tr key={action.scopeId}><th scope="row">{action.scopeId}</th><td>{action.action}</td><td>{action.owner}</td><td>{formatDate(action.dueDate)}</td><td><span className="table-primary">{action.status}</span><span className="table-secondary">{action.evidence}</span></td></tr>)}</tbody></table></div>}
          </section>

          <section className="report-section" aria-labelledby="report-baseline-title">
            <div className="report-section__heading"><div><p className="eyebrow">Change integrity</p><h2 id="report-baseline-title">Baseline and change reconciliation</h2></div><FileCheck2 size={22} aria-hidden="true" /></div>
            <div className="report-baseline-grid">
              <div><span>Original baseline</span><strong>{report.baseline.originalVersion ?? "Unavailable"}</strong><small>{report.baseline.originalBac === null ? "No retained BAC" : `${formatCurrency(report.baseline.originalBac)} BAC`}</small></div>
              <div><span>Active baseline</span><strong>{report.baseline.activeVersion}</strong><small>{formatCurrency(report.baseline.activeBac)} BAC</small></div>
              <div><span>Incorporated in active baseline</span><strong>{formatCurrency(report.baseline.incorporatedInActiveBaseline)}</strong></div>
              <div><span>Expected current BAC</span><strong>{report.baseline.expectedActiveBac === null ? "Unavailable" : formatCurrency(report.baseline.expectedActiveBac)}</strong><small>{report.baseline.reconciliationVariance === null ? "Not calculated" : `${formatCurrency(report.baseline.reconciliationVariance)} difference`}</small></div>
              <div><span>Approved, not incorporated</span><strong>{formatCurrency(report.baseline.approvedNotIncorporated)}</strong></div>
              <div><span>Expected / active finish</span><strong>{report.baseline.expectedBaselineFinish === null ? "Unavailable" : formatDate(report.baseline.expectedBaselineFinish)}</strong><small>{formatDate(report.baseline.activeBaselineFinish)} active · {report.baseline.scheduleVarianceDays ?? "?"} days difference</small></div>
              <div><span>Historical PV / EV / AC</span><strong>{report.baseline.historicalPerformancePreserved ? "Preserved" : "Rewritten — blocked"}</strong><small>{report.baseline.effectiveChangeIds.length} effective changes</small></div>
              <div><span>Other referenced baselines</span><strong>{report.baseline.otherBaselineVersions.length === 0 ? "None" : report.baseline.otherBaselineVersions.join(", ")}</strong></div>
            </div>
            {report.baseline.changeComparisons.length > 0 ? <div className="table-scroll"><table><caption>Pre-change variance retained after implementation</caption><thead><tr><th scope="col">Change</th><th scope="col">Effective</th><th scope="col">Versions</th><th scope="col">Pre-change SV / CV</th><th scope="col">Post-change SV / CV</th></tr></thead><tbody>{report.baseline.changeComparisons.map((comparison) => <tr key={comparison.changeId}><th scope="row">{comparison.changeId}</th><td>{formatDate(comparison.effectiveDate)}</td><td>{comparison.fromVersion} → {comparison.toVersion}</td><td>{formatCurrency(comparison.preChange.metrics.sv)} / {formatCurrency(comparison.preChange.metrics.cv)}</td><td>{formatCurrency(comparison.postChange.metrics.sv)} / {formatCurrency(comparison.postChange.metrics.cv)}</td></tr>)}</tbody></table></div> : null}
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
