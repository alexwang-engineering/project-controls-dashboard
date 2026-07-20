import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useProjectStore } from "../../app/store";
import { PageGuide } from "../../components/PageGuide";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { firstRegisterError, riskInputSchema } from "../../domain/registers";
import {
  riskExceptionFlags,
  riskExposure,
  riskTrend,
} from "../../domain/risks";
import type {
  MetricStatus,
  Risk,
  RiskExposureBasis,
  RiskRating,
} from "../../domain/types";
import { formatDate } from "../../utils/format";
import { RegisterEditor } from "../registers/RegisterEditor";
import { RiskHeatmap, type RiskHeatmapCell } from "./RiskHeatmap";

const riskTone: Record<RiskRating, MetricStatus> = {
  low: "positive",
  moderate: "attention",
  high: "attention",
  critical: "adverse",
};

const titleCase = (value: string) =>
  value
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");

const fixedExceptionLabels = [
  ["aboveTolerance", "Above tolerance"],
  ["treatmentOverdue", "Treatment overdue"],
  ["reviewOverdue", "Review overdue"],
  ["triggerBreached", "Breached trigger"],
  ["escalationRequired", "Escalation evidence required"],
] as const;

const exceptionText = (
  risk: Risk,
  flags: ReturnType<typeof riskExceptionFlags>,
) => [
  ...fixedExceptionLabels
    .filter(([key]) => flags[key])
    .map(([, label]) => label),
  ...(flags.controlConcern
    ? [
        risk.controlEffectiveness === "not-tested"
          ? "Control not tested"
          : "Ineffective control",
      ]
    : []),
];

interface RisksPageProps {
  reportingDateOverride?: string;
}

export function RisksPage({ reportingDateOverride }: RisksPageProps) {
  const {
    risks,
    selectedWorkPackage,
    reportingDate: storedReportingDate,
    upsertRisk,
    removeRisk,
  } = useProjectStore();
  const reportingDate = reportingDateOverride ?? storedReportingDate;
  const [editing, setEditing] = useState<Risk>();
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState("");
  const [basis, setBasis] = useState<RiskExposureBasis>("residual");
  const [owner, setOwner] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("active");
  const [rating, setRating] = useState("all");
  const [selectedCell, setSelectedCell] = useState<RiskHeatmapCell>();

  useEffect(() => {
    setOwner("all");
    setCategory("all");
    setStatus("active");
    setRating("all");
    setSelectedCell(undefined);
  }, [selectedWorkPackage]);

  const scopeRisks = useMemo(
    () =>
      risks.filter(
        (risk) =>
          selectedWorkPackage === "all" ||
          risk.wbsId === selectedWorkPackage,
      ),
    [risks, selectedWorkPackage],
  );

  const owners = useMemo(
    () => [...new Set(scopeRisks.map((risk) => risk.owner))].sort(),
    [scopeRisks],
  );
  const categories = useMemo(
    () => [...new Set(scopeRisks.map((risk) => risk.category))].sort(),
    [scopeRisks],
  );
  const filteredBeforeCell = scopeRisks.filter((risk) => {
    const exposure = riskExposure(risk, basis);
    return (
      (owner === "all" || risk.owner === owner) &&
      (category === "all" || risk.category === category) &&
      (status === "all" || (risk.status ?? "active") === status) &&
      (rating === "all" || exposure.rating === rating)
    );
  });
  const filteredRisks = filteredBeforeCell.filter((risk) => {
    if (!selectedCell) return true;
    const exposure = riskExposure(risk, basis);
    return (
      exposure.probability === selectedCell.probability &&
      exposure.impact === selectedCell.impact
    );
  });
  const exceptionRisks = filteredRisks
    .map((risk) => ({
      risk,
      flags: riskExceptionFlags(risk, reportingDate),
    }))
    .filter(({ flags }) => Object.values(flags).some(Boolean));
  const criticalOrHigh = filteredRisks.filter((risk) =>
    ["critical", "high"].includes(riskExposure(risk, basis).rating),
  ).length;
  const breached = filteredRisks.filter(
    ({ triggerStatus }) => triggerStatus === "breached",
  ).length;
  const aboveTolerance = filteredRisks.filter(
    (risk) => riskExceptionFlags(risk, reportingDate).aboveTolerance,
  ).length;
  const editorOpen = isAdding || editing !== undefined;

  const closeEditor = () => {
    setEditing(undefined);
    setIsAdding(false);
    setFormError("");
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = riskInputSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    if (!parsed.success) {
      setFormError(firstRegisterError(parsed.error));
      return;
    }
    if (risks.some(({ id }) => id === parsed.data.id && id !== editing?.id)) {
      setFormError(
        "That risk ID already exists. Edit the existing record or use a new ID.",
      );
      return;
    }
    if (editing !== undefined && editing.id !== parsed.data.id) {
      removeRisk(editing.id);
    }
    upsertRisk(parsed.data);
    closeEditor();
  };

  const clearFilters = () => {
    setOwner("all");
    setCategory("all");
    setStatus("active");
    setRating("all");
    setSelectedCell(undefined);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Uncertainty control"
        title="Risk exposure"
        description="Compare inherent and residual exposure, test controls and route exceptions to a named decision."
        actions={
          <button
            className="button button--primary"
            type="button"
            onClick={() => {
              setIsAdding(true);
              setEditing(undefined);
              setFormError("");
            }}
          >
            <Plus size={17} aria-hidden="true" /> Add risk
          </button>
        }
      />
      <PageGuide
        pageName="Risk exposure"
        purpose="Use the global work-package scope to focus exposure, then turn uncertain events into owned controls, timed treatments and explicit tolerance decisions."
        steps={[
          {
            title: "Describe cause, event and effect",
            detail: "Choose the work-package scope first, then record the condition, possible event, consequence, objective and accountable owner.",
          },
          {
            title: "Compare inherent and residual risk",
            detail: "Score both positions from 1 to 5 and record the previous residual position for trend.",
          },
          {
            title: "Close control exceptions",
            detail: "Test the control, review the trigger and escalate or formally accept anything above tolerance.",
          },
        ]}
      />

      {editorOpen ? (
        <RegisterEditor
          title={editing ? `Edit risk ${editing.id}` : "Add risk"}
          description="Scores and ratings are derived. Above-tolerance exposure requires escalation or authorised acceptance evidence."
          submitLabel="Save risk"
          error={formError}
          onCancel={closeEditor}
          onSubmit={save}
        >
          <label>Risk ID<input name="id" required defaultValue={editing?.id ?? ""} placeholder="R-001" /></label>
          <label>Risk title<input name="title" required defaultValue={editing?.title ?? ""} /></label>
          <label>Work package ID<input name="wbsId" required defaultValue={editing?.wbsId ?? (selectedWorkPackage === "all" ? "" : selectedWorkPackage)} placeholder="WP100" /></label>
          <label>Owner<input name="owner" required defaultValue={editing?.owner ?? ""} /></label>
          <label>Category<input name="category" required defaultValue={editing?.category ?? ""} /></label>
          <label>Status<select name="status" defaultValue={editing?.status ?? "active"}><option value="active">Active</option><option value="closed">Closed</option></select></label>
          <label>Objective threatened<select name="objective" defaultValue={editing?.objective ?? "schedule"}><option value="safety-quality">Safety / quality</option><option value="schedule">Schedule</option><option value="cost">Cost</option><option value="operational-readiness">Operational readiness</option></select></label>

          <fieldset className="register-form-section">
            <legend>Risk statement</legend>
            <p>Use a cause–event–effect structure so the response targets the real uncertainty.</p>
            <label>Condition<textarea name="condition" rows={2} required defaultValue={editing?.condition ?? ""} /></label>
            <label>Possible event<textarea name="event" rows={2} required defaultValue={editing?.event ?? ""} /></label>
            <label>Consequence<textarea name="consequence" rows={2} required defaultValue={editing?.consequence ?? ""} /></label>
          </fieldset>

          <fieldset className="register-form-section risk-score-fields">
            <legend>Exposure and trend</legend>
            <p>Probability and impact use an ordinal 1–5 scale; scores are prioritisation aids, not monetary exposure.</p>
            <label>Inherent probability<input name="inherentProbability" type="number" min="1" max="5" required defaultValue={editing?.inherentProbability ?? editing?.residualProbability ?? 1} /></label>
            <label>Inherent impact<input name="inherentImpact" type="number" min="1" max="5" required defaultValue={editing?.inherentImpact ?? editing?.residualImpact ?? 1} /></label>
            <label>Previous residual probability<input name="previousResidualProbability" type="number" min="1" max="5" required defaultValue={editing?.previousResidualProbability ?? editing?.residualProbability ?? 1} /></label>
            <label>Previous residual impact<input name="previousResidualImpact" type="number" min="1" max="5" required defaultValue={editing?.previousResidualImpact ?? editing?.residualImpact ?? 1} /></label>
            <label>Residual probability<input name="residualProbability" type="number" min="1" max="5" required defaultValue={editing?.residualProbability ?? 1} /></label>
            <label>Residual impact<input name="residualImpact" type="number" min="1" max="5" required defaultValue={editing?.residualImpact ?? 1} /></label>
          </fieldset>

          <fieldset className="register-form-section">
            <legend>Treatment and trigger</legend>
            <label>Treatment action<textarea name="treatment" rows={3} required defaultValue={editing?.treatment ?? ""} /></label>
            <label>Treatment due<input name="treatmentDue" type="date" required defaultValue={editing?.treatmentDue ?? ""} /></label>
            <label>Review date<input name="reviewDate" type="date" required defaultValue={editing?.reviewDate ?? editing?.treatmentDue ?? ""} /></label>
            <label>Early-warning trigger<textarea name="triggerDescription" rows={2} required defaultValue={editing?.triggerDescription ?? ""} /></label>
            <label>Trigger status<select name="triggerStatus" defaultValue={editing?.triggerStatus ?? "clear"}><option value="clear">Clear</option><option value="watch">Watch</option><option value="breached">Breached</option></select></label>
          </fieldset>

          <fieldset className="register-form-section">
            <legend>Key control test</legend>
            <label>Key control<textarea name="controlDescription" rows={2} required defaultValue={editing?.controlDescription ?? ""} /></label>
            <label>Control owner<input name="controlOwner" required defaultValue={editing?.controlOwner ?? ""} /></label>
            <label>Control evidence<input name="controlEvidence" required defaultValue={editing?.controlEvidence ?? ""} placeholder="Evidence reference" /></label>
            <label>Control test date<input name="controlTestDate" type="date" required defaultValue={editing?.controlTestDate ?? ""} /></label>
            <label>Control effectiveness<select name="controlEffectiveness" defaultValue={editing?.controlEffectiveness ?? "not-tested"}><option value="effective">Effective</option><option value="partly-effective">Partly effective</option><option value="ineffective">Ineffective</option><option value="not-tested">Not tested</option></select></label>
          </fieldset>

          <fieldset className="register-form-section">
            <legend>Tolerance decision</legend>
            <label>Tolerance decision<select name="disposition" defaultValue={editing?.disposition ?? "within-tolerance"}><option value="within-tolerance">Within tolerance</option><option value="escalated">Escalated</option><option value="accepted">Authorised acceptance</option></select></label>
            <label>Escalation owner<input name="escalationOwner" defaultValue={editing?.escalationOwner ?? ""} /></label>
            <label>Escalation date<input name="escalationDate" type="date" defaultValue={editing?.escalationDate ?? ""} /></label>
            <label>Acceptance authority<input name="acceptanceAuthority" defaultValue={editing?.acceptanceAuthority ?? ""} /></label>
            <label>Acceptance rationale<textarea name="acceptanceRationale" rows={2} defaultValue={editing?.acceptanceRationale ?? ""} /></label>
            <label>Acceptance review date<input name="acceptanceReviewDate" type="date" defaultValue={editing?.acceptanceReviewDate ?? ""} /></label>
          </fieldset>
        </RegisterEditor>
      ) : null}

      <section className="panel risk-filters" aria-labelledby="risk-filter-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Current view</p>
            <h2 id="risk-filter-title">Filter and compare</h2>
            <p className="panel__description">All filters combine; the heatmap and register use the same exposure basis.</p>
          </div>
        </div>
        <div className="filter-bar risk-filter-grid">
          <label>Exposure basis<select value={basis} onChange={(event) => { setBasis(event.target.value as RiskExposureBasis); setSelectedCell(undefined); }}><option value="residual">Residual</option><option value="inherent">Inherent</option></select></label>
          <label>Owner filter<select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="all">All owners</option>{owners.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Category filter<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Status filter<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="closed">Closed</option><option value="all">All statuses</option></select></label>
          <label>Rating filter<select value={rating} onChange={(event) => setRating(event.target.value)}><option value="all">All ratings</option><option value="critical">Critical</option><option value="high">High</option><option value="moderate">Moderate</option><option value="low">Low</option></select></label>
          <button className="button button--secondary" type="button" onClick={clearFilters}>Clear filters</button>
          <p aria-live="polite">{filteredRisks.length} of {scopeRisks.length} risks shown</p>
        </div>
      </section>

      <section className="summary-strip" aria-label="Risk summary">
        <div><span>Risks shown</span><strong>{filteredRisks.length}</strong></div>
        <div><span>Critical / high</span><strong>{criticalOrHigh}</strong></div>
        <div><span>Breached triggers</span><strong>{breached}</strong></div>
        <div><span>Above tolerance</span><strong>{aboveTolerance}</strong></div>
      </section>

      <RiskHeatmap
        risks={filteredBeforeCell}
        basis={basis}
        selectedCell={selectedCell}
        onSelectCell={setSelectedCell}
      />

      <section className="panel risk-exceptions" aria-labelledby="risk-exceptions-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Management action</p>
            <h2 id="risk-exceptions-title">Risk exceptions requiring attention</h2>
            <p className="panel__description">Exceptions use the current filters and reporting date{reportingDate ? ` ${formatDate(reportingDate)}` : " (not yet set)"}.</p>
          </div>
        </div>
        {exceptionRisks.length === 0 ? (
          <p className="register-empty">No exceptions in the current view.</p>
        ) : (
          <ul className="risk-exception-list">
            {exceptionRisks.map(({ risk, flags }) => (
              <li key={risk.id}>
                <strong>{risk.id} · {risk.title}</strong>
                <span>{exceptionText(risk, flags).join(" · ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="risk-register-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Treatment ownership</p>
            <h2 id="risk-register-title">Prioritised risk register</h2>
            <p className="panel__description">Sorted from highest to lowest {basis} score. Select a heatmap cell to focus the list.</p>
          </div>
        </div>
        {risks.length === 0 ? (
          <div className="register-empty"><strong>No risks have been entered.</strong><span>Use Add risk to create and control the first uncertainty.</span></div>
        ) : filteredRisks.length === 0 ? (
          <div className="register-empty"><strong>No risks match the global scope and current filters.</strong><span>Clear the work-package scope or change a local filter to restore records.</span></div>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Filtered project risk register</caption>
              <thead><tr><th scope="col">Risk</th><th scope="col">Owner</th><th scope="col">Exposure</th><th scope="col">Rating</th><th scope="col">Trend</th><th scope="col">Trigger / control</th><th scope="col">Decision</th><th scope="col">Treatment due</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {[...filteredRisks]
                  .sort((left, right) => riskExposure(right, basis).score - riskExposure(left, basis).score)
                  .map((risk) => {
                    const exposure = riskExposure(risk, basis);
                    const inherent = riskExposure(risk, "inherent");
                    const residual = riskExposure(risk, "residual");
                    return (
                      <tr key={risk.id}>
                        <th scope="row"><span className="table-primary">{risk.title}</span><span className="table-secondary">{risk.id} · {risk.wbsId} · {risk.category}</span></th>
                        <td>{risk.owner}</td>
                        <td>{basis === "inherent" ? `${exposure.probability} × ${exposure.impact} = ${exposure.score}` : `${inherent.score} → ${residual.score}`}</td>
                        <td><StatusPill status={riskTone[exposure.rating]}>{titleCase(exposure.rating)}</StatusPill></td>
                        <td>{titleCase(riskTrend(risk))}</td>
                        <td><span className={`trigger trigger--${risk.triggerStatus}`}>{titleCase(risk.triggerStatus)}</span><span className="table-secondary">{titleCase(risk.controlEffectiveness)}</span></td>
                        <td>{titleCase(risk.disposition ?? "not-recorded")}</td>
                        <td>{formatDate(risk.treatmentDue)}</td>
                        <td><div className="register-row-actions"><button type="button" aria-label={`Edit ${risk.id}`} onClick={() => { setEditing(risk); setIsAdding(false); setFormError(""); }}><Pencil size={15} aria-hidden="true" /></button><button type="button" aria-label={`Delete ${risk.id}`} onClick={() => { if (window.confirm(`Delete risk ${risk.id}?`)) removeRisk(risk.id); }}><Trash2 size={15} aria-hidden="true" /></button></div></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
