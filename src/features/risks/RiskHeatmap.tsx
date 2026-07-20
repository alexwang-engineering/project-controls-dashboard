import { riskExposure } from "../../domain/risks";
import type { Risk, RiskExposureBasis } from "../../domain/types";

export interface RiskHeatmapCell {
  probability: number;
  impact: number;
}

interface RiskHeatmapProps {
  risks: Risk[];
  basis: RiskExposureBasis;
  selectedCell?: RiskHeatmapCell;
  onSelectCell: (cell: RiskHeatmapCell | undefined) => void;
}

const scoreClass = (score: number) => {
  if (score >= 15) return "risk-cell--critical";
  if (score >= 10) return "risk-cell--high";
  if (score >= 5) return "risk-cell--moderate";
  return "risk-cell--low";
};

export function RiskHeatmap({
  risks,
  basis,
  selectedCell,
  onSelectCell,
}: RiskHeatmapProps) {
  const probabilities = [5, 4, 3, 2, 1];
  const impacts = [1, 2, 3, 4, 5];
  const basisLabel = basis === "inherent" ? "Inherent" : "Residual";

  return (
    <section className="panel risk-map-panel" aria-labelledby="risk-map-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">{basisLabel} exposure</p>
          <h2 id="risk-map-title">Risk heatmap</h2>
          <p className="panel__description">
            Select a cell to focus the register on its {basis} probability and impact.
          </p>
        </div>
        <div className="risk-legend" aria-label="Risk rating legend">
          <span><i className="legend-dot legend-dot--low" />Low</span>
          <span><i className="legend-dot legend-dot--moderate" />Moderate</span>
          <span><i className="legend-dot legend-dot--high" />High</span>
          <span><i className="legend-dot legend-dot--critical" />Critical</span>
        </div>
      </div>

      <p className="risk-map-limitation">
        This matrix is an ordinal prioritisation aid. It does not aggregate exposure
        into a cost, probability or portfolio total.
      </p>

      <div className="risk-map-wrap">
        <span className="risk-axis risk-axis--y">Probability</span>
        <table className="risk-map">
          <caption className="sr-only">
            {basisLabel} risk heatmap. Rows are probability and columns are impact.
          </caption>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Probability and impact</span></th>
              {impacts.map((impact) => <th scope="col" key={impact}>{impact}</th>)}
            </tr>
          </thead>
          <tbody>
            {probabilities.map((probability) => (
              <tr key={probability}>
                <th scope="row">{probability}</th>
                {impacts.map((impact) => {
                  const matchingRisks = risks.filter((risk) => {
                    const exposure = riskExposure(risk, basis);
                    return exposure.probability === probability && exposure.impact === impact;
                  });
                  const score = probability * impact;
                  const riskNames = matchingRisks.map(({ id }) => id).join(", ");
                  const selected =
                    selectedCell?.probability === probability &&
                    selectedCell.impact === impact;
                  const countLabel = `${matchingRisks.length} ${
                    matchingRisks.length === 1 ? "risk" : "risks"
                  }${riskNames ? ` (${riskNames})` : ""}`;

                  return (
                    <td key={impact} className={scoreClass(score)}>
                      <button
                        type="button"
                        aria-label={`Probability ${probability}, impact ${impact}: ${countLabel}`}
                        aria-pressed={selected}
                        onClick={() =>
                          onSelectCell(
                            selected ? undefined : { probability, impact },
                          )
                        }
                      >
                        <strong>{matchingRisks.length || "–"}</strong>
                        {matchingRisks.length > 0 ? <span>{riskNames}</span> : null}
                      </button>
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
