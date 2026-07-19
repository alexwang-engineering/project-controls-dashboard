import { CheckCircle2, History, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  emptyVarianceAnalysisDetails,
  validateVarianceAnalysisForSignOff,
  type VarianceAnalysisContext,
  type VarianceAnalysisDetails,
  type VarianceAnalysisRecord,
} from "../../domain/varianceAnalysis";
import { getBrowserRepositories } from "../../repositories/browserRepositories";
import {
  VarianceAnalysisRepository,
  type SaveVarianceDraftInput,
  type SignOffVarianceAnalysisInput,
  type VarianceAnalysisContextState,
} from "../../repositories/varianceAnalysisRepository";
import { formatCurrency, formatDate, formatIndex } from "../../utils/format";

export interface VarianceAnalysisPanelDependencies {
  load: (
    contextKey: string,
    sourceImportId: string,
  ) => Promise<VarianceAnalysisContextState>;
  saveDraft: (
    input: SaveVarianceDraftInput,
  ) => Promise<VarianceAnalysisRecord>;
  signOff: (
    input: SignOffVarianceAnalysisInput,
  ) => Promise<VarianceAnalysisRecord>;
  now: () => string;
}

const defaultDependencies: VarianceAnalysisPanelDependencies = {
  load: (contextKey, sourceImportId) =>
    new VarianceAnalysisRepository(getBrowserRepositories().db).loadContext(
      contextKey,
      sourceImportId,
    ),
  saveDraft: (input) =>
    new VarianceAnalysisRepository(getBrowserRepositories().db).saveDraft(input),
  signOff: (input) =>
    new VarianceAnalysisRepository(getBrowserRepositories().db).signOff(input),
  now: () => new Date().toISOString(),
};

const timestamp = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const countErrors = (
  errors: Partial<Record<keyof VarianceAnalysisDetails, string>>,
) => Object.keys(errors).length;

export function VarianceAnalysisPanel({
  context,
  dependencies = defaultDependencies,
}: {
  context: VarianceAnalysisContext;
  dependencies?: VarianceAnalysisPanelDependencies;
}) {
  const [details, setDetails] = useState<VarianceAnalysisDetails>(
    emptyVarianceAnalysisDetails,
  );
  const [savedDraft, setSavedDraft] = useState<VarianceAnalysisRecord>();
  const [history, setHistory] = useState<readonly VarianceAnalysisRecord[]>([]);
  const [retainedDraftCount, setRetainedDraftCount] = useState(0);
  const [busy, setBusy] = useState<"idle" | "loading" | "saving" | "signing">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setBusy("loading");
    setMessage("");
    setError("");
    dependencies
      .load(context.contextKey, context.sourceImportId)
      .then((loaded) => {
        if (!active) return;
        setSavedDraft(loaded.currentDraft);
        setDetails(
          loaded.currentDraft?.details ?? { ...emptyVarianceAnalysisDetails },
        );
        setHistory(loaded.signedRevisions);
        setRetainedDraftCount(loaded.retainedDraftCount);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Variance analysis could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setBusy("idle");
      });
    return () => {
      active = false;
    };
  }, [
    context.contextKey,
    context.factFingerprint,
    context.sourceImportId,
    dependencies,
  ]);

  const validation = useMemo(
    () =>
      validateVarianceAnalysisForSignOff(details, context.reportingPeriod),
    [context.reportingPeriod, details],
  );
  const fieldErrors = validation.success ? {} : validation.fieldErrors;
  const savedDetails = savedDraft?.details;
  const isDirty =
    savedDraft === undefined ||
    savedDraft.factFingerprint !== context.factFingerprint ||
    JSON.stringify(savedDetails) !== JSON.stringify(details);
  const canSign =
    context.breachedMetrics.length > 0 &&
    validation.success &&
    !isDirty &&
    busy === "idle";

  const update = <Field extends keyof VarianceAnalysisDetails>(
    field: Field,
    value: VarianceAnalysisDetails[Field],
  ) => {
    setDetails((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  };

  const saveDraft = async () => {
    setBusy("saving");
    setMessage("");
    setError("");
    try {
      const saved = await dependencies.saveDraft({
        context,
        details,
        savedAt: dependencies.now(),
      });
      setSavedDraft(saved);
      setDetails(saved.details);
      setMessage("Draft saved against the current source generation and forecast selection.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Variance draft could not be saved.",
      );
    } finally {
      setBusy("idle");
    }
  };

  const signOff = async () => {
    if (!canSign) return;
    setBusy("signing");
    setMessage("");
    setError("");
    try {
      const signed = await dependencies.signOff({
        context,
        details,
        signedAt: dependencies.now(),
      });
      setHistory((current) => [signed, ...current]);
      setSavedDraft(undefined);
      setDetails({ ...emptyVarianceAnalysisDetails });
      setMessage(`Revision ${String(signed.revision)} was signed and locked.`);
    } catch (signError) {
      setError(
        signError instanceof Error
          ? signError.message
          : "Variance analysis could not be signed off.",
      );
    } finally {
      setBusy("idle");
    }
  };

  const errorFor = (field: keyof VarianceAnalysisDetails) =>
    fieldErrors[field] === undefined ? undefined : `${field}-error`;

  return (
    <section
      className="panel variance-analysis"
      aria-labelledby="variance-analysis-title"
    >
      <div className="panel__header">
        <div>
          <p className="eyebrow">Management control record</p>
          <h2 id="variance-analysis-title">
            Variance analysis and recovery control
          </h2>
          <p className="panel__description">
            Imported facts remain read-only. Draft commentary is stored separately;
            every signed revision is locked and retained.
          </p>
        </div>
        <span className="reporting-period">
          <ShieldCheck size={15} aria-hidden="true" />
          {context.scopeType === "project" ? "Project" : context.scopeId} · {formatDate(context.reportingPeriod)}
        </span>
      </div>

      {context.breachedMetrics.length === 0 ? (
        <div className="variance-analysis__clear">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div>
            <strong>No structured variance analysis is required.</strong>
            <span>SPI, CPI and selected-scenario VAC are within the default thresholds.</span>
          </div>
        </div>
      ) : (
        <>
          <div className="variance-facts" aria-label="Read-only variance facts">
            <div>
              <span>Threshold breaches</span>
              <strong>{context.breachedMetrics.join(" · ")}</strong>
            </div>
            <div>
              <span>SPI / CPI</span>
              <strong>{formatIndex(context.facts.spi)} / {formatIndex(context.facts.cpi)}</strong>
            </div>
            <div>
              <span>SV / CV</span>
              <strong>{formatCurrency(context.facts.svPence / 100)} / {formatCurrency(context.facts.cvPence / 100)}</strong>
            </div>
            <div>
              <span>Selected EAC / VAC</span>
              <strong>{formatCurrency(context.facts.managementEacPence / 100)} / {formatCurrency(context.facts.vacPence / 100)}</strong>
            </div>
          </div>

          {error ? (
            <div className="import-error" role="alert">
              <strong>Analysis operation could not continue.</strong>
              <span>{error}</span>
            </div>
          ) : null}
          {message ? (
            <div className="settings-success" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{message}</span>
            </div>
          ) : null}

          <fieldset className="variance-form" disabled={busy !== "idle"}>
            <legend>Cause, effect and corrective action</legend>
            <label className="variance-field variance-field--wide">
              <span>Root cause</span>
              <textarea
                aria-label="Root cause"
                value={details.rootCause}
                aria-describedby={errorFor("rootCause")}
                onChange={(event) => update("rootCause", event.target.value)}
              />
              {fieldErrors.rootCause ? <small id="rootCause-error">{fieldErrors.rootCause}</small> : null}
            </label>
            <label className="variance-field">
              <span>Dependency impact</span>
              <textarea
                aria-label="Dependency impact"
                value={details.dependencyImpact}
                aria-describedby={errorFor("dependencyImpact")}
                onChange={(event) => update("dependencyImpact", event.target.value)}
              />
              {fieldErrors.dependencyImpact ? <small id="dependencyImpact-error">{fieldErrors.dependencyImpact}</small> : null}
            </label>
            <label className="variance-field">
              <span>Milestone impact</span>
              <textarea
                aria-label="Milestone impact"
                value={details.milestoneImpact}
                aria-describedby={errorFor("milestoneImpact")}
                onChange={(event) => update("milestoneImpact", event.target.value)}
              />
              {fieldErrors.milestoneImpact ? <small id="milestoneImpact-error">{fieldErrors.milestoneImpact}</small> : null}
            </label>
            <label className="variance-field">
              <span>Critical or near-critical path impact</span>
              <textarea
                aria-label="Critical or near-critical path impact"
                value={details.criticalPathImpact}
                aria-describedby={`criticalPathImpact-help${fieldErrors.criticalPathImpact ? " criticalPathImpact-error" : ""}`}
                onChange={(event) => update("criticalPathImpact", event.target.value)}
              />
              <small id="criticalPathImpact-help">
                State “not supplied” when the source schedule does not identify this evidence.
              </small>
              {fieldErrors.criticalPathImpact ? <small id="criticalPathImpact-error">{fieldErrors.criticalPathImpact}</small> : null}
            </label>
            <label className="variance-field">
              <span>Cost and EAC effect</span>
              <textarea
                aria-label="Cost and EAC effect"
                value={details.costEacEffect}
                aria-describedby={errorFor("costEacEffect")}
                onChange={(event) => update("costEacEffect", event.target.value)}
              />
              {fieldErrors.costEacEffect ? <small id="costEacEffect-error">{fieldErrors.costEacEffect}</small> : null}
            </label>
            <label className="variance-field variance-field--wide">
              <span>Corrective action</span>
              <textarea
                aria-label="Corrective action"
                value={details.correctiveAction}
                aria-describedby={errorFor("correctiveAction")}
                onChange={(event) => update("correctiveAction", event.target.value)}
              />
              {fieldErrors.correctiveAction ? <small id="correctiveAction-error">{fieldErrors.correctiveAction}</small> : null}
            </label>
            <label className="variance-field">
              <span>Accountable owner</span>
              <input
                aria-label="Accountable owner"
                value={details.owner}
                aria-describedby={errorFor("owner")}
                onChange={(event) => update("owner", event.target.value)}
              />
              {fieldErrors.owner ? <small id="owner-error">{fieldErrors.owner}</small> : null}
            </label>
            <label className="variance-field">
              <span>Action due date</span>
              <input
                aria-label="Action due date"
                type="date"
                min={context.reportingPeriod}
                value={details.dueDate}
                aria-describedby={errorFor("dueDate")}
                onChange={(event) => update("dueDate", event.target.value)}
              />
              {fieldErrors.dueDate ? <small id="dueDate-error">{fieldErrors.dueDate}</small> : null}
            </label>
            <label className="variance-field variance-field--wide">
              <span>Recovery evidence</span>
              <textarea
                aria-label="Recovery evidence"
                value={details.recoveryEvidence}
                aria-describedby={errorFor("recoveryEvidence")}
                onChange={(event) => update("recoveryEvidence", event.target.value)}
              />
              {fieldErrors.recoveryEvidence ? <small id="recoveryEvidence-error">{fieldErrors.recoveryEvidence}</small> : null}
            </label>
            <label className="variance-field">
              <span>Expected recovery period</span>
              <input
                aria-label="Expected recovery period"
                type="date"
                min={context.reportingPeriod}
                value={details.expectedRecoveryPeriod}
                aria-describedby={errorFor("expectedRecoveryPeriod")}
                onChange={(event) => update("expectedRecoveryPeriod", event.target.value)}
              />
              {fieldErrors.expectedRecoveryPeriod ? <small id="expectedRecoveryPeriod-error">{fieldErrors.expectedRecoveryPeriod}</small> : null}
            </label>
            <label className="variance-field">
              <span>Workflow status</span>
              <select
                aria-label="Workflow status"
                value={details.status}
                onChange={(event) =>
                  update(
                    "status",
                    event.target.value as VarianceAnalysisDetails["status"],
                  )
                }
              >
                <option value="open">Open</option>
                <option value="monitoring">Monitoring recovery</option>
                <option value="closed">Closed with evidence</option>
              </select>
            </label>
            <label className="variance-field">
              <span>Prepared by</span>
              <input
                aria-label="Prepared by"
                value={details.author}
                aria-describedby={errorFor("author")}
                onChange={(event) => update("author", event.target.value)}
              />
              {fieldErrors.author ? <small id="author-error">{fieldErrors.author}</small> : null}
            </label>
          </fieldset>

          <div className="variance-actions">
            <div aria-live="polite">
              <strong>
                {validation.success
                  ? isDirty
                    ? "Complete analysis; save the current facts before sign-off."
                    : "Complete saved draft is ready for immutable sign-off."
                  : `${String(countErrors(fieldErrors))} required field${countErrors(fieldErrors) === 1 ? "" : "s"} still need attention.`}
              </strong>
              <span>
                Signing freezes this revision. Later updates create another revision rather than changing history.
              </span>
            </div>
            <button
              className="button button--secondary"
              type="button"
              disabled={busy !== "idle"}
              onClick={saveDraft}
            >
              <Save size={17} aria-hidden="true" /> Save current draft
            </button>
            <button
              className="button button--primary"
              type="button"
              disabled={!canSign}
              onClick={signOff}
            >
              <ShieldCheck size={17} aria-hidden="true" /> Sign off immutable revision
            </button>
          </div>
        </>
      )}

      {retainedDraftCount > 0 ? (
        <p className="variance-retained-note">
          {retainedDraftCount} earlier-generation draft{retainedDraftCount === 1 ? " is" : "s are"} retained.
        </p>
      ) : null}

      {history.length > 0 ? (
        <div className="variance-history">
          <div className="variance-history__heading">
            <History size={18} aria-hidden="true" />
            <div>
              <h3>Signed revision history</h3>
              <p>Read-only evidence remains available after later imports or corrective actions.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Signed variance-analysis history</caption>
              <thead>
                <tr>
                  <th scope="col">Revision</th>
                  <th scope="col">Source</th>
                  <th scope="col">Scenario</th>
                  <th scope="col">Status</th>
                  <th scope="col">Owner / author</th>
                  <th scope="col">Signed</th>
                  <th scope="col">Cause and action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.recordId}>
                    <th scope="row">Revision {record.revision}</th>
                    <td>
                      {record.sourceImportId === context.sourceImportId
                        ? "Current generation"
                        : "Earlier generation"}
                    </td>
                    <td>{record.managementScenario}</td>
                    <td>{record.details.status}</td>
                    <td>
                      <span className="table-primary">{record.details.owner}</span>
                      <span className="table-secondary">{record.details.author}</span>
                    </td>
                    <td>{record.signedAt ? timestamp(record.signedAt) : "Not signed"}</td>
                    <td>
                      <span className="table-primary">{record.details.rootCause}</span>
                      <span className="table-secondary">{record.details.correctiveAction}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
