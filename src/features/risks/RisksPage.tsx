import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useProjectStore } from "../../app/store";
import { PageHeader } from "../../components/PageHeader";
import { PageGuide } from "../../components/PageGuide";
import { StatusPill } from "../../components/StatusPill";
import { firstRegisterError, riskInputSchema } from "../../domain/registers";
import type { MetricStatus, Risk, RiskRating } from "../../domain/types";
import { formatDate } from "../../utils/format";
import { RegisterEditor } from "../registers/RegisterEditor";
import { RiskHeatmap } from "./RiskHeatmap";

const riskTone: Record<RiskRating, MetricStatus> = { low: "positive", moderate: "attention", high: "attention", critical: "adverse" };

export function RisksPage() {
  const { risks, upsertRisk, removeRisk } = useProjectStore();
  const [editing, setEditing] = useState<Risk>();
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState("");
  const critical = risks.filter(({ rating }) => rating === "critical").length;
  const high = risks.filter(({ rating }) => rating === "high").length;
  const breached = risks.filter(({ triggerStatus }) => triggerStatus === "breached").length;
  const totalExposure = risks.reduce((sum, risk) => sum + risk.residualScore, 0);
  const editorOpen = isAdding || editing !== undefined;
  const closeEditor = () => { setEditing(undefined); setIsAdding(false); setFormError(""); };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = riskInputSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) { setFormError(firstRegisterError(parsed.error)); return; }
    if (risks.some(({ id }) => id === parsed.data.id && id !== editing?.id)) { setFormError("That risk ID already exists. Edit the existing record or use a new ID."); return; }
    if (editing !== undefined && editing.id !== parsed.data.id) removeRisk(editing.id);
    upsertRisk(parsed.data);
    closeEditor();
  };

  return <div className="page-stack">
    <PageHeader eyebrow="Uncertainty control" title="Risk exposure" description="Enter, score and maintain risks, triggers, controls and treatment actions." actions={<button className="button button--primary" type="button" onClick={() => { setIsAdding(true); setEditing(undefined); setFormError(""); }}><Plus size={17} aria-hidden="true" /> Add risk</button>} />
    <PageGuide pageName="Risk exposure" purpose="Enter each risk, score its current residual exposure and keep the trigger, control and treatment evidence current." steps={[{ title: "Describe the uncertainty", detail: "Assign an ID, work package, category and accountable owner." }, { title: "Score residual exposure", detail: "Enter probability and impact from 1 to 5; the score and rating are derived." }, { title: "Own the response", detail: "Record the trigger position, control effectiveness, treatment and due date." }]} />
    {editorOpen ? <RegisterEditor title={editing ? `Edit risk ${editing.id}` : "Add risk"} description="Residual score and rating are calculated automatically from probability × impact." submitLabel="Save risk" error={formError} onCancel={closeEditor} onSubmit={save}>
      <label>Risk ID<input name="id" required defaultValue={editing?.id ?? ""} placeholder="R-001" /></label><label>Risk title<input name="title" required defaultValue={editing?.title ?? ""} /></label><label>Work package ID<input name="wbsId" required defaultValue={editing?.wbsId ?? ""} placeholder="WP100" /></label><label>Owner<input name="owner" required defaultValue={editing?.owner ?? ""} /></label><label>Category<input name="category" required defaultValue={editing?.category ?? ""} /></label><label>Residual probability<input name="residualProbability" type="number" min="1" max="5" required defaultValue={editing?.residualProbability ?? 1} /></label><label>Residual impact<input name="residualImpact" type="number" min="1" max="5" required defaultValue={editing?.residualImpact ?? 1} /></label><label>Treatment due<input name="treatmentDue" type="date" required defaultValue={editing?.treatmentDue ?? ""} /></label><label>Trigger status<select name="triggerStatus" defaultValue={editing?.triggerStatus ?? "clear"}><option value="clear">Clear</option><option value="watch">Watch</option><option value="breached">Breached</option></select></label><label>Control effectiveness<select name="controlEffectiveness" defaultValue={editing?.controlEffectiveness ?? "effective"}><option value="effective">Effective</option><option value="partly-effective">Partly effective</option><option value="ineffective">Ineffective</option></select></label><label className="register-form-field--wide">Treatment action<textarea name="treatment" rows={3} required defaultValue={editing?.treatment ?? ""} /></label>
    </RegisterEditor> : null}
    <section className="summary-strip" aria-label="Risk summary"><div><span>Open risks</span><strong>{risks.length}</strong></div><div><span>Critical / high</span><strong>{critical + high}</strong></div><div><span>Breached triggers</span><strong>{breached}</strong></div><div><span>Exposure points</span><strong>{totalExposure}</strong></div></section>
    <RiskHeatmap risks={risks} />
    <section className="panel" aria-labelledby="risk-register-title"><div className="panel__header"><div><p className="eyebrow">Treatment ownership</p><h2 id="risk-register-title">Prioritised risk register</h2><p className="panel__description">User-entered risks sorted from highest residual score to lowest.</p></div></div>
      {risks.length === 0 ? <div className="register-empty"><strong>No risks have been entered.</strong><span>Use Add risk to create and score the first uncertainty.</span></div> : <div className="table-scroll"><table><caption className="sr-only">Project risk register</caption><thead><tr><th scope="col">Risk</th><th scope="col">Owner</th><th scope="col">P × I</th><th scope="col">Rating</th><th scope="col">Trigger</th><th scope="col">Control</th><th scope="col">Treatment due</th><th scope="col">Actions</th></tr></thead><tbody>{[...risks].sort((left, right) => right.residualScore - left.residualScore).map((risk) => <tr key={risk.id}><th scope="row"><span className="table-primary">{risk.title}</span><span className="table-secondary">{risk.id} · {risk.wbsId} · {risk.category}</span></th><td>{risk.owner}</td><td>{risk.residualProbability} × {risk.residualImpact} = {risk.residualScore}</td><td><StatusPill status={riskTone[risk.rating]}>{risk.rating[0]?.toUpperCase() + risk.rating.slice(1)}</StatusPill></td><td><span className={`trigger trigger--${risk.triggerStatus}`}>{risk.triggerStatus}</span></td><td>{risk.controlEffectiveness}</td><td>{formatDate(risk.treatmentDue)}</td><td><div className="register-row-actions"><button type="button" aria-label={`Edit ${risk.id}`} onClick={() => { setEditing(risk); setIsAdding(false); setFormError(""); }}><Pencil size={15} aria-hidden="true" /></button><button type="button" aria-label={`Delete ${risk.id}`} onClick={() => { if (window.confirm(`Delete risk ${risk.id}?`)) removeRisk(risk.id); }}><Trash2 size={15} aria-hidden="true" /></button></div></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
