import { Gauge, Target } from "lucide-react";
import type {
  EacScenario,
  EacScenarioId,
} from "../../domain/calculations/eacScenarios";
import type { EarnedValueResult } from "../../domain/calculations/earnedValue";
import {
  formatCompactCurrency,
  formatCurrency,
  formatIndex,
} from "../../utils/format";

export function EacScenarioPanel({
  scenarios,
  selectedScenarioId,
  metrics,
  onSelect,
}: {
  scenarios: readonly EacScenario[];
  selectedScenarioId: EacScenarioId;
  metrics: EarnedValueResult;
  onSelect: (scenarioId: EacScenarioId) => void;
}) {
  const selected = scenarios.find(({ id }) => id === selectedScenarioId);

  return (
    <section
      className="panel eac-panel"
      aria-labelledby="eac-sensitivity-title"
    >
      <div className="panel__header">
        <div>
          <p className="eyebrow">Forecast sensitivity</p>
          <h2 id="eac-sensitivity-title">
            EAC sensitivity and management selection
          </h2>
          <p className="panel__description">
            Compare three formula-based views. Selection changes management EAC,
            VAC and TCPI-EAC; it does not rewrite imported cost facts.
          </p>
        </div>
        <span className="reporting-period">
          <Gauge size={15} aria-hidden="true" /> Three stated assumptions
        </span>
      </div>

      <fieldset className="eac-scenarios">
        <legend className="sr-only">Select the management EAC scenario</legend>
        {scenarios.map((scenario) => (
          <label
            className={`eac-scenario ${scenario.id === selectedScenarioId ? "eac-scenario--selected" : ""} ${scenario.available ? "" : "eac-scenario--unavailable"}`}
            key={scenario.id}
          >
            <span className="eac-scenario__control">
              <input
                type="radio"
                name="management-eac-scenario"
                value={scenario.id}
                checked={scenario.id === selectedScenarioId}
                disabled={!scenario.available}
                onChange={() => onSelect(scenario.id)}
              />
              <strong>{scenario.label}</strong>
            </span>
            <span className="eac-scenario__value">
              {scenario.value === null
                ? "Not available"
                : formatCompactCurrency(scenario.value)}
            </span>
            <code>{scenario.formula}</code>
            <small>
              {scenario.unavailableReason ?? scenario.assumption}
            </small>
          </label>
        ))}
      </fieldset>

      <div className="eac-selection-summary">
        <div className="eac-selection-summary__lead">
          <Target size={22} aria-hidden="true" />
          <span>
            <small>Selected management basis</small>
            <strong>{selected?.label ?? "No available scenario"}</strong>
          </span>
        </div>
        <dl>
          <div>
            <dt>Management EAC</dt>
            <dd>{formatCurrency(metrics.managementEac)}</dd>
          </div>
          <div>
            <dt>VAC</dt>
            <dd className={metrics.vac < 0 ? "number--adverse" : undefined}>
              {formatCurrency(metrics.vac)}
            </dd>
          </div>
          <div>
            <dt>TCPI to BAC</dt>
            <dd>{formatIndex(metrics.tcpiBac)}</dd>
            <small>
              {metrics.tcpiBac === null
                ? "Unavailable: BAC is not above actual cost."
                : "Efficiency required to recover the approved BAC."}
            </small>
          </div>
          <div>
            <dt>TCPI to selected EAC</dt>
            <dd>{formatIndex(metrics.tcpiEac)}</dd>
            <small>
              {metrics.tcpiEac === null
                ? "Unavailable: selected EAC is not above actual cost."
                : "Efficiency required over the remaining forecast."}
            </small>
          </div>
        </dl>
      </div>
    </section>
  );
}
