import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { StatusPill } from "../../components/StatusPill";
import type {
  ManagementException,
  ManagementExceptionEvidence,
  ManagementExceptionHorizon,
  ManagementExceptionSeverity,
} from "../../domain/managementExceptions";
import { formatDate } from "../../utils/format";

const toneFor: Record<
  ManagementExceptionSeverity,
  "adverse" | "attention" | "neutral"
> = {
  recovery: "adverse",
  attention: "attention",
  monitor: "neutral",
};

const severityLabel: Record<ManagementExceptionSeverity, string> = {
  recovery: "Recovery",
  attention: "Attention",
  monitor: "Monitor",
};

const evidenceLabel: Record<ManagementExceptionEvidence, string> = {
  complete: "Evidence complete",
  incomplete: "Evidence incomplete",
  required: "Analysis required",
  "not-required": "No additional evidence",
};

const horizonContent: Record<
  ManagementExceptionHorizon,
  { eyebrow: string; title: string; empty: string }
> = {
  now: {
    eyebrow: "Act now",
    title: "Now",
    empty: "No recovery, overdue or seven-day control item.",
  },
  "this-period": {
    eyebrow: "Close this cycle",
    title: "This period",
    empty: "No additional item requires closure this reporting period.",
  },
  monitor: {
    eyebrow: "Maintain awareness",
    title: "Monitor",
    empty: "No lower-priority active item is recorded.",
  },
};

function ExceptionColumn({
  horizon,
  items,
}: {
  horizon: ManagementExceptionHorizon;
  items: readonly ManagementException[];
}) {
  const content = horizonContent[horizon];
  return (
    <article className={`management-queue__column management-queue__column--${horizon}`}>
      <header>
        <div>
          <p className="eyebrow">{content.eyebrow}</p>
          <h3>{content.title}</h3>
        </div>
        <span className="management-queue__count" aria-label={`${String(items.length)} items`}>
          {items.length}
        </span>
      </header>
      {items.length === 0 ? (
        <p className="management-queue__empty">{content.empty}</p>
      ) : (
        <ol className="management-queue__list">
          {items.map((item) => (
            <li className={`management-item management-item--${item.severity}`} key={item.id}>
              <div className="management-item__topline">
                <span>{item.kindLabel}</span>
                <StatusPill status={toneFor[item.severity]}>
                  {severityLabel[item.severity]}
                </StatusPill>
              </div>
              <strong>{item.title}</strong>
              <p>{item.reason}</p>
              <dl className="management-item__meta">
                <div><dt>Owner</dt><dd>{item.owner}</dd></div>
                <div><dt>Due</dt><dd>{item.dueDate ? formatDate(item.dueDate) : "This reporting cycle"}</dd></div>
                <div><dt>Control</dt><dd>{evidenceLabel[item.evidence]}</dd></div>
              </dl>
              <details className="management-item__why">
                <summary>Why this priority</summary>
                <p>{item.priorityReason}</p>
              </details>
              <Link className="management-item__link" to={item.route}>
                {item.cta} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function ManagementExceptionQueue({
  exceptions,
}: {
  exceptions: readonly ManagementException[];
}) {
  const groups = {
    now: exceptions.filter(({ horizon }) => horizon === "now"),
    "this-period": exceptions.filter(({ horizon }) => horizon === "this-period"),
    monitor: exceptions.filter(({ horizon }) => horizon === "monitor"),
  } as const;

  return (
    <section className="panel management-queue" aria-labelledby="management-queue-title">
      <div className="panel__header">
        <div>
          <p className="eyebrow">One reconciled control queue</p>
          <h2 id="management-queue-title">Management exceptions</h2>
          <p className="panel__description">
            Schedule, cost, milestone, risk and change records are ranked by severity, urgency, impact and evidence completeness—not by module order.
          </p>
        </div>
        <span className="reporting-period">{exceptions.length} active</span>
      </div>
      <div className="management-queue__columns">
        <ExceptionColumn horizon="now" items={groups.now} />
        <ExceptionColumn horizon="this-period" items={groups["this-period"]} />
        <ExceptionColumn horizon="monitor" items={groups.monitor} />
      </div>
    </section>
  );
}
