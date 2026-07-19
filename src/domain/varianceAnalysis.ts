import Decimal from "decimal.js";
import { z } from "zod";
import { strictIsoDateSchema } from "../schemas/fields";
import type { EarnedValueResult } from "./calculations/earnedValue";
import type { EacScenarioId } from "./calculations/eacScenarios";

export const varianceMetricSchema = z.enum(["SPI", "CPI", "VAC"]);
export type VarianceMetric = z.infer<typeof varianceMetricSchema>;

export const varianceWorkflowStatusSchema = z.enum([
  "open",
  "monitoring",
  "closed",
]);
export type VarianceWorkflowStatus = z.infer<
  typeof varianceWorkflowStatusSchema
>;

const draftText = (maximum: number) => z.string().trim().max(maximum);

export const varianceAnalysisDetailsDraftSchema = z
  .object({
    rootCause: draftText(1_000),
    dependencyImpact: draftText(1_000),
    milestoneImpact: draftText(1_000),
    criticalPathImpact: draftText(1_000),
    costEacEffect: draftText(1_000),
    correctiveAction: draftText(1_000),
    owner: draftText(80),
    dueDate: draftText(10),
    recoveryEvidence: draftText(1_000),
    expectedRecoveryPeriod: draftText(10),
    status: varianceWorkflowStatusSchema,
    author: draftText(80),
  })
  .strict();

const requiredNarrative = (label: string) =>
  z.string().trim().min(10, `${label} must contain at least 10 characters.`).max(1_000);

export const varianceAnalysisDetailsSchema = z
  .object({
    rootCause: requiredNarrative("Root cause"),
    dependencyImpact: requiredNarrative("Dependency impact"),
    milestoneImpact: requiredNarrative("Milestone impact"),
    criticalPathImpact: requiredNarrative("Critical-path impact"),
    costEacEffect: requiredNarrative("Cost and EAC effect"),
    correctiveAction: requiredNarrative("Corrective action"),
    owner: z.string().trim().min(2, "Owner is required.").max(80),
    dueDate: strictIsoDateSchema,
    recoveryEvidence: requiredNarrative("Recovery evidence"),
    expectedRecoveryPeriod: strictIsoDateSchema,
    status: varianceWorkflowStatusSchema,
    author: z.string().trim().min(2, "Author is required.").max(80),
  })
  .strict();

export type VarianceAnalysisDetails = z.infer<
  typeof varianceAnalysisDetailsDraftSchema
>;

export const emptyVarianceAnalysisDetails: VarianceAnalysisDetails = {
  rootCause: "",
  dependencyImpact: "",
  milestoneImpact: "",
  criticalPathImpact: "",
  costEacEffect: "",
  correctiveAction: "",
  owner: "",
  dueDate: "",
  recoveryEvidence: "",
  expectedRecoveryPeriod: "",
  status: "open",
  author: "",
};

const signedPence = z.number().int().safe();
const nonnegativePence = signedPence.nonnegative();
const nullableRatio = z.number().finite().nullable();

export const varianceFactSnapshotSchema = z
  .object({
    bacPence: nonnegativePence,
    pvPence: nonnegativePence,
    evPence: nonnegativePence,
    acPence: nonnegativePence,
    svPence: signedPence,
    cvPence: signedPence,
    spi: nullableRatio,
    cpi: nullableRatio,
    managementEacPence: nonnegativePence,
    vacPence: signedPence,
    tcpiBac: nullableRatio,
    tcpiEac: nullableRatio,
  })
  .strict();

export type VarianceFactSnapshot = z.infer<typeof varianceFactSnapshotSchema>;

export const varianceAnalysisRecordSchema = z
  .object({
    recordId: z.string().min(1).max(600),
    recordType: z.enum(["draft", "signed"]),
    contextKey: z.string().min(1).max(500),
    projectId: z.string().min(1).max(100),
    baselineVersion: z.string().min(1).max(100),
    scopeType: z.enum(["project", "work-package"]),
    scopeId: z.string().min(1).max(100),
    reportingPeriod: strictIsoDateSchema,
    sourceImportId: z.string().min(1).max(100),
    managementScenario: z.enum(["budget-rate", "cpi", "composite"]),
    breachedMetrics: z.array(varianceMetricSchema).min(1).max(3),
    facts: varianceFactSnapshotSchema,
    factFingerprint: z.string().min(1).max(5_000),
    details: varianceAnalysisDetailsDraftSchema,
    revision: z.number().int().positive().optional(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    signedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.recordType === "draft") {
      if (record.revision !== undefined || record.signedAt !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["recordType"],
          message: "A draft cannot carry a signed revision or sign-off date.",
        });
      }
      return;
    }
    if (record.revision === undefined || record.signedAt === undefined) {
      context.addIssue({
        code: "custom",
        path: ["recordType"],
        message: "A signed analysis requires a revision and sign-off date.",
      });
    }
    const complete = varianceAnalysisDetailsSchema.safeParse(record.details);
    if (!complete.success) {
      context.addIssue({
        code: "custom",
        path: ["details"],
        message: "A signed analysis must contain every required field.",
      });
    }
  });

export type VarianceAnalysisRecord = z.infer<
  typeof varianceAnalysisRecordSchema
>;

export interface VarianceAnalysisContext {
  contextKey: string;
  projectId: string;
  baselineVersion: string;
  scopeType: "project" | "work-package";
  scopeId: string;
  reportingPeriod: string;
  sourceImportId: string;
  expectedActiveImportId: string | null;
  managementScenario: EacScenarioId;
  breachedMetrics: readonly VarianceMetric[];
  facts: VarianceFactSnapshot;
  factFingerprint: string;
}

const toPence = (amount: number) =>
  new Decimal(amount)
    .times(100)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();

export function determineVarianceBreaches(
  metrics: Pick<EarnedValueResult, "spi" | "cpi" | "vac">,
): readonly VarianceMetric[] {
  const breaches: VarianceMetric[] = [];
  if (metrics.spi !== null && metrics.spi < 0.98) breaches.push("SPI");
  if (metrics.cpi !== null && metrics.cpi < 0.98) breaches.push("CPI");
  if (metrics.vac < 0) breaches.push("VAC");
  return breaches;
}

export function createVarianceAnalysisContext(input: {
  projectId: string;
  baselineVersion: string;
  scopeId: string;
  reportingPeriod: string;
  sourceImportId: string;
  expectedActiveImportId: string | null;
  managementScenario: EacScenarioId;
  metrics: EarnedValueResult;
}): VarianceAnalysisContext {
  const scopeType = input.scopeId === "all" ? "project" : "work-package";
  const facts = varianceFactSnapshotSchema.parse({
    bacPence: toPence(input.metrics.bac),
    pvPence: toPence(input.metrics.pv),
    evPence: toPence(input.metrics.ev),
    acPence: toPence(input.metrics.ac),
    svPence: toPence(input.metrics.sv),
    cvPence: toPence(input.metrics.cv),
    spi: input.metrics.spi,
    cpi: input.metrics.cpi,
    managementEacPence: toPence(input.metrics.managementEac),
    vacPence: toPence(input.metrics.vac),
    tcpiBac: input.metrics.tcpiBac,
    tcpiEac: input.metrics.tcpiEac,
  });
  const contextKey = [
    input.projectId,
    input.baselineVersion,
    scopeType,
    input.scopeId,
    input.reportingPeriod,
  ].join("|");
  const factFingerprint = JSON.stringify({
    managementScenario: input.managementScenario,
    facts,
  });

  return {
    contextKey,
    projectId: input.projectId,
    baselineVersion: input.baselineVersion,
    scopeType,
    scopeId: input.scopeId,
    reportingPeriod: input.reportingPeriod,
    sourceImportId: input.sourceImportId,
    expectedActiveImportId: input.expectedActiveImportId,
    managementScenario: input.managementScenario,
    breachedMetrics: determineVarianceBreaches(input.metrics),
    facts,
    factFingerprint,
  };
}

export type VarianceAnalysisValidationResult =
  | { success: true; data: z.infer<typeof varianceAnalysisDetailsSchema> }
  | {
      success: false;
      fieldErrors: Partial<Record<keyof VarianceAnalysisDetails, string>>;
    };

export function validateVarianceAnalysisForSignOff(
  details: VarianceAnalysisDetails,
  reportingPeriod: string,
): VarianceAnalysisValidationResult {
  const parsed = varianceAnalysisDetailsSchema.safeParse(details);
  const fieldErrors: Partial<Record<keyof VarianceAnalysisDetails, string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof VarianceAnalysisDetails | undefined;
      if (field !== undefined && fieldErrors[field] === undefined) {
        fieldErrors[field] = issue.message;
      }
    }
    return { success: false, fieldErrors };
  }
  if (parsed.data.dueDate < reportingPeriod) {
    fieldErrors.dueDate = "Due date must be on or after the reporting period.";
  }
  if (parsed.data.expectedRecoveryPeriod < reportingPeriod) {
    fieldErrors.expectedRecoveryPeriod =
      "Expected recovery period must be on or after the reporting period.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }
  return { success: true, data: parsed.data };
}
