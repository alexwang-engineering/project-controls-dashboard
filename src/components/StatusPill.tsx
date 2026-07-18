import type { ReactNode } from "react";
import type { MetricStatus } from "../domain/types";

interface StatusPillProps {
  status: MetricStatus;
  children: ReactNode;
}

export function StatusPill({ status, children }: StatusPillProps) {
  return (
    <span className={"status-pill status-pill--" + status}>
      <span className="status-pill__marker" aria-hidden="true" />
      {children}
    </span>
  );
}
