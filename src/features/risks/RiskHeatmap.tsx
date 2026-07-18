import type { Risk } from "../../domain/types";

interface RiskHeatmapProps {
  risks: Risk[];
}

const scoreClass = (score: number) => {
  if (score >= 15) return "risk-cell--critical";
  if (score >= 10) return "risk-cell--high";
  if (score >= 5) return "risk-cell--moderate";
  return "risk-cell--low";
};

export function RiskHeatmap({ risks }: RiskHeatmapProps) {
  const probabilities = [5, 4, 3, 2, 1];
  const impacts = [1, 2, 3, 4, 5];

  return (
    <section className="panel risk-map-panel" aria-labelledby="risk-map-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Residual exposure</p>
          <h2 id="risk-map-title">Risk heatmap</h2>
          <p className="panel__description">
            Count of open risks by residual probability and impact (5 × 5).
          </p>
        </div>
        <div className="risk-legend" aria-label="Risk rating legend">
          <span><i className="legend-dot legend-dot--low" />Low</span>
          <span><i className="legend-dot legend-dot--moderate" />Moderate</span>
          <span><i className="legend-dot legend-dot--high" />High</span>
          <span><i className="legend-dot legend-dot--critical" />Critical</span>
        </div>
      </div>

      <div className="risk-map-wrap">
        <span className="risk-axis risk-axis--y">Probability</span>
        <table className="risk-map">
          <caption className="sr-only">
            Residual risk heatmap. Rows are probability and columns are impact.
          </caption>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Probability and impact</span></th>
              {impacts.map((impact) => (
                <th scope="col" key={impact}>{impact}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {probabilities.map((probability) => (
              <tr key={probability}>
                <th scope="row">{probability}</th>
                {impacts.map((impact) => {
                  const matchingRisks = risks.filter(
                    (risk) =>
                      risk.residualProbability === probability &&
                      risk.residualImpact === impact,
                  );
                  const score = probability * impact;
                  const riskNames = matchingRisks.map((risk) => risk.id).join(", ");

                  return (
                    <td
                      key={impact}
                      className={scoreClass(score)}
                      aria-label={
                        "Probability " +
                        String(probability) +
                        ", impact " +
                        String(impact) +
                        ": " +
                        String(matchingRisks.length) +
                        " risks" +
                        (riskNames ? " (" + riskNames + ")" : "")
                      }
                    >
                      <strong>{matchingRisks.length || "–"}</strong>
                      {matchingRisks.length > 0 ? <span>{riskNames}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <span className="risk-axis risk-axis--x">Impact</span>
      </div>
    </section>
  );
}
