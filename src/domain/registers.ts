import { z } from "zod";
import { strictIsoDateSchema } from "../schemas/fields";
import { missingChangeControlFields } from "./changes";
import { riskRating, riskToleranceForObjective } from "./risks";
import type { ChangeRequest, Milestone, Risk } from "./types";

const identifier = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .min(2, "An identifier is required.")
      .max(30)
      .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Use letters, numbers and single hyphens."),
  );
const shortText = (label: string) =>
  z.string().trim().min(2, `${label} is required.`).max(120);
const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(120).optional(),
);
const optionalDetailedText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(1_000).optional(),
);
const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  strictIsoDateSchema.optional(),
);

export const milestoneInputSchema = z
  .object({
    id: identifier,
    name: shortText("Milestone name"),
    wbsId: identifier,
    owner: shortText("Owner").pipe(z.string().max(80)),
    baselineDate: strictIsoDateSchema,
    previousForecastDate: strictIsoDateSchema,
    forecastDate: strictIsoDateSchema,
    actualDate: optionalDate,
    status: z.enum([
      "complete-on-time",
      "complete-late",
      "on-track",
      "forecast-late",
      "overdue",
      "data-issue",
    ]),
    commentary: z
      .string()
      .trim()
      .min(10, "Control commentary must contain at least 10 characters.")
      .max(500),
  })
  .strict()
  .superRefine((record, context) => {
    const isComplete = record.status.startsWith("complete-");
    if (isComplete && record.actualDate === undefined) {
      context.addIssue({
        code: "custom",
        path: ["actualDate"],
        message: "A completed milestone requires an actual date.",
      });
    }
    if (!isComplete && record.actualDate !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["actualDate"],
        message: "Use a completed status when an actual date is supplied.",
      });
    }
  })
  .transform((value) => value as Milestone);

export { riskRating } from "./risks";

export const riskInputSchema = z
  .object({
    id: identifier,
    title: shortText("Risk title"),
    owner: shortText("Owner").pipe(z.string().max(80)),
    wbsId: identifier,
    category: shortText("Category").pipe(z.string().max(60)),
    status: z.enum(["active", "closed"]),
    objective: z.enum([
      "safety-quality",
      "schedule",
      "cost",
      "operational-readiness",
    ]),
    condition: z.string().trim().min(10).max(500),
    event: z.string().trim().min(10).max(500),
    consequence: z.string().trim().min(10).max(500),
    inherentProbability: z.coerce.number().int().min(1).max(5),
    inherentImpact: z.coerce.number().int().min(1).max(5),
    previousResidualProbability: z.coerce.number().int().min(1).max(5),
    previousResidualImpact: z.coerce.number().int().min(1).max(5),
    residualProbability: z.coerce.number().int().min(1).max(5),
    residualImpact: z.coerce.number().int().min(1).max(5),
    treatment: z
      .string()
      .trim()
      .min(10, "Treatment action must contain at least 10 characters.")
      .max(500),
    treatmentDue: strictIsoDateSchema,
    reviewDate: strictIsoDateSchema,
    triggerDescription: z.string().trim().min(10).max(500),
    triggerStatus: z.enum(["clear", "watch", "breached"]),
    controlDescription: z.string().trim().min(10).max(500),
    controlOwner: shortText("Control owner").pipe(z.string().max(80)),
    controlEvidence: shortText("Control evidence").pipe(z.string().max(120)),
    controlTestDate: strictIsoDateSchema,
    controlEffectiveness: z.enum([
      "effective",
      "partly-effective",
      "ineffective",
      "not-tested",
    ]),
    disposition: z.enum(["within-tolerance", "escalated", "accepted"]),
    escalationOwner: optionalText,
    escalationDate: optionalDate,
    acceptanceAuthority: optionalText,
    acceptanceRationale: optionalDetailedText,
    acceptanceReviewDate: optionalDate,
  })
  .strict()
  .superRefine((record, context) => {
    const residualScore = record.residualProbability * record.residualImpact;
    const aboveTolerance =
      residualScore > riskToleranceForObjective(record.objective);

    if (aboveTolerance && record.disposition === "within-tolerance") {
      context.addIssue({
        code: "custom",
        path: ["disposition"],
        message:
          "A risk above tolerance must be escalated or formally accepted.",
      });
    }
    if (
      record.disposition === "escalated" &&
      (!record.escalationOwner || !record.escalationDate)
    ) {
      context.addIssue({
        code: "custom",
        path: ["escalationOwner"],
        message: "Escalation requires a named owner and escalation date.",
      });
    }
    if (record.disposition === "accepted") {
      for (const [field, value] of [
        ["acceptanceAuthority", record.acceptanceAuthority],
        ["acceptanceRationale", record.acceptanceRationale],
        ["acceptanceReviewDate", record.acceptanceReviewDate],
      ] as const) {
        if (!value) {
          context.addIssue({
            code: "custom",
            path: [field],
            message:
              "Formal acceptance requires authority, rationale and a review date.",
          });
        }
      }
    }
  })
  .transform((value): Risk => {
    const inherentScore = value.inherentProbability * value.inherentImpact;
    const residualScore = value.residualProbability * value.residualImpact;
    return {
      ...value,
      inherentScore,
      inherentRating: riskRating(inherentScore),
      residualScore,
      rating: riskRating(residualScore),
    };
  });

export const changeInputSchema = z
  .object({
    id: identifier,
    title: shortText("Change title"),
    reason: optionalDetailedText,
    requester: optionalText,
    wbsId: identifier,
    scopeDescription: optionalDetailedText,
    costImpact: z.coerce.number().finite().min(-1_000_000_000).max(1_000_000_000),
    scheduleImpactDays: z.coerce.number().int().min(-3_650).max(3_650),
    technicalQualityImpact: optionalDetailedText,
    riskImpact: optionalDetailedText,
    benefit: optionalDetailedText,
    assumptions: optionalDetailedText,
    alternatives: optionalDetailedText,
    recommendation: optionalDetailedText,
    decisionDue: strictIsoDateSchema,
    status: z.enum([
      "draft",
      "submitted",
      "approved",
      "rejected",
      "implemented",
      "withdrawn",
    ]),
    submittedDate: optionalDate,
    decisionAuthority: optionalText,
    approver: optionalText,
    decisionDate: optionalDate,
    decisionRationale: optionalDetailedText,
    evidenceReference: optionalText,
    effectiveDate: optionalDate,
    incorporatedBaselineVersion: optionalText,
    rebaselineJustification: optionalDetailedText,
    preventionCorrectiveMeasures: optionalDetailedText,
  })
  .strict()
  .superRefine((record, context) => {
    const missingFields = missingChangeControlFields(record as ChangeRequest);
    for (const field of missingFields) {
      context.addIssue({
        code: "custom",
        path: [field],
        message:
          record.status === "implemented" &&
          ["effectiveDate", "incorporatedBaselineVersion", "rebaselineJustification", "preventionCorrectiveMeasures"].includes(field)
            ? "Implementation requires an effective date, incorporated baseline and rebaseline evidence."
            : ["approver", "decisionDate", "decisionRationale"].includes(field)
              ? "An approver, decision date and rationale are required for this decision."
              : "Complete every submission impact and authority field before leaving draft.",
      });
    }
    if (
      record.incorporatedBaselineVersion !== undefined &&
      record.status !== "implemented"
    ) {
      context.addIssue({
        code: "custom",
        path: ["incorporatedBaselineVersion"],
        message: "Only an implemented change may identify an incorporated baseline.",
      });
    }
    if (
      record.submittedDate !== undefined &&
      record.decisionDate !== undefined &&
      record.decisionDate < record.submittedDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["decisionDate"],
        message: "Decision date cannot be before the submitted date.",
      });
    }
    if (
      record.decisionDate !== undefined &&
      record.effectiveDate !== undefined &&
      record.effectiveDate < record.decisionDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["effectiveDate"],
        message: "Effective date cannot be before the decision date.",
      });
    }
  })
  .transform(
    (value): ChangeRequest => ({
      ...value,
      incorporatedBaselineVersion:
        value.incorporatedBaselineVersion?.toUpperCase(),
      decisionHistory: [],
    }),
  );

export const firstRegisterError = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Check the entered values and try again.";

export const registerErrorSummary = (error: z.ZodError) =>
  [...new Set(error.issues.map(({ message }) => message))].join(" ") ||
  "Check the entered values and try again.";
