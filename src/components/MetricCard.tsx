import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { MetricStatus } from "../domain/types";
import { StatusPill } from "./StatusPill";

interface MetricCardProps {
  label: string;
  value: string;
  status: MetricStatus;
  statusLabel: string;
  detail: string;
  delta?: string;
}

const statusIcon = {
  positive: ArrowUpRight,
  attention: Minus,
  adverse: ArrowDownRight,
  neutral: Minus,
};

export function MetricCard({
  label,
  value,
  status,
  statusLabel,
  detail,
  delta,
}: MetricCardProps) {
  const Icon = statusIcon[status];

  return (
    <article className={"metric-card metric-card--" + status}>
      <div className="metric-card__topline">
        <p className="metric-card__label">{label}</p>
        <Icon size={17} aria-hidden="true" />
      </div>
      <p className="metric-card__value">{value}</p>
      <div className="metric-card__status">
        <StatusPill status={status}>{statusLabel}</StatusPill>
        {delta ? <span className="metric-card__delta">{delta}</span> : null}
      </div>
      <p className="metric-card__detail">{detail}</p>
    </article>
  );
}
