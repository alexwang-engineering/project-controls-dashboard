export interface ControlViewDefinition {
  id: "executive" | "overdue" | "forecast" | "decisions" | "quality";
  label: string;
  description: string;
  pathname: string;
  parameters?: Readonly<Record<string, string>>;
}

export const controlViews: readonly ControlViewDefinition[] = [
  {
    id: "executive",
    label: "Executive position",
    description: "Management conclusion, primary indicators and ranked exceptions.",
    pathname: "/",
  },
  {
    id: "overdue",
    label: "Overdue actions",
    description: "Adverse milestone commitments and their recovery controls.",
    pathname: "/milestones",
    parameters: { filter: "exceptions" },
  },
  {
    id: "forecast",
    label: "Forecast threats",
    description: "Schedule and cost evidence behind the current finish forecast.",
    pathname: "/schedule-cost",
  },
  {
    id: "decisions",
    label: "Pending decisions",
    description: "Submitted changes and approved impacts awaiting baseline action.",
    pathname: "/changes",
    parameters: { view: "pending" },
  },
  {
    id: "quality",
    label: "Data-quality exceptions",
    description: "Import validation, schedule logic and evidence quality findings.",
    pathname: "/import",
  },
] as const;

export const controlRoute = ({
  pathname,
  parameters,
  scope,
  reportingDate,
}: {
  pathname: string;
  parameters?: Readonly<Record<string, string>>;
  scope: string;
  reportingDate?: string;
}) => {
  const search = new URLSearchParams(parameters);
  if (scope !== "all") search.set("scope", scope);
  if (reportingDate !== undefined && reportingDate !== "") {
    search.set("date", reportingDate);
  }
  const query = search.toString();
  return query === "" ? pathname : `${pathname}?${query}`;
};
