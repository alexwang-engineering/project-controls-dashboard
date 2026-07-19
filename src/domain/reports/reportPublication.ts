import { z } from "zod";
import type { VarianceAnalysisRecord } from "../varianceAnalysis";
import type { ChangeRequest, Milestone, Risk } from "../types";
import type { WeeklyReportSnapshot } from "./weeklyReport";

const draftText = (maximum: number) => z.string().trim().max(maximum);

export const reportNarrativeDraftSchema = z
  .object({
    author: draftText(80),
    managementSummary: draftText(2_000),
    decisionsRequired: draftText(1_500),
    nextPeriodFocus: draftText(1_500),
  })
  .strict();

const requiredText = (label: string, minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .min(minimum, `${label} must contain at least ${String(minimum)} characters.`)
    .max(maximum);

export const reportNarrativePublicationSchema = z
  .object({
    author: z.string().trim().min(2, "Author is required.").max(80),
    managementSummary: requiredText("Management summary", 30, 2_000),
    decisionsRequired: requiredText("Decisions required", 10, 1_500),
    nextPeriodFocus: requiredText("Next-period focus", 10, 1_500),
  })
  .strict();

export type WeeklyReportNarrative = z.infer<typeof reportNarrativeDraftSchema>;

export const emptyReportNarrative: WeeklyReportNarrative = {
  author: "",
  managementSummary: "",
  decisionsRequired: "",
  nextPeriodFocus: "",
};

export interface WeeklyReportSourceEvidence {
  activeImportId: string;
  signedAnalyses: readonly VarianceAnalysisRecord[];
  milestones: readonly Milestone[];
  risks: readonly Risk[];
  changes: readonly ChangeRequest[];
}

export interface WeeklyReportPublicationRecord {
  recordId: string;
  recordType: "draft" | "published";
  contextKey: string;
  projectId: string;
  baselineVersion: string;
  reportingPeriod: string;
  sourceImportId: string;
  sourceFingerprint: string;
  report: WeeklyReportSnapshot;
  sourceEvidence: WeeklyReportSourceEvidence;
  narrative: WeeklyReportNarrative;
  revision?: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

const canonicalise = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalise(entry)]),
    );
  }
  return value;
};

const compareIdentifier = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

const byId = <RecordType extends { id: string }>(
  values: readonly RecordType[],
) =>
  [...values].sort((left, right) => compareIdentifier(left.id, right.id));

const byRecordId = (values: readonly VarianceAnalysisRecord[]) =>
  [...values].sort((left, right) =>
    compareIdentifier(left.recordId, right.recordId),
  );

export const reportContextKey = (input: {
  projectId: string;
  baselineVersion: string;
  reportingPeriod: string;
}) => [input.projectId, input.baselineVersion, input.reportingPeriod].join("|");

export function buildReportSourceFingerprint(
  report: WeeklyReportSnapshot,
  evidence: WeeklyReportSourceEvidence,
) {
  const { generatedAt: _generatedAt, ...stableIdentity } = report.identity;
  return JSON.stringify(
    canonicalise({
      report: {
        ...report,
        identity: stableIdentity,
      },
      evidence: {
        activeImportId: evidence.activeImportId,
        signedAnalyses: byRecordId(evidence.signedAnalyses),
        milestones: byId(evidence.milestones),
        risks: byId(evidence.risks),
        changes: byId(evidence.changes),
      },
    }),
  );
}

export type ReportNarrativeValidationResult =
  | {
      success: true;
      data: z.infer<typeof reportNarrativePublicationSchema>;
    }
  | {
      success: false;
      fieldErrors: Partial<Record<keyof WeeklyReportNarrative, string>>;
    };

export function validateReportNarrativeForPublication(
  narrative: WeeklyReportNarrative,
): ReportNarrativeValidationResult {
  const parsed = reportNarrativePublicationSchema.safeParse(narrative);
  if (parsed.success) return { success: true, data: parsed.data };
  const fieldErrors: Partial<Record<keyof WeeklyReportNarrative, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof WeeklyReportNarrative | undefined;
    if (field !== undefined && fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }
  return { success: false, fieldErrors };
}
