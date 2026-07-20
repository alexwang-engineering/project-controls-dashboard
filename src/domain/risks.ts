import type {
  Risk,
  RiskExposureBasis,
  RiskObjective,
  RiskRating,
  RiskTrend,
} from "./types";

export interface RiskExposure {
  probability: number;
  impact: number;
  score: number;
  rating: RiskRating;
}

export interface RiskExceptionFlags {
  aboveTolerance: boolean;
  treatmentOverdue: boolean;
  reviewOverdue: boolean;
  triggerBreached: boolean;
  controlConcern: boolean;
  escalationRequired: boolean;
}

const objectiveTolerance: Record<RiskObjective, number> = {
  "safety-quality": 4,
  schedule: 9,
  cost: 9,
  "operational-readiness": 9,
};

export const riskRating = (score: number): RiskRating => {
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "moderate";
  return "low";
};

export const riskToleranceForObjective = (objective?: RiskObjective): number =>
  objectiveTolerance[objective ?? "schedule"];

export const riskExposure = (
  risk: Risk,
  basis: RiskExposureBasis,
): RiskExposure => {
  const probability =
    basis === "inherent"
      ? (risk.inherentProbability ?? risk.residualProbability)
      : risk.residualProbability;
  const impact =
    basis === "inherent"
      ? (risk.inherentImpact ?? risk.residualImpact)
      : risk.residualImpact;
  const score = probability * impact;

  return { probability, impact, score, rating: riskRating(score) };
};

export const riskTrend = (risk: Risk): RiskTrend => {
  if (
    risk.previousResidualProbability === undefined ||
    risk.previousResidualImpact === undefined
  ) {
    return "not-recorded";
  }
  const previous =
    risk.previousResidualProbability * risk.previousResidualImpact;
  const current = risk.residualProbability * risk.residualImpact;
  if (current < previous) return "improving";
  if (current > previous) return "worsening";
  return "stable";
};

const isOverdue = (date: string | undefined, reportingDate: string): boolean =>
  Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(reportingDate) && date < reportingDate);

export const riskExceptionFlags = (
  risk: Risk,
  reportingDate: string,
): RiskExceptionFlags => {
  if (risk.status === "closed") {
    return {
      aboveTolerance: false,
      treatmentOverdue: false,
      reviewOverdue: false,
      triggerBreached: false,
      controlConcern: false,
      escalationRequired: false,
    };
  }

  const residualScore = riskExposure(risk, "residual").score;
  const aboveTolerance =
    residualScore > riskToleranceForObjective(risk.objective);
  const hasText = (value: string | undefined) => Boolean(value?.trim());
  const escalationEvidenceComplete =
    risk.disposition === "escalated"
      ? hasText(risk.escalationOwner) && hasText(risk.escalationDate)
      : risk.disposition === "accepted"
        ? hasText(risk.acceptanceAuthority) &&
          hasText(risk.acceptanceRationale) &&
          hasText(risk.acceptanceReviewDate)
        : false;

  return {
    aboveTolerance,
    treatmentOverdue: isOverdue(risk.treatmentDue, reportingDate),
    reviewOverdue: isOverdue(risk.reviewDate, reportingDate),
    triggerBreached: risk.triggerStatus === "breached",
    controlConcern:
      risk.controlEffectiveness === "ineffective" ||
      risk.controlEffectiveness === "not-tested",
    escalationRequired: aboveTolerance && !escalationEvidenceComplete,
  };
};
