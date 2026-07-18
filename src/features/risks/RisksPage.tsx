import { PageHeader } from "../../components/PageHeader";
import { PageGuide } from "../../components/PageGuide";
import { StatusPill } from "../../components/StatusPill";
import { demoSnapshot } from "../../data/demo";
import type { MetricStatus, RiskRating } from "../../domain/types";
import { formatDate } from "../../utils/format";
import { RiskHeatmap } from "./RiskHeatmap";

const riskTone: Record<RiskRating, MetricStatus> = {
  low: "positive",
  moderate: "attention",
  high: "attention",
  critical: "adverse",
};

export function RisksPage() {
  const critical = demoSnapshot.risks.filter((risk) => risk.rating === "critical").length;
  const high = demoSnapshot.risks.filter((risk) => risk.rating === "high").length;
  const breached = demoSnapshot.risks.filter(
    (risk) => risk.triggerStatus === "breached",
  ).length;
  const totalExposure = demoSnapshot.risks.reduce(
    (sum, risk) => sum + risk.residualScore,
    0,
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Uncertainty control"
        title="Risk exposure"
        description="Prioritise residual exposure, breached triggers and treatment actions before they become delivery variance."
      />

      <PageGuide
        pageName="Risk exposure"
        purpose="Use residual exposure and trigger evidence to decide which treatments need management attention now."
        steps={[
          {
            title: "Read exposure",
            detail: "Start with critical or high risks and any breached early-warning triggers.",
          },
          {
            title: "Locate concentration",
            detail: "Use the heatmap to see where probability and impact combine; confirm exact values in the register.",
          },
          {
            title: "Prioritise treatment",
            detail: "Work down the sorted register and check each control, owner and treatment due date.",
          },
        ]}
      />

      <section className="summary-strip" aria-label="Risk summary">
        <div><span>Open risks</span><strong>{demoSnapshot.risks.length}</strong></div>
        <div><span>Critical / high</span><strong>{critical + high}</strong></div>
        <div><span>Breached triggers</span><strong>{breached}</strong></div>
        <div><span>Exposure points</span><strong>{totalExposure}</strong></div>
      </section>

      <RiskHeatmap risks={demoSnapshot.risks} />

      <section className="panel" aria-labelledby="risk-register-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Treatment ownership</p>
            <h2 id="risk-register-title">Prioritised risk register</h2>
            <p className="panel__description">
              Sorted from highest residual score to lowest.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Project risk register</caption>
            <thead>
              <tr>
                <th scope="col">Risk</th>
                <th scope="col">Owner</th>
                <th scope="col">P × I</th>
                <th scope="col">Rating</th>
                <th scope="col">Trigger</th>
                <th scope="col">Control</th>
                <th scope="col">Treatment due</th>
              </tr>
            </thead>
            <tbody>
              {[...demoSnapshot.risks]
                .sort((left, right) => right.residualScore - left.residualScore)
                .map((risk) => (
                  <tr key={risk.id}>
                    <th scope="row">
                      <span className="table-primary">{risk.title}</span>
                      <span className="table-secondary">
                        {risk.id + " · " + risk.wbsId + " · " + risk.category}
                      </span>
                    </th>
                    <td>{risk.owner}</td>
                    <td>
                      {risk.residualProbability + " × " + risk.residualImpact +
                        " = " + risk.residualScore}
                    </td>
                    <td>
                      <StatusPill status={riskTone[risk.rating]}>
                        {risk.rating[0]?.toUpperCase() + risk.rating.slice(1)}
                      </StatusPill>
                    </td>
                    <td>
                      <span className={"trigger trigger--" + risk.triggerStatus}>
                        {risk.triggerStatus}
                      </span>
                    </td>
                    <td>{risk.controlEffectiveness}</td>
                    <td>{formatDate(risk.treatmentDue)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
