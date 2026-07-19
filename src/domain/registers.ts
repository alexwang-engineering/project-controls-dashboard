import { z } from "zod";
import { strictIsoDateSchema } from "../schemas/fields";
import type { ChangeRequest, Milestone, Risk, RiskRating } from "./types";

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

export const riskRating = (score: number): RiskRating => {
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "moderate";
  return "low";
};

export const riskInputSchema = z
  .object({
    id: identifier,
    title: shortText("Risk title"),
    owner: shortText("Owner").pipe(z.string().max(80)),
    wbsId: identifier,
    category: shortText("Category").pipe(z.string().max(60)),
    residualProbability: z.coerce.number().int().min(1).max(5),
    residualImpact: z.coerce.number().int().min(1).max(5),
    treatment: z
      .string()
      .trim()
      .min(10, "Treatment action must contain at least 10 characters.")
      .max(500),
    treatmentDue: strictIsoDateSchema,
    triggerStatus: z.enum(["clear", "watch", "breached"]),
    controlEffectiveness: z.enum([
      "effective",
      "partly-effective",
      "ineffective",
    ]),
  })
  .strict()
  .transform((value): Risk => {
    const residualScore = value.residualProbability * value.residualImpact;
    return { ...value, residualScore, rating: riskRating(residualScore) };
  });

export const changeInputSchema = z
  .object({
    id: identifier,
    title: shortText("Change title"),
    wbsId: identifier,
    status: z.enum([
      "draft",
      "submitted",
      "approved",
      "rejected",
      "implemented",
      "withdrawn",
    ]),
    costImpact: z.coerce.number().finite().min(-1_000_000_000).max(1_000_000_000),
    scheduleImpactDays: z.coerce.number().int().min(-3_650).max(3_650),
    decisionDue: strictIsoDateSchema,
    incorporatedBaselineVersion: optionalText,
  })
  .strict()
  .superRefine((record, context) => {
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
  })
  .transform(
    (value): ChangeRequest => ({
      ...value,
      incorporatedBaselineVersion:
        value.incorporatedBaselineVersion?.toUpperCase(),
    }),
  );

export const firstRegisterError = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Check the entered values and try again.";
