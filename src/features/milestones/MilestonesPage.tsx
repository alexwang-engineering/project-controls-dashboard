import { differenceInCalendarDays, parseISO } from "date-fns";
import { Network, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useProjectStore } from "../../app/store";
import { useProjectPerformance } from "../../app/useProjectPerformance";
import { PageHeader } from "../../components/PageHeader";
import { PageGuide } from "../../components/PageGuide";
import { StatusPill } from "../../components/StatusPill";
import {
  buildMilestoneDependencyTrace,
  isAdverseMilestoneStatus,
  milestoneFromScheduleActivity,
  milestoneStatusAt,
  missingMilestoneRecoveryFields,
} from "../../domain/milestones";
import {
  createMilestoneInputSchema,
  registerErrorSummary,
} from "../../domain/registers";
import type { MetricStatus, Milestone, MilestoneStatus } from "../../domain/types";
import { formatDate } from "../../utils/format";
import { RegisterEditor } from "../registers/RegisterEditor";

const statusPresentation: Record<
  MilestoneStatus,
  { label: string; tone: MetricStatus }
> = {
  "complete-on-time": { label: "Complete on time", tone: "positive" },
  "complete-late": { label: "Complete late", tone: "attention" },
  "on-track": { label: "On track", tone: "positive" },
  "forecast-late": { label: "Forecast late", tone: "adverse" },
  overdue: { label: "Overdue", tone: "adverse" },
  "data-issue": { label: "Data issue", tone: "neutral" },
};

const dependencyPresentation = {
  credible: { label: "Logic traced", tone: "positive" },
  warning: { label: "Logic warning", tone: "attention" },
  unresolved: { label: "Logic unresolved", tone: "adverse" },
  unlinked: { label: "Not linked", tone: "neutral" },
} as const;

const signedDays = (days: number) => {
  if (days === 0) return "On baseline";
  return `${days > 0 ? "+" : ""}${String(days)}${Math.abs(days) === 1 ? " day" : " days"}`;
};

type MilestoneFilter = "all" | "exceptions" | "next-30";

export function MilestonesPage() {
  const {
    milestones,
    reportingDate,
    selectedWorkPackage,
    upsertMilestone,
    mergeMilestones,
    removeMilestone,
  } = useProjectStore();
  const { snapshot } = useProjectPerformance();
  const activeReportingDate = snapshot?.project.reportingDate ?? reportingDate;
  const [editing, setEditing] = useState<Milestone>();
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState("");
  const [filter, setFilter] = useState<MilestoneFilter>("all");
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string>();
  const derivedMilestones = milestones.map((milestone) => ({
    ...milestone,
    status:
      activeReportingDate === ""
        ? milestone.status
        : milestoneStatusAt(milestone, activeReportingDate),
  }));
  const scopedMilestones = derivedMilestones
    .filter(
      (milestone) =>
        selectedWorkPackage === "all" ||
        milestone.wbsId === selectedWorkPackage,
    )
    .filter((milestone) => {
      if (filter === "exceptions") {
        return isAdverseMilestoneStatus(milestone.status);
      }
      if (filter === "next-30") {
        if (milestone.actualDate !== undefined || activeReportingDate === "") {
          return false;
        }
        const days = differenceInCalendarDays(
          parseISO(milestone.forecastDate),
          parseISO(activeReportingDate),
        );
        return days >= 0 && days <= 30;
      }
      return true;
    });
  const completed = derivedMilestones.filter((item) => item.actualDate).length;
  const adverse = derivedMilestones.filter((item) =>
    isAdverseMilestoneStatus(item.status),
  ).length;
  const recoveryIncomplete = derivedMilestones.filter(
    (item) => missingMilestoneRecoveryFields(item).length > 0,
  ).length;
  const nextCommitment = [...derivedMilestones]
    .filter(({ actualDate }) => actualDate === undefined)
    .sort((left, right) => left.forecastDate.localeCompare(right.forecastDate))[0];
  const scheduleMilestones = snapshot?.activities.filter(
    (activity) => activity.isMilestone,
  ) ?? [];
  const unmatchedScheduleMilestones = scheduleMilestones.filter(
    (activity) =>
      !milestones.some(
        (milestone) =>
          milestone.sourceActivityId === activity.id || milestone.id === activity.id,
      ),
  );
  const editorOpen = isAdding || editing !== undefined;

  const closeEditor = () => {
    setEditing(undefined);
    setIsAdding(false);
    setFormError("");
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeReportingDate === "") {
      setFormError("Import project data first so status can be calculated at a controlled reporting date.");
      return;
    }
    const parsed = createMilestoneInputSchema(activeReportingDate).safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      setFormError(registerErrorSummary(parsed.error));
      return;
    }
    if (
      milestones.some(
        ({ id }) => id === parsed.data.id && id !== editing?.id,
      )
    ) {
      setFormError("That milestone ID already exists. Edit the existing record or use a new ID.");
      return;
    }
    if (editing !== undefined && editing.id !== parsed.data.id) {
      removeMilestone(editing.id);
    }
    upsertMilestone({ ...parsed.data, updatedAt: new Date().toISOString() });
    closeEditor();
  };

  const synchroniseImportedMilestones = () => {
    if (snapshot === undefined || scheduleMilestones.length === 0) return;
    const updatedAt = new Date().toISOString();
    mergeMilestones(
      scheduleMilestones.map((activity) => {
        const existing = milestones.find(
          (milestone) =>
            milestone.sourceActivityId === activity.id || milestone.id === activity.id,
        );
        const sourceRecord = milestoneFromScheduleActivity(
          activity,
          snapshot.project.reportingDate,
          updatedAt,
        );
        return existing === undefined
          ? sourceRecord
          : {
              ...sourceRecord,
              id: existing.id,
              previousForecastDate: existing.forecastDate,
              commentary: existing.commentary,
              cause: existing.cause,
              recoveryAction: existing.recoveryAction,
              actionOwner: existing.actionOwner,
              actionDueDate: existing.actionDueDate,
              decisionRequired: existing.decisionRequired,
            };
      }),
    );
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Schedule commitments"
        title="Milestone control"
        description="Control imported and manually entered commitments with calculated status, predecessor evidence and structured recovery ownership."
        actions={
          <div className="page-header-actions">
            {scheduleMilestones.length > 0 ? (
              <button
                className="button button--secondary"
                type="button"
                onClick={synchroniseImportedMilestones}
              >
                <Network size={17} aria-hidden="true" /> {unmatchedScheduleMilestones.length > 0 ? `Add ${String(unmatchedScheduleMilestones.length)} imported milestones` : `Refresh ${String(scheduleMilestones.length)} linked milestones`}
              </button>
            ) : null}
            <button
              className="button button--primary"
              type="button"
              onClick={() => {
                setIsAdding(true);
                setEditing(undefined);
                setFormError("");
              }}
            >
              <Plus size={17} aria-hidden="true" /> Add milestone
            </button>
          </div>
        }
      />

      <PageGuide
        pageName="Milestone control"
        purpose="Use this page after each accepted schedule update to identify movement, test predecessor evidence and assign complete recovery controls."
        steps={[
          { title: "Bring in schedule milestones", detail: "Use Add imported milestones once. Each record keeps an explicit link to the accepted source activity." },
          { title: "Review calculated status", detail: "Status is derived from baseline, forecast, actual and the active data date; it is never selected manually." },
          { title: "Close adverse controls", detail: "For every late, overdue or data-issue record, enter cause, recovery action, owner, due date and the management decision required." },
        ]}
      />

      {editorOpen ? (
        <RegisterEditor
          title={editing ? `Edit milestone ${editing.id}` : "Add milestone"}
          description={`Status will be calculated at ${activeReportingDate ? formatDate(activeReportingDate) : "the active reporting date"}. Adverse records require every recovery field below.`}
          submitLabel="Save milestone"
          error={formError}
          onCancel={closeEditor}
          onSubmit={save}
        >
          <label>Milestone ID<input name="id" required defaultValue={editing?.id ?? ""} placeholder="M-001" /></label>
          <label>Milestone name<input name="name" required defaultValue={editing?.name ?? ""} /></label>
          <label>Work package ID<input name="wbsId" required defaultValue={editing?.wbsId ?? (selectedWorkPackage === "all" ? "" : selectedWorkPackage)} placeholder="WP100" /></label>
          <label>Owner<input name="owner" required defaultValue={editing?.owner ?? ""} /></label>
          <label>Source activity ID (optional)<input name="sourceActivityId" defaultValue={editing?.sourceActivityId ?? ""} placeholder="A-036" /></label>
          <label>Baseline date<input name="baselineDate" type="date" required defaultValue={editing?.baselineDate ?? ""} /></label>
          <label>Previous forecast date<input name="previousForecastDate" type="date" required defaultValue={editing?.previousForecastDate ?? ""} /></label>
          <label>Current forecast date<input name="forecastDate" type="date" required defaultValue={editing?.forecastDate ?? ""} /></label>
          <label>Actual date<input name="actualDate" type="date" defaultValue={editing?.actualDate ?? ""} /></label>
          <fieldset className="register-form-section">
            <legend>Adverse recovery control</legend>
            <p>Complete all five fields when the calculated status is late, overdue or a data issue.</p>
            <div className="register-form-grid register-form-grid--nested">
              <label className="register-form-field--wide">Cause of movement<textarea name="cause" rows={2} defaultValue={editing?.cause ?? ""} /></label>
              <label className="register-form-field--wide">Recovery action<textarea name="recoveryAction" rows={2} defaultValue={editing?.recoveryAction ?? ""} /></label>
              <label>Recovery owner<input name="actionOwner" defaultValue={editing?.actionOwner ?? ""} /></label>
              <label>Recovery due date<input name="actionDueDate" type="date" defaultValue={editing?.actionDueDate ?? ""} /></label>
              <label className="register-form-field--wide">Management decision required<textarea name="decisionRequired" rows={2} defaultValue={editing?.decisionRequired ?? ""} /></label>
            </div>
          </fieldset>
          <label className="register-form-field--wide">Control commentary<textarea name="commentary" rows={3} required defaultValue={editing?.commentary ?? ""} /></label>
        </RegisterEditor>
      ) : null}

      <section className="summary-strip milestone-summary" aria-label="Milestone summary">
        <div><span>Milestones recorded</span><strong>{derivedMilestones.length}</strong></div>
        <div><span>Completed</span><strong>{completed}</strong></div>
        <div><span>Exceptions</span><strong>{adverse}</strong></div>
        <div><span>Recovery incomplete</span><strong>{recoveryIncomplete}</strong></div>
        <div><span>Next commitment</span><strong>{nextCommitment ? formatDate(nextCommitment.forecastDate) : "Not entered"}</strong></div>
      </section>

      <section className="panel" aria-labelledby="milestone-register-title">
        <div className="panel__header milestone-register-header">
          <div><p className="eyebrow">Controlled register</p><h2 id="milestone-register-title">Milestone position</h2><p className="panel__description">The filter changes this table only; status remains anchored to the active reporting date.</p></div>
          <div className="segmented-control" aria-label="Milestone view">
            {(["all", "exceptions", "next-30"] as const).map((value) => (
              <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {value === "all" ? "All" : value === "exceptions" ? "Exceptions" : "Next 30 days"}
              </button>
            ))}
          </div>
        </div>
        {milestones.length === 0 ? (
          <div className="register-empty"><strong>No milestones have been entered.</strong><span>{scheduleMilestones.length > 0 ? "Add the accepted schedule milestones, or create a manual commitment." : "Import schedule data first, then create the controlled commitments."}</span></div>
        ) : scopedMilestones.length === 0 ? (
          <div className="register-empty"><strong>No milestones match this view.</strong><span>Change the milestone view or clear the global work-package scope.</span></div>
        ) : (
          <div className="table-scroll"><table className="milestone-table"><caption className="sr-only">Scoped project milestone register</caption><thead><tr><th scope="col">Milestone / owner</th><th scope="col">Dates and movement</th><th scope="col">Status</th><th scope="col">Recovery control</th><th scope="col">Logic evidence</th><th scope="col">Actions</th></tr></thead><tbody>
            {scopedMilestones.map((milestone) => {
              const presentation = statusPresentation[milestone.status];
              const outcomeDate = milestone.actualDate ?? milestone.forecastDate;
              const variance = differenceInCalendarDays(parseISO(outcomeDate), parseISO(milestone.baselineDate));
              const movement = differenceInCalendarDays(parseISO(milestone.forecastDate), parseISO(milestone.previousForecastDate));
              const missingRecovery = missingMilestoneRecoveryFields(milestone);
              const trace = milestone.sourceActivityId
                ? buildMilestoneDependencyTrace(scheduleMilestones.length > 0 ? snapshot!.activities : [], milestone.sourceActivityId)
                : { sourceActivityId: "", quality: "unlinked" as const, chain: [], issues: [] };
              const logicPresentation = dependencyPresentation[trace.quality];
              const expanded = expandedMilestoneId === milestone.id;
              return [
                <tr key={milestone.id}>
                  <th scope="row"><span className="table-primary">{milestone.name}</span><span className="table-secondary">{milestone.id} · {milestone.wbsId}</span><span className="table-secondary">{milestone.owner}</span>{milestone.sourceActivityId && milestone.sourceActivityId !== milestone.id ? <span className="source-reference">Source {milestone.sourceActivityId}</span> : null}</th>
                  <td><span className="table-primary">{formatDate(outcomeDate)} · {signedDays(variance)}</span><span className="table-secondary">Baseline {formatDate(milestone.baselineDate)} · movement {signedDays(movement)}</span></td>
                  <td><StatusPill status={presentation.tone}>{presentation.label}</StatusPill></td>
                  <td>{missingRecovery.length === 0 ? <span className="control-complete">Complete</span> : <><span className="control-incomplete">{missingRecovery.length} fields missing</span><span className="table-secondary">Publication blocked</span></>}</td>
                  <td><StatusPill status={logicPresentation.tone}>{logicPresentation.label}</StatusPill><span className="table-secondary">{trace.chain.length} predecessor links</span></td>
                  <td><div className="register-row-actions"><button type="button" aria-label={`Review dependency and recovery for ${milestone.sourceActivityId ?? milestone.id}`} aria-expanded={expanded} onClick={() => setExpandedMilestoneId(expanded ? undefined : milestone.id)}><Network size={15} aria-hidden="true" /></button><button type="button" aria-label={`Edit ${milestone.id}`} onClick={() => { setEditing(milestone); setIsAdding(false); setFormError(""); }}><Pencil size={15} aria-hidden="true" /></button><button type="button" aria-label={`Delete ${milestone.id}`} onClick={() => { if (window.confirm(`Delete milestone ${milestone.id}?`)) removeMilestone(milestone.id); }}><Trash2 size={15} aria-hidden="true" /></button></div></td>
                </tr>,
                expanded ? (
                  <tr key={`${milestone.id}-detail`} className="milestone-detail-row"><td colSpan={6}>
                    <div className="milestone-detail-grid">
                      <section><p className="eyebrow">Predecessor evidence</p><h3>{milestone.sourceActivityId ?? "No source activity linked"}</h3><p className="evidence-limitation">This is dependency evidence only, not a calculated critical path. The app enumerates accepted predecessor links and flags logic concerns without inferring driving logic or float.</p>{trace.chain.length === 0 ? <p>No predecessor chain is available.</p> : <ol className="dependency-chain">{trace.chain.slice(0, 12).map((step, index) => <li key={`${step.activityId}-${String(index)}`}><strong>{step.activityId} · {step.activityName}</strong><span>Depth {step.depth} · {step.type} · {String(step.lagDays)} day lag</span></li>)}</ol>}{trace.chain.length > 12 ? <p>{trace.chain.length - 12} earlier links are not shown in this compact view.</p> : null}{trace.issues.length > 0 ? <ul className="logic-issue-list">{trace.issues.map((issue) => <li key={`${issue.code}-${issue.activityId}`}><strong>{issue.code}</strong> — {issue.message}</li>)}</ul> : null}</section>
                      <section><p className="eyebrow">Recovery and decision</p><h3>{missingRecovery.length === 0 ? "Control record complete" : "Control record incomplete"}</h3><dl className="control-definition-list"><div><dt>Cause</dt><dd>{milestone.cause ?? "Not recorded"}</dd></div><div><dt>Recovery action</dt><dd>{milestone.recoveryAction ?? "Not recorded"}</dd></div><div><dt>Owner / due</dt><dd>{milestone.actionOwner ? `${milestone.actionOwner} · ${milestone.actionDueDate ? formatDate(milestone.actionDueDate) : "No due date"}` : "Not recorded"}</dd></div><div><dt>Decision required</dt><dd>{milestone.decisionRequired ?? "Not recorded"}</dd></div><div><dt>Last updated</dt><dd>{milestone.updatedAt ? new Date(milestone.updatedAt).toLocaleString("en-GB") : "Legacy record — not recorded"}</dd></div><div><dt>Commentary</dt><dd>{milestone.commentary}</dd></div></dl></section>
                    </div>
                  </td></tr>
                ) : null,
              ];
            })}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
