import { z } from "zod";
import type { RiskObjective } from "./types";

export const riskObjectiveKeys = [
  "safety-quality",
  "schedule",
  "cost",
  "operational-readiness",
] as const satisfies readonly RiskObjective[];

export const riskAppetiteThresholdsSchema = z
  .object({
    "safety-quality": z.number().int().min(1).max(25),
    schedule: z.number().int().min(1).max(25),
    cost: z.number().int().min(1).max(25),
    "operational-readiness": z.number().int().min(1).max(25),
  })
  .strict();

export type RiskAppetiteThresholds = z.infer<
  typeof riskAppetiteThresholdsSchema
>;

export const defaultRiskAppetite: RiskAppetiteThresholds = {
  "safety-quality": 4,
  schedule: 9,
  cost: 9,
  "operational-readiness": 9,
};

export const riskAppetiteRevisionSchema = z
  .object({
    projectId: z.string().trim().min(2).max(80),
    revision: z.number().int().positive(),
    thresholds: riskAppetiteThresholdsSchema,
    changeReason: z
      .string()
      .trim()
      .min(10, "Change reason must contain at least 10 characters.")
      .max(500),
    authorisedBy: z
      .string()
      .trim()
      .min(2, "Authorising role or person is required.")
      .max(80),
    effectiveFrom: z.iso.date(),
    recordedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type RiskAppetiteRevision = z.infer<
  typeof riskAppetiteRevisionSchema
>;

export const riskObjectiveLabel: Record<RiskObjective, string> = {
  "safety-quality": "Safety / quality",
  schedule: "Schedule",
  cost: "Cost",
  "operational-readiness": "Operational readiness",
};
