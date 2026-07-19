import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useProjectStore } from "../../app/store";
import { PageHeader } from "../../components/PageHeader";
import { PageGuide } from "../../components/PageGuide";
import { StatusPill } from "../../components/StatusPill";
import { changeInputSchema, firstRegisterError } from "../../domain/registers";
import type { ChangeRequest, ChangeStatus, MetricStatus } from "../../domain/types";
import { formatCompactCurrency, formatCurrency, formatDate } from "../../utils/format";
import { RegisterEditor } from "../registers/RegisterEditor";

const changeTone: Record<ChangeStatus, MetricStatus> = { draft: "neutral", submitted: "attention", approved: "attention", rejected: "neutral", implemented: "positive", withdrawn: "neutral" };
const titleCase = (value: string) => value[0]?.toUpperCase() + value.slice(1);

export function ChangesPage() {
  const { changes, upsertChange, removeChange } = useProjectStore();
  const [editing, setEditing] = useState<ChangeRequest>();
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState("");
  const pending = changes.filter(({ status }) => status === "submitted");
  const approvedNotIncorporated = changes.filter(({ status, incorporatedBaselineVersion }) => status === "approved" && !incorporatedBaselineVersion);
  const proposedCost = pending.reduce((sum, change) => sum + change.costImpact, 0);
  const approvedCost = approvedNotIncorporated.reduce((sum, change) => sum + change.costImpact, 0);
  const editorOpen = isAdding || editing !== undefined;
  const closeEditor = () => { setEditing(undefined); setIsAdding(false); setFormError(""); };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = changeInputSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) { setFormError(firstRegisterError(parsed.error)); return; }
    if (changes.some(({ id }) => id === parsed.data.id && id !== editing?.id)) { setFormError("That change ID already exists. Edit the existing record or use a new ID."); return; }
    if (editing !== undefined && editing.id !== parsed.data.id) removeChange(editing.id);
    upsertChange(parsed.data);
    closeEditor();
  };

  return <div className="page-stack">
    <PageHeader eyebrow="Baseline governance" title="Change control" description="Enter and maintain proposed, approved and incorporated change without rewriting historical performance." actions={<button className="button button--primary" type="button" onClick={() => { setIsAdding(true); setEditing(undefined); setFormError(""); }}><Plus size={17} aria-hidden="true" /> Add change request</button>} />
    <PageGuide pageName="Change control" purpose="Enter each request and keep its decision state, cost/schedule impact and baseline treatment explicit." steps={[{ title: "Describe the request", detail: "Assign its controlled ID, work package and decision due date." }, { title: "Assess impact", detail: "Enter signed cost and schedule consequences before a decision." }, { title: "Protect the baseline", detail: "Only an implemented request may identify its incorporated baseline version." }]} />
    {editorOpen ? <RegisterEditor title={editing ? `Edit change ${editing.id}` : "Add change request"} description="Impacts remain forecast-only until an implemented change identifies its controlled baseline." submitLabel="Save change request" error={formError} onCancel={closeEditor} onSubmit={save}>
      <label>Change ID<input name="id" required defaultValue={editing?.id ?? ""} placeholder="CR-001" /></label><label>Change title<input name="title" required defaultValue={editing?.title ?? ""} /></label><label>Work package ID<input name="wbsId" required defaultValue={editing?.wbsId ?? ""} placeholder="WP100" /></label><label>Change status<select name="status" defaultValue={editing?.status ?? "draft"}>{Object.keys(changeTone).map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label><label>Cost impact (£)<input name="costImpact" type="number" step="0.01" required defaultValue={editing?.costImpact ?? ""} /></label><label>Schedule impact (days)<input name="scheduleImpactDays" type="number" required defaultValue={editing?.scheduleImpactDays ?? ""} /></label><label>Decision due<input name="decisionDue" type="date" required defaultValue={editing?.decisionDue ?? ""} /></label><label>Incorporated baseline version<input name="incorporatedBaselineVersion" defaultValue={editing?.incorporatedBaselineVersion ?? ""} placeholder="Leave blank until implemented" /></label>
    </RegisterEditor> : null}
    <section className="summary-strip" aria-label="Change summary"><div><span>Total requests</span><strong>{changes.length}</strong></div><div><span>Pending decisions</span><strong>{pending.length}</strong></div><div><span>Pending cost</span><strong>{formatCompactCurrency(proposedCost)}</strong></div><div><span>Approved, not baselined</span><strong>{formatCompactCurrency(approvedCost)}</strong></div></section>
    {approvedNotIncorporated.length > 0 ? <aside className="control-note" aria-labelledby="baseline-warning-title"><strong id="baseline-warning-title">Baseline integrity warning</strong><p>{approvedNotIncorporated.length} approved change{approvedNotIncorporated.length === 1 ? "" : "s"} worth {formatCurrency(approvedCost)} have not been incorporated into a controlled baseline version.</p></aside> : null}
    <section className="panel" aria-labelledby="change-register-title"><div className="panel__header"><div><p className="eyebrow">Decision register</p><h2 id="change-register-title">Change requests</h2><p className="panel__description">Every row below comes from local user input.</p></div></div>
      {changes.length === 0 ? <div className="register-empty"><strong>No change requests have been entered.</strong><span>Use Add change request to record the first controlled proposal.</span></div> : <div className="table-scroll"><table><caption className="sr-only">Project change-request register</caption><thead><tr><th scope="col">Change</th><th scope="col">Status</th><th scope="col">Cost impact</th><th scope="col">Schedule impact</th><th scope="col">Decision due</th><th scope="col">Baseline treatment</th><th scope="col">Actions</th></tr></thead><tbody>{changes.map((change) => <tr key={change.id}><th scope="row"><span className="table-primary">{change.title}</span><span className="table-secondary">{change.id} · {change.wbsId}</span></th><td><StatusPill status={changeTone[change.status]}>{titleCase(change.status)}</StatusPill></td><td>{formatCurrency(change.costImpact)}</td><td>{change.scheduleImpactDays === 0 ? "No impact" : `${change.scheduleImpactDays > 0 ? "+" : ""}${String(change.scheduleImpactDays)} days`}</td><td>{formatDate(change.decisionDue)}</td><td>{change.incorporatedBaselineVersion ? `Incorporated in ${change.incorporatedBaselineVersion}` : "Not incorporated"}</td><td><div className="register-row-actions"><button type="button" aria-label={`Edit ${change.id}`} onClick={() => { setEditing(change); setIsAdding(false); setFormError(""); }}><Pencil size={15} aria-hidden="true" /></button><button type="button" aria-label={`Delete ${change.id}`} onClick={() => { if (window.confirm(`Delete change ${change.id}?`)) removeChange(change.id); }}><Trash2 size={15} aria-hidden="true" /></button></div></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
