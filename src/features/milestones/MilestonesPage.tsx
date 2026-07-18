import { differenceInCalendarDays, parseISO } from "date-fns";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import { demoSnapshot } from "../../data/demo";
import type { MetricStatus, MilestoneStatus } from "../../domain/types";
import { formatDate } from "../../utils/format";

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
  return (days > 0 ? "+" : "") + String(days) + (Math.abs(days) === 1 ? " day" : " days");
};

export function MilestonesPage() {
  const completed = demoSnapshot.milestones.filter((item) => item.actualDate).length;
  const late = demoSnapshot.milestones.filter(
    (item) => item.status === "forecast-late" || item.status === "overdue",
  ).length;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Schedule commitments"
        title="Milestone control"
        description="Baseline, forecast and actual dates with movement, ownership and explicit exception commentary."
      />

      <section className="summary-strip" aria-label="Milestone summary">
        <div><span>Total milestones</span><strong>{demoSnapshot.milestones.length}</strong></div>
        <div><span>Completed</span><strong>{completed}</strong></div>
        <div><span>Forecast late</span><strong>{late}</strong></div>
        <div><span>Next commitment</span><strong>28 Jun 2026</strong></div>
      </section>

      <section className="panel" aria-labelledby="milestone-register-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Controlled register</p>
            <h2 id="milestone-register-title">Milestone position</h2>
            <p className="panel__description">
              Forecast movement is measured against the approved B0 baseline.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Project milestone register</caption>
            <thead>
              <tr>
                <th scope="col">Milestone</th>
                <th scope="col">Owner</th>
                <th scope="col">Baseline</th>
                <th scope="col">Forecast / actual</th>
                <th scope="col">Variance</th>
                <th scope="col">Status</th>
                <th scope="col">Control commentary</th>
              </tr>
            </thead>
            <tbody>
              {demoSnapshot.milestones.map((milestone) => {
                const presentation = statusPresentation[milestone.status];
                const outcomeDate = milestone.actualDate ?? milestone.forecastDate;
                const variance = differenceInCalendarDays(
                  parseISO(outcomeDate),
                  parseISO(milestone.baselineDate),
                );

                return (
                  <tr key={milestone.id}>
                    <th scope="row">
                      <span className="table-primary">{milestone.name}</span>
                      <span className="table-secondary">
                        {milestone.id + " · " + milestone.wbsId}
                      </span>
                    </th>
                    <td>{milestone.owner}</td>
                    <td>{formatDate(milestone.baselineDate)}</td>
                    <td>
                      <span className="table-primary">{formatDate(outcomeDate)}</span>
                      <span className="table-secondary">
                        {milestone.actualDate ? "Actual" : "Current forecast"}
                      </span>
                    </td>
                    <td className={variance > 0 ? "number--adverse" : undefined}>
                      {signedDays(variance)}
                    </td>
                    <td>
                      <StatusPill status={presentation.tone}>
                        {presentation.label}
                      </StatusPill>
                    </td>
                    <td className="commentary-cell">{milestone.commentary}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
