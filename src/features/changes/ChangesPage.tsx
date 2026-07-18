import { PageHeader } from "../../components/PageHeader";
import { PageGuide } from "../../components/PageGuide";
import { StatusPill } from "../../components/StatusPill";
import { demoSnapshot } from "../../data/demo";
import type { ChangeStatus, MetricStatus } from "../../domain/types";
import { formatCompactCurrency, formatCurrency, formatDate } from "../../utils/format";

const changeTone: Record<ChangeStatus, MetricStatus> = {
  draft: "neutral",
  submitted: "attention",
  approved: "attention",
  rejected: "neutral",
  implemented: "positive",
  withdrawn: "neutral",
};

const titleCase = (value: string) => value[0]?.toUpperCase() + value.slice(1);

export function ChangesPage() {
  const pending = demoSnapshot.changes.filter(
    (change) => change.status === "submitted",
  );
  const approvedNotIncorporated = demoSnapshot.changes.filter(
    (change) => change.status === "approved" && !change.incorporatedBaselineVersion,
  );
  const proposedCost = pending.reduce((sum, change) => sum + change.costImpact, 0);
  const approvedCost = approvedNotIncorporated.reduce(
    (sum, change) => sum + change.costImpact,
    0,
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Baseline governance"
        title="Change control"
        description="Separate proposed, approved and incorporated change so the performance baseline remains explainable."
      />

      <PageGuide
        pageName="Change control"
        purpose="Use the register to make decisions visible without hiding historic performance or changing the baseline early."
        steps={[
          {
            title: "Check decisions",
            detail: "Start with submitted requests and approved changes that are not yet baselined.",
          },
          {
            title: "Assess impact",
            detail: "Review cost, schedule and decision due date before approval.",
          },
          {
            title: "Protect the baseline",
            detail: "Only an approved and implemented change may link to a new controlled baseline version.",
          },
        ]}
      />

      <section className="summary-strip" aria-label="Change summary">
        <div><span>Total requests</span><strong>{demoSnapshot.changes.length}</strong></div>
        <div><span>Pending decisions</span><strong>{pending.length}</strong></div>
        <div><span>Pending cost</span><strong>{formatCompactCurrency(proposedCost)}</strong></div>
        <div><span>Approved, not baselined</span><strong>{formatCompactCurrency(approvedCost)}</strong></div>
      </section>

      {approvedNotIncorporated.length > 0 ? (
        <aside className="control-note" aria-labelledby="baseline-warning-title">
          <strong id="baseline-warning-title">Baseline integrity warning</strong>
          <p>
            {approvedNotIncorporated.length} approved changes worth {formatCurrency(approvedCost)}
            have not been incorporated into a controlled baseline version. Current EVM
            remains measured against B0.
          </p>
        </aside>
      ) : null}

      <section className="panel" aria-labelledby="change-register-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Decision register</p>
            <h2 id="change-register-title">Change requests</h2>
            <p className="panel__description">
              Cost and schedule impact remain forecast-only until formal baseline incorporation.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Project change-request register</caption>
            <thead>
              <tr>
                <th scope="col">Change</th>
                <th scope="col">Status</th>
                <th scope="col">Cost impact</th>
                <th scope="col">Schedule impact</th>
                <th scope="col">Decision due</th>
                <th scope="col">Baseline treatment</th>
              </tr>
            </thead>
            <tbody>
              {demoSnapshot.changes.map((change) => (
                <tr key={change.id}>
                  <th scope="row">
                    <span className="table-primary">{change.title}</span>
                    <span className="table-secondary">
                      {change.id + " · " + change.wbsId}
                    </span>
                  </th>
                  <td>
                    <StatusPill status={changeTone[change.status]}>
                      {titleCase(change.status)}
                    </StatusPill>
                  </td>
                  <td>{formatCurrency(change.costImpact)}</td>
                  <td>
                    {change.scheduleImpactDays === 0
                      ? "No impact"
                      : "+" + String(change.scheduleImpactDays) + " days"}
                  </td>
                  <td>{formatDate(change.decisionDue)}</td>
                  <td>
                    {change.incorporatedBaselineVersion
                      ? "Incorporated in " + change.incorporatedBaselineVersion
                      : "Not incorporated"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
