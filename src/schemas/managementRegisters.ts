import { z } from "zod";

const identifier = z.string().trim().min(2).max(80);
const text = z.string().max(1_000);
const optionalText = text.optional();
const isoDate = z.iso.date();
const optionalDate = isoDate.optional();

const milestoneSchema = z
  .object({
    id: identifier,
    name: z.string().min(2).max(120),
    wbsId: identifier,
    owner: z.string().min(2).max(80),
    baselineDate: isoDate,
    previousForecastDate: isoDate,
    forecastDate: isoDate,
    actualDate: optionalDate,
    status: z.enum([
      "complete-on-time",
      "complete-late",
      "on-track",
      "forecast-late",
      "overdue",
      "data-issue",
    ]),
    sourceActivityId: identifier.optional(),
    cause: optionalText,
    recoveryAction: optionalText,
    actionOwner: optionalText,
    actionDueDate: optionalDate,
    decisionRequired: optionalText,
    updatedAt: z.iso.datetime({ offset: true }).optional(),
    commentary: z.string().max(500),
  })
  .strict();

const riskSchema = z
  .object({
    id: identifier,
    title: z.string().min(2).max(120),
    owner: z.string().min(2).max(80),
    wbsId: identifier,
    category: z.string().min(2).max(60),
    status: z.enum(["active", "closed"]).optional(),
    objective: z
      .enum([
        "safety-quality",
        "schedule",
        "cost",
        "operational-readiness",
      ])
      .optional(),
    condition: optionalText,
    event: optionalText,
    consequence: optionalText,
    inherentProbability: z.number().int().min(1).max(5).optional(),
    inherentImpact: z.number().int().min(1).max(5).optional(),
    inherentScore: z.number().int().min(1).max(25).optional(),
    inherentRating: z.enum(["low", "moderate", "high", "critical"]).optional(),
    previousResidualProbability: z.number().int().min(1).max(5).optional(),
    previousResidualImpact: z.number().int().min(1).max(5).optional(),
    residualProbability: z.number().int().min(1).max(5),
    residualImpact: z.number().int().min(1).max(5),
    residualScore: z.number().int().min(1).max(25),
    rating: z.enum(["low", "moderate", "high", "critical"]),
    treatment: z.string().max(500),
    treatmentDue: isoDate,
    reviewDate: optionalDate,
    triggerDescription: optionalText,
    triggerStatus: z.enum(["clear", "watch", "breached"]),
    controlDescription: optionalText,
    controlOwner: optionalText,
    controlEvidence: optionalText,
    controlTestDate: optionalDate,
    controlEffectiveness: z.enum([
      "effective",
      "partly-effective",
      "ineffective",
      "not-tested",
    ]),
    disposition: z.enum(["within-tolerance", "escalated", "accepted"]).optional(),
    escalationOwner: optionalText,
    escalationDate: optionalDate,
    acceptanceAuthority: optionalText,
    acceptanceRationale: optionalText,
    acceptanceReviewDate: optionalDate,
  })
  .strict();

const changeDecisionHistorySchema = z
  .object({
    sequence: z.number().int().positive(),
    fromStatus: z.enum([
      "draft",
      "submitted",
      "approved",
      "rejected",
      "implemented",
      "withdrawn",
    ]),
    toStatus: z.enum([
      "draft",
      "submitted",
      "approved",
      "rejected",
      "implemented",
      "withdrawn",
    ]),
    actor: z.string().min(2).max(120),
    authority: z.string().min(2).max(120),
    date: isoDate,
    rationale: text,
    evidenceReference: text,
  })
  .strict();

const changeSchema = z
  .object({
    id: identifier,
    title: z.string().min(2).max(120),
    reason: optionalText,
    requester: optionalText,
    wbsId: identifier,
    scopeDescription: optionalText,
    costImpact: z.number().finite(),
    scheduleImpactDays: z.number().int(),
    technicalQualityImpact: optionalText,
    riskImpact: optionalText,
    benefit: optionalText,
    assumptions: optionalText,
    alternatives: optionalText,
    recommendation: optionalText,
    decisionDue: isoDate,
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
    decisionRationale: optionalText,
    evidenceReference: optionalText,
    effectiveDate: optionalDate,
    incorporatedBaselineVersion: optionalText,
    rebaselineJustification: optionalText,
    preventionCorrectiveMeasures: optionalText,
    decisionHistory: z.array(changeDecisionHistorySchema).max(1_000).optional(),
  })
  .strict();

export const managementRegisterSnapshotSchema = z
  .object({
    milestones: z.array(milestoneSchema).max(10_000),
    risks: z.array(riskSchema).max(10_000),
    changes: z.array(changeSchema).max(10_000),
  })
  .strict();
