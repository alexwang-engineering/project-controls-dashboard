import { differenceInCalendarDays, parseISO } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useProjectStore } from "../../app/store";
import { PageHeader } from "../../components/PageHeader";
import { PageGuide } from "../../components/PageGuide";
import { StatusPill } from "../../components/StatusPill";
import {
  firstRegisterError,
  milestoneInputSchema,
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

const signedDays = (days: number) => {
  if (days === 0) return "On baseline";
  return `${days > 0 ? "+" : ""}${String(days)}${Math.abs(days) === 1 ? " day" : " days"}`;
};

export function MilestonesPage() {
  const {
    milestones,
    selectedWorkPackage,
    upsertMilestone,
    removeMilestone,
  } = useProjectStore();
  const [editing, setEditing] = useState<Milestone>();
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState("");
  const scopedMilestones = milestones.filter(
    (milestone) =>
      selectedWorkPackage === "all" ||
      milestone.wbsId === selectedWorkPackage,
  );
  const completed = scopedMilestones.filter((item) => item.actualDate).length;
  const late = scopedMilestones.filter(
    (item) => item.status === "forecast-late" || item.status === "overdue",
  ).length;
  const nextCommitment = [...scopedMilestones]
    .filter(({ actualDate }) => actualDate === undefined)
    .sort((left, right) => left.forecastDate.localeCompare(right.forecastDate))[0];
  const editorOpen = isAdding || editing !== undefined;

  const closeEditor = () => {
    setEditing(undefined);
    setIsAdding(false);
    setFormError("");
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = milestoneInputSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      setFormError(firstRegisterError(parsed.error));
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
    upsertMilestone(parsed.data);
    closeEditor();
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Schedule commitments"
        title="Milestone control"
        description="Enter and maintain baseline, forecast and actual commitments with ownership and exception commentary."
        actions={
          <button className="button button--primary" type="button" onClick={() => { setIsAdding(true); setEditing(undefined); setFormError(""); }}>
            <Plus size={17} aria-hidden="true" /> Add milestone
          </button>
        }
      />

      <PageGuide
        pageName="Milestone control"
        purpose="Use the global work-package scope to focus accountability, then keep each commitment's forecast, outcome and recovery explanation up to date."
        steps={[
          { title: "Set scope and add", detail: "Choose a work package in the global bar, then enter the commitment ID, owner and approved baseline date." },
          { title: "Maintain the forecast", detail: "Record previous and current forecast dates, actual date and status." },
          { title: "Explain movement", detail: "For every adverse item, record a specific control action in the commentary." },
        ]}
      />

      {editorOpen ? (
        <RegisterEditor
          title={editing ? `Edit milestone ${editing.id}` : "Add milestone"}
          description="Dates use the ISO calendar control; completed statuses require an actual date."
          submitLabel="Save milestone"
          error={formError}
          onCancel={closeEditor}
          onSubmit={save}
        >
          <label>Milestone ID<input name="id" required defaultValue={editing?.id ?? ""} placeholder="M-001" /></label>
          <label>Milestone name<input name="name" required defaultValue={editing?.name ?? ""} /></label>
          <label>Work package ID<input name="wbsId" required defaultValue={editing?.wbsId ?? (selectedWorkPackage === "all" ? "" : selectedWorkPackage)} placeholder="WP100" /></label>
          <label>Owner<input name="owner" required defaultValue={editing?.owner ?? ""} /></label>
          <label>Baseline date<input name="baselineDate" type="date" required defaultValue={editing?.baselineDate ?? ""} /></label>
          <label>Previous forecast date<input name="previousForecastDate" type="date" required defaultValue={editing?.previousForecastDate ?? ""} /></label>
          <label>Current forecast date<input name="forecastDate" type="date" required defaultValue={editing?.forecastDate ?? ""} /></label>
          <label>Actual date<input name="actualDate" type="date" defaultValue={editing?.actualDate ?? ""} /></label>
          <label>Milestone status<select name="status" defaultValue={editing?.status ?? "on-track"}>{Object.entries(statusPresentation).map(([value, presentation]) => <option key={value} value={value}>{presentation.label}</option>)}</select></label>
          <label className="register-form-field--wide">Control commentary<textarea name="commentary" rows={3} required defaultValue={editing?.commentary ?? ""} /></label>
        </RegisterEditor>
      ) : null}

      <section className="summary-strip" aria-label="Milestone summary">
        <div><span>Milestones in scope</span><strong>{scopedMilestones.length}</strong></div>
        <div><span>Completed</span><strong>{completed}</strong></div>
        <div><span>Forecast late</span><strong>{late}</strong></div>
        <div><span>Next commitment</span><strong>{nextCommitment ? formatDate(nextCommitment.forecastDate) : "Not entered"}</strong></div>
      </section>

      <section className="panel" aria-labelledby="milestone-register-title">
        <div className="panel__header"><div><p className="eyebrow">Controlled register</p><h2 id="milestone-register-title">Milestone position</h2><p className="panel__description">Every row below comes from local user input.</p></div></div>
        {milestones.length === 0 ? (
          <div className="register-empty"><strong>No milestones have been entered.</strong><span>Use Add milestone to create the first controlled commitment.</span></div>
        ) : scopedMilestones.length === 0 ? (
          <div className="register-empty"><strong>No milestones match the global scope.</strong><span>Clear the work-package scope or add a commitment for {selectedWorkPackage}.</span></div>
        ) : (
          <div className="table-scroll"><table><caption className="sr-only">Scoped project milestone register</caption><thead><tr><th scope="col">Milestone</th><th scope="col">Owner</th><th scope="col">Baseline</th><th scope="col">Forecast / actual</th><th scope="col">Variance</th><th scope="col">Status</th><th scope="col">Control commentary</th><th scope="col">Actions</th></tr></thead><tbody>
            {scopedMilestones.map((milestone) => {
              const presentation = statusPresentation[milestone.status];
              const outcomeDate = milestone.actualDate ?? milestone.forecastDate;
              const variance = differenceInCalendarDays(parseISO(outcomeDate), parseISO(milestone.baselineDate));
              return <tr key={milestone.id}><th scope="row"><span className="table-primary">{milestone.name}</span><span className="table-secondary">{milestone.id} · {milestone.wbsId}</span></th><td>{milestone.owner}</td><td>{formatDate(milestone.baselineDate)}</td><td><span className="table-primary">{formatDate(outcomeDate)}</span><span className="table-secondary">{milestone.actualDate ? "Actual" : "Current forecast"}</span></td><td className={variance > 0 ? "number--adverse" : undefined}>{signedDays(variance)}</td><td><StatusPill status={presentation.tone}>{presentation.label}</StatusPill></td><td className="commentary-cell">{milestone.commentary}</td><td><div className="register-row-actions"><button type="button" aria-label={`Edit ${milestone.id}`} onClick={() => { setEditing(milestone); setIsAdding(false); setFormError(""); }}><Pencil size={15} aria-hidden="true" /></button><button type="button" aria-label={`Delete ${milestone.id}`} onClick={() => { if (window.confirm(`Delete milestone ${milestone.id}?`)) removeMilestone(milestone.id); }}><Trash2 size={15} aria-hidden="true" /></button></div></td></tr>;
            })}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
