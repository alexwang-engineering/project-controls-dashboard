import { FileCheck2, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useProjectStore } from "../../app/store";
import { useProjectPerformance } from "../../app/useProjectPerformance";
import { PageGuide } from "../../components/PageGuide";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import {
  allowedChangeStatuses,
  applyChangeTransition,
  canDeleteChange,
} from "../../domain/changes";
import {
  buildBaselineReconciliation,
  type BaselineGenerationSnapshot,
} from "../../domain/baselineReconciliation";
import {
  changeInputSchema,
  registerErrorSummary,
} from "../../domain/registers";
import type {
  ChangeRequest,
  ChangeStatus,
  MetricStatus,
} from "../../domain/types";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
} from "../../utils/format";
import { RegisterEditor } from "../registers/RegisterEditor";

const changeTone: Record<ChangeStatus, MetricStatus> = {
  draft: "neutral",
  submitted: "attention",
  approved: "attention",
  rejected: "neutral",
  implemented: "positive",
  withdrawn: "neutral",
};

const titleCase = (value: string) =>
  value
    .replaceAll("-", " ")
    .replace(/^./, (first) => first.toUpperCase());

const decisionStatuses: readonly ChangeStatus[] = [
  "approved",
  "rejected",
  "implemented",
  "withdrawn",
];

export function ChangesPage() {
  const { changes, upsertChange, removeChange } = useProjectStore();
  const { snapshot: performance } = useProjectPerformance();
  const [editing, setEditing] = useState<ChangeRequest>();
  const [isAdding, setIsAdding] = useState(false);
  const [formStatus, setFormStatus] = useState<ChangeStatus>("draft");
  const [formError, setFormError] = useState("");

  const pending = changes.filter(({ status }) => status === "submitted");
  const approvedNotIncorporated = changes.filter(
    ({ status, incorporatedBaselineVersion }) =>
      status === "approved" && !incorporatedBaselineVersion,
  );
  const proposedCost = pending.reduce(
    (sum, change) => sum + change.costImpact,
    0,
  );
  const approvedCost = approvedNotIncorporated.reduce(
    (sum, change) => sum + change.costImpact,
    0,
  );
  const editorOpen = isAdding || editing !== undefined;
  const allowedStatuses = allowedChangeStatuses(editing?.status);
  const requiresSubmissionEvidence = formStatus !== "draft";
  const requiresDecisionEvidence =
    decisionStatuses.includes(formStatus) ||
    (editing?.status === "submitted" && formStatus === "draft");
  const requiresImplementationEvidence = formStatus === "implemented";
  const requestLocked = editing !== undefined && editing.status !== "draft";
  const baselineReconciliation = useMemo(() => {
    if (performance?.source !== "active-import") return undefined;
    const activeSnapshot: BaselineGenerationSnapshot = {
      importId: performance.importId,
      projectId: performance.project.id,
      baselineVersion: performance.project.baselineVersion,
      importedAt: performance.importedAt,
      dataDate: performance.project.reportingDate,
      bac: performance.project.originalBac,
      baselineFinish: performance.project.baselineFinish,
      periods: performance.periods.map(({ period, pv, ev, ac }) => ({
        period,
        pv,
        ev,
        ac,
      })),
    };
    return buildBaselineReconciliation({
      projectId: performance.project.id,
      activeImportId: performance.importId,
      reportingDate: performance.project.reportingDate,
      snapshots: performance.baselineSnapshots?.length
        ? performance.baselineSnapshots
        : [activeSnapshot],
      changes,
    });
  }, [changes, performance]);

  const closeEditor = () => {
    setEditing(undefined);
    setIsAdding(false);
    setFormStatus("draft");
    setFormError("");
  };

  const openNew = () => {
    setIsAdding(true);
    setEditing(undefined);
    setFormStatus("draft");
    setFormError("");
  };

  const openEdit = (change: ChangeRequest) => {
    setEditing(change);
    setIsAdding(false);
    setFormStatus(change.status);
    setFormError("");
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = changeInputSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      setFormError(registerErrorSummary(parsed.error));
      return;
    }
    if (changes.some(({ id }) => id === parsed.data.id && id !== editing?.id)) {
      setFormError(
        "That change ID already exists. Edit the existing record or use a new ID.",
      );
      return;
    }

    try {
      upsertChange(applyChangeTransition(editing, parsed.data));
      closeEditor();
    } catch (transitionError) {
      setFormError(
        transitionError instanceof Error
          ? transitionError.message
          : "The controlled status transition could not be recorded.",
      );
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Baseline governance"
        title="Change control"
        description="Assess, authorise and implement change without rewriting the original baseline or historical performance."
        actions={
          <button className="button button--primary" type="button" onClick={openNew}>
            <Plus size={17} aria-hidden="true" /> Add change request
          </button>
        }
      />

      <PageGuide
        pageName="Change control"
        purpose="Build the complete impact case in draft, submit it to a named authority, then retain every decision and baseline action."
        steps={[
          { title: "Build the case", detail: "Record reason, scope, impacts, assumptions, alternatives and a recommendation." },
          { title: "Control the decision", detail: "Use only the allowed next status and retain authority, actor, date, rationale and evidence." },
          { title: "Protect the baseline", detail: "Implement only after approval, with an effective date and explicit rebaseline evidence." },
        ]}
      />

      {editorOpen ? (
        <RegisterEditor
          title={editing ? `Edit change ${editing.id}` : "Add change request"}
          description="Drafts may be incomplete. Every field in the submission section becomes mandatory before the request can leave draft."
          submitLabel="Save change request"
          error={formError}
          onCancel={closeEditor}
          onSubmit={save}
        >
          <fieldset className="register-form-section">
            <legend>Request and impact assessment</legend>
            <p>Describe the complete business and technical case before submission.</p>
            <div className="register-form-grid">
              <label>
                Change ID
                <input
                  name="id"
                  required
                  readOnly={editing !== undefined}
                  defaultValue={editing?.id ?? ""}
                  placeholder="CR-001"
                />
              </label>
              <label>
                Change title
                <input name="title" required readOnly={requestLocked} defaultValue={editing?.title ?? ""} />
              </label>
              <label>
                Requester
                <input name="requester" readOnly={requestLocked} defaultValue={editing?.requester ?? ""} />
              </label>
              <label>
                Work package ID
                <input name="wbsId" required readOnly={requestLocked} defaultValue={editing?.wbsId ?? ""} placeholder="WP100" />
              </label>
              <label className="register-form-field--wide">
                Reason for change
                <textarea name="reason" rows={2} readOnly={requestLocked} defaultValue={editing?.reason ?? ""} />
              </label>
              <label className="register-form-field--wide">
                Scope description
                <textarea name="scopeDescription" rows={2} readOnly={requestLocked} defaultValue={editing?.scopeDescription ?? ""} />
              </label>
              <label>
                Cost impact (£)
                <input name="costImpact" type="number" step="0.01" required readOnly={requestLocked} defaultValue={editing?.costImpact ?? ""} />
              </label>
              <label>
                Schedule impact (days)
                <input name="scheduleImpactDays" type="number" required readOnly={requestLocked} defaultValue={editing?.scheduleImpactDays ?? ""} />
              </label>
              <label className="register-form-field--wide">
                Technical and quality impact
                <textarea name="technicalQualityImpact" rows={2} readOnly={requestLocked} defaultValue={editing?.technicalQualityImpact ?? ""} />
              </label>
              <label className="register-form-field--wide">
                Risk impact
                <textarea name="riskImpact" rows={2} readOnly={requestLocked} defaultValue={editing?.riskImpact ?? ""} />
              </label>
              <label className="register-form-field--wide">
                Benefit
                <textarea name="benefit" rows={2} readOnly={requestLocked} defaultValue={editing?.benefit ?? ""} />
              </label>
              <label className="register-form-field--wide">
                Assumptions
                <textarea name="assumptions" rows={2} readOnly={requestLocked} defaultValue={editing?.assumptions ?? ""} />
              </label>
              <label className="register-form-field--wide">
                Alternatives considered
                <textarea name="alternatives" rows={2} readOnly={requestLocked} defaultValue={editing?.alternatives ?? ""} />
              </label>
              <label className="register-form-field--wide">
                Recommendation
                <textarea name="recommendation" rows={2} readOnly={requestLocked} defaultValue={editing?.recommendation ?? ""} />
              </label>
              <label>
                Decision due
                <input name="decisionDue" type="date" required readOnly={requestLocked} defaultValue={editing?.decisionDue ?? ""} />
              </label>
              <label>
                Change status
                <select
                  name="status"
                  value={formStatus}
                  onChange={(event) => setFormStatus(event.target.value as ChangeStatus)}
                >
                  {allowedStatuses.map((status) => (
                    <option key={status} value={status}>{titleCase(status)}</option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          {requiresSubmissionEvidence ? (
            <fieldset className="register-form-section">
              <legend>Submission and decision ownership</legend>
              <p>A submitted request must identify when it entered governance, who owns the decision and where the reviewed evidence is retained.</p>
              <div className="register-form-grid">
                <label>
                  Submitted date
                  <input name="submittedDate" type="date" readOnly={requestLocked} defaultValue={editing?.submittedDate ?? ""} />
                </label>
                <label>
                  Decision authority
                  <input name="decisionAuthority" readOnly={requestLocked} defaultValue={editing?.decisionAuthority ?? ""} placeholder="Project Change Board" />
                </label>
                <label className="register-form-field--wide">
                  Evidence reference
                  <input name="evidenceReference" defaultValue={editing?.evidenceReference ?? ""} placeholder="CCB-PACK-001 or controlled document link" />
                </label>
              </div>
            </fieldset>
          ) : null}

          {requiresDecisionEvidence ? (
            <fieldset className="register-form-section">
              <legend>Decision record</legend>
              <p>Approval, rejection, withdrawal or return for information must retain the named actor, decision date and rationale.</p>
              <div className="register-form-grid">
                <label>
                  Decision actor / approver
                  <input name="approver" defaultValue={editing?.approver ?? ""} />
                </label>
                <label>
                  Decision date
                  <input name="decisionDate" type="date" defaultValue={editing?.decisionDate ?? ""} />
                </label>
                <label className="register-form-field--wide">
                  Decision rationale
                  <textarea name="decisionRationale" rows={3} defaultValue={editing?.decisionRationale ?? ""} />
                </label>
              </div>
            </fieldset>
          ) : null}

          {requiresImplementationEvidence ? (
            <fieldset className="register-form-section">
              <legend>Implementation and rebaseline evidence</legend>
              <p>Implementation records the effective period while keeping original performance and baseline values visible.</p>
              <div className="register-form-grid">
                <label>
                  Effective date
                  <input name="effectiveDate" type="date" defaultValue={editing?.effectiveDate ?? ""} />
                </label>
                <label>
                  Incorporated baseline version
                  <input name="incorporatedBaselineVersion" defaultValue={editing?.incorporatedBaselineVersion ?? ""} placeholder="B1" />
                </label>
                <label className="register-form-field--wide">
                  Rebaseline justification
                  <textarea name="rebaselineJustification" rows={3} defaultValue={editing?.rebaselineJustification ?? ""} />
                </label>
                <label className="register-form-field--wide">
                  Prevention and corrective measures
                  <textarea name="preventionCorrectiveMeasures" rows={3} defaultValue={editing?.preventionCorrectiveMeasures ?? ""} />
                </label>
              </div>
            </fieldset>
          ) : null}

          {!requiresSubmissionEvidence ? <input type="hidden" name="submittedDate" value="" /> : null}
          {!requiresSubmissionEvidence ? <input type="hidden" name="decisionAuthority" value="" /> : null}
          {!requiresSubmissionEvidence ? <input type="hidden" name="evidenceReference" value="" /> : null}
          {!requiresDecisionEvidence ? <input type="hidden" name="approver" value="" /> : null}
          {!requiresDecisionEvidence ? <input type="hidden" name="decisionDate" value="" /> : null}
          {!requiresDecisionEvidence ? <input type="hidden" name="decisionRationale" value="" /> : null}
          {!requiresImplementationEvidence ? <input type="hidden" name="effectiveDate" value="" /> : null}
          {!requiresImplementationEvidence ? <input type="hidden" name="incorporatedBaselineVersion" value="" /> : null}
          {!requiresImplementationEvidence ? <input type="hidden" name="rebaselineJustification" value="" /> : null}
          {!requiresImplementationEvidence ? <input type="hidden" name="preventionCorrectiveMeasures" value="" /> : null}
        </RegisterEditor>
      ) : null}

      <section className="summary-strip" aria-label="Change summary">
        <div><span>Total requests</span><strong>{changes.length}</strong></div>
        <div><span>Pending decisions</span><strong>{pending.length}</strong></div>
        <div><span>Pending cost</span><strong>{formatCompactCurrency(proposedCost)}</strong></div>
        <div><span>Approved, not baselined</span><strong>{formatCompactCurrency(approvedCost)}</strong></div>
      </section>

      {approvedNotIncorporated.length > 0 ? (
        <aside className="control-note" aria-labelledby="baseline-warning-title">
          <strong id="baseline-warning-title">Baseline integrity warning</strong>
          <p>{approvedNotIncorporated.length} approved change{approvedNotIncorporated.length === 1 ? "" : "s"} worth {formatCurrency(approvedCost)} have not been incorporated into a controlled baseline version.</p>
        </aside>
      ) : null}

      <section className="panel" aria-labelledby="baseline-reconciliation-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Immutable baseline evidence</p>
            <h2 id="baseline-reconciliation-title">
              Original-to-current baseline reconciliation
            </h2>
            <p className="panel__description">
              Original BAC and historical performance remain fixed; only implemented,
              version-linked changes may explain the active baseline.
            </p>
          </div>
          <FileCheck2 size={22} aria-hidden="true" />
        </div>
        {baselineReconciliation === undefined ? (
          <div className="register-empty">
            <strong>No controlled baseline is active.</strong>
            <span>
              Import a validated schedule and performance pair to retain the original
              baseline and calculate the before/after reconciliation.
            </span>
          </div>
        ) : (
          <>
            <div className="baseline-reconciliation-grid">
              <div>
                <span>Original baseline</span>
                <strong>{baselineReconciliation.original?.version ?? "Unavailable"}</strong>
                <small>{baselineReconciliation.original ? formatCurrency(baselineReconciliation.original.bac) : "No retained BAC"}</small>
              </div>
              <div>
                <span>Implemented change</span>
                <strong>{formatCurrency(baselineReconciliation.incorporated.costImpact)}</strong>
                <small>{baselineReconciliation.incorporated.scheduleImpactDays >= 0 ? "+" : ""}{baselineReconciliation.incorporated.scheduleImpactDays} calendar days</small>
              </div>
              <div>
                <span>Expected current BAC</span>
                <strong>{baselineReconciliation.cost ? formatCurrency(baselineReconciliation.cost.expected) : "Unavailable"}</strong>
                <small>Original plus incorporated changes</small>
              </div>
              <div>
                <span>Active imported BAC</span>
                <strong>{baselineReconciliation.active ? formatCurrency(baselineReconciliation.active.bac) : "Unavailable"}</strong>
                <small>{baselineReconciliation.active?.version ?? "No active version"}</small>
              </div>
              <div>
                <span>BAC difference</span>
                <strong>{baselineReconciliation.cost ? formatCurrency(baselineReconciliation.cost.variance) : "Unavailable"}</strong>
                <small>{baselineReconciliation.cost?.reconciles ? "Reconciled" : "Blocking mismatch"}</small>
              </div>
              <div>
                <span>Baseline finish</span>
                <strong>{baselineReconciliation.schedule ? formatDate(baselineReconciliation.schedule.actualFinish) : "Unavailable"}</strong>
                <small>{baselineReconciliation.schedule ? `Expected ${formatDate(baselineReconciliation.schedule.expectedFinish)}` : "No retained schedule evidence"}</small>
              </div>
            </div>
            {baselineReconciliation.controls.length > 0 ? (
              <aside className="control-note" aria-label="Baseline reconciliation blockers">
                <strong>Baseline reconciliation is blocked</strong>
                <ul>
                  {baselineReconciliation.controls.map((control) => (
                    <li key={`${control.code}-${control.changeId ?? "project"}`}>
                      {control.message}
                    </li>
                  ))}
                </ul>
              </aside>
            ) : (
              <p className="baseline-reconciliation-pass">
                Reconciled: active BAC and finish match the immutable original plus
                incorporated change, and pre-effective PV, EV and AC are unchanged.
              </p>
            )}
            {baselineReconciliation.changeComparisons.length > 0 ? (
              <div className="table-scroll">
                <table>
                  <caption>Pre-change variance and post-change performance</caption>
                  <thead>
                    <tr>
                      <th scope="col">Change / effective date</th>
                      <th scope="col">Versions</th>
                      <th scope="col">Pre-change SV / CV</th>
                      <th scope="col">Post-change SV / CV</th>
                      <th scope="col">Historical values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baselineReconciliation.changeComparisons.map((comparison) => (
                      <tr key={comparison.changeId}>
                        <th scope="row">
                          <span className="table-primary">{comparison.changeId}</span>
                          <span className="table-secondary">{formatDate(comparison.effectiveDate)}</span>
                        </th>
                        <td>{comparison.fromVersion} → {comparison.toVersion}</td>
                        <td>{formatCurrency(comparison.preChange.metrics.sv)} / {formatCurrency(comparison.preChange.metrics.cv)}</td>
                        <td>{formatCurrency(comparison.postChange.metrics.sv)} / {formatCurrency(comparison.postChange.metrics.cv)}</td>
                        <td>{comparison.historicalPerformancePreserved ? "Preserved" : "Rewritten — blocked"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="change-register-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Decision register</p>
            <h2 id="change-register-title">Change requests</h2>
            <p className="panel__description">Status options are constrained by the workflow; completed transitions retain immutable decision evidence.</p>
          </div>
        </div>
        {changes.length === 0 ? (
          <div className="register-empty">
            <strong>No change requests have been entered.</strong>
            <span>Use Add change request to record the first controlled proposal.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Project change-request register</caption>
              <thead>
                <tr>
                  <th scope="col">Change</th>
                  <th scope="col">Status</th>
                  <th scope="col">Cost impact</th>
                  <th scope="col">Schedule impact</th>
                  <th scope="col">Decision owner / due</th>
                  <th scope="col">Baseline treatment</th>
                  <th scope="col">History</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.id}>
                    <th scope="row">
                      <span className="table-primary">{change.title}</span>
                      <span className="table-secondary">{change.id} · {change.wbsId}</span>
                    </th>
                    <td><StatusPill status={changeTone[change.status]}>{titleCase(change.status)}</StatusPill></td>
                    <td>{formatCurrency(change.costImpact)}</td>
                    <td>{change.scheduleImpactDays === 0 ? "No impact" : `${change.scheduleImpactDays > 0 ? "+" : ""}${String(change.scheduleImpactDays)} days`}</td>
                    <td>
                      <span className="table-primary">{change.decisionAuthority ?? "Not assigned"}</span>
                      <span className="table-secondary">Due {formatDate(change.decisionDue)}</span>
                    </td>
                    <td>{change.incorporatedBaselineVersion ? `Incorporated in ${change.incorporatedBaselineVersion}` : "Not incorporated"}</td>
                    <td>
                      {change.decisionHistory?.length ? (
                        <details className="change-history">
                          <summary><History size={14} aria-hidden="true" /> {change.decisionHistory.length} event{change.decisionHistory.length === 1 ? "" : "s"}</summary>
                          <ol>
                            {change.decisionHistory.map((entry) => (
                              <li key={entry.sequence}>
                                <strong>{titleCase(entry.fromStatus)} → {titleCase(entry.toStatus)}</strong>
                                <span>{entry.authority} · {entry.actor} · {formatDate(entry.date)}</span>
                                <p>{entry.rationale}</p>
                                <code>{entry.evidenceReference}</code>
                              </li>
                            ))}
                          </ol>
                        </details>
                      ) : "No transitions"}
                    </td>
                    <td>
                      <div className="register-row-actions">
                        {allowedChangeStatuses(change.status).length > 1 ? <button type="button" aria-label={`Edit ${change.id}`} onClick={() => openEdit(change)}><Pencil size={15} aria-hidden="true" /></button> : null}
                        {canDeleteChange(change) ? <button type="button" aria-label={`Delete ${change.id}`} onClick={() => { if (window.confirm(`Delete change ${change.id}?`)) removeChange(change.id); }}><Trash2 size={15} aria-hidden="true" /></button> : <span className="table-secondary">Controlled record</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
