import type { RawCsvRecord } from "../../domain/import/parseCsv";
import { proposeProjectConfiguration } from "../../domain/import/projectConfiguration";
import type {
  NormalisedActivity,
  PerformanceRecord,
  ProjectConfigurationInput,
  SourcedRecord,
} from "../../domain/records";
import {
  PERFORMANCE_CSV_HEADERS,
  performanceRowSchema,
} from "../../schemas/performanceCsv";
import {
  SCHEDULE_CSV_HEADERS,
  scheduleRowSchema,
} from "../../schemas/scheduleCsv";

export type ScheduleCsvRow = Record<
  (typeof SCHEDULE_CSV_HEADERS)[number],
  string
>;
export type PerformanceCsvRow = Record<
  (typeof PERFORMANCE_CSV_HEADERS)[number],
  string
>;

export const validScheduleRow = (
  overrides: Partial<ScheduleCsvRow> = {},
): ScheduleCsvRow => ({
  project_id: "ASTER",
  baseline_version: "B0",
  activity_id: "A-001",
  wbs_id: "WP100",
  activity_name: "Confirm design requirements",
  owner: "Design Lead",
  baseline_start: "2026-04-06",
  baseline_finish: "2026-04-10",
  forecast_start: "2026-04-06",
  forecast_finish: "2026-04-10",
  actual_start: "2026-04-06",
  actual_finish: "2026-04-10",
  predecessor_links: "",
  calendar_id: "CAL-5D",
  constraint_type: "none",
  constraint_date: "",
  is_milestone: "false",
  baseline_budget: "100000",
  progress_method: "percent_complete",
  commentary: "Accepted fixture record",
  ...overrides,
});

export const validPerformanceRow = (
  overrides: Partial<PerformanceCsvRow> = {},
): PerformanceCsvRow => ({
  project_id: "ASTER",
  baseline_version: "B0",
  period_end: "2026-04-12",
  activity_id: "A-001",
  pv_period: "25000",
  ev_period: "25000",
  ac_period: "24000",
  physical_percent_complete: "25",
  remaining_cost_forecast: "75000",
  progress_commentary: "First reporting period",
  ...overrides,
});

export const rawRecord = <Row extends Record<string, string>>(
  headers: readonly (keyof Row & string)[],
  row: Row,
  recordNumber = 2,
): RawCsvRecord => ({
  recordNumber,
  physicalLineStart: recordNumber,
  cells: headers.map((header) => row[header] ?? ""),
});

export const sourcedActivity = (
  overrides: Partial<ScheduleCsvRow> = {},
  recordNumber = 2,
): SourcedRecord<NormalisedActivity> => ({
  value: scheduleRowSchema.parse(validScheduleRow(overrides)),
  source: {
    fileName: "schedule.csv",
    recordNumber,
    physicalLineStart: recordNumber,
  },
});

export const sourcedPerformance = (
  overrides: Partial<PerformanceCsvRow> = {},
  recordNumber = 2,
): SourcedRecord<PerformanceRecord> => ({
  value: performanceRowSchema.parse(validPerformanceRow(overrides)),
  source: {
    fileName: "performance.csv",
    recordNumber,
    physicalLineStart: recordNumber,
  },
});

export const projectConfiguration = (
  activities: readonly SourcedRecord<NormalisedActivity>[],
  overrides: Partial<ProjectConfigurationInput> = {},
): ProjectConfigurationInput => {
  const proposed = proposeProjectConfiguration(activities);
  if (proposed === undefined) throw new Error("Test configuration needs an activity.");
  return { ...proposed, ...overrides };
};
