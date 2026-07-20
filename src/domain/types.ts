export type MetricStatus = "positive" | "attention" | "adverse" | "neutral";

export interface ProjectIdentity {
  id: string;
  name: string;
  description: string;
  originalBac: number;
  baselineVersion: string;
  reportingDate: string;
  baselineFinish: string;
  forecastFinish: string;
  lastImportAt: string;
  importId: string;
  schemaVersion: string;
}

export interface TrendPoint {
  period: string;
  label: string;
  pv: number;
  ev: number;
  ac: number;
}

export interface WorkPackageSnapshot {
  id: string;
  name: string;
  owner: string;
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  forecastFinish: string;
}

export interface Activity {
  id: string;
  wbsId: string;
  name: string;
  owner: string;
  baselineStart: string;
  baselineFinish: string;
  forecastStart: string;
  forecastFinish: string;
  actualFinish?: string;
  predecessorIds: string[];
  isMilestone?: boolean;
  calendarId?: string;
  constraintType?:
    | "none"
    | "start-no-earlier-than"
    | "finish-no-later-than"
    | "must-start-on"
    | "must-finish-on";
  constraintDate?: string;
  baselineBudget: number;
  progressMethod: "percent_complete";
}

export type MilestoneStatus =
  | "complete-on-time"
  | "complete-late"
  | "on-track"
  | "forecast-late"
  | "overdue"
  | "data-issue";

export interface Milestone {
  id: string;
  name: string;
  wbsId: string;
  owner: string;
  baselineDate: string;
  previousForecastDate: string;
  forecastDate: string;
  actualDate?: string;
  status: MilestoneStatus;
  sourceActivityId?: string;
  cause?: string;
  recoveryAction?: string;
  actionOwner?: string;
  actionDueDate?: string;
  decisionRequired?: string;
  updatedAt?: string;
  commentary: string;
}

export type RiskRating = "low" | "moderate" | "high" | "critical";
export type RiskObjective =
  | "safety-quality"
  | "schedule"
  | "cost"
  | "operational-readiness";
export type RiskStatus = "active" | "closed";
export type RiskExposureBasis = "inherent" | "residual";
export type RiskControlEffectiveness =
  | "effective"
  | "partly-effective"
  | "ineffective"
  | "not-tested";
export type RiskDisposition = "within-tolerance" | "escalated" | "accepted";
export type RiskTrend = "improving" | "stable" | "worsening" | "not-recorded";

export interface Risk {
  id: string;
  title: string;
  owner: string;
  wbsId: string;
  category: string;
  status?: RiskStatus;
  objective?: RiskObjective;
  condition?: string;
  event?: string;
  consequence?: string;
  inherentProbability?: number;
  inherentImpact?: number;
  inherentScore?: number;
  inherentRating?: RiskRating;
  previousResidualProbability?: number;
  previousResidualImpact?: number;
  residualProbability: number;
  residualImpact: number;
  residualScore: number;
  rating: RiskRating;
  treatment: string;
  treatmentDue: string;
  reviewDate?: string;
  triggerDescription?: string;
  triggerStatus: "clear" | "watch" | "breached";
  controlDescription?: string;
  controlOwner?: string;
  controlEvidence?: string;
  controlTestDate?: string;
  controlEffectiveness: RiskControlEffectiveness;
  disposition?: RiskDisposition;
  escalationOwner?: string;
  escalationDate?: string;
  acceptanceAuthority?: string;
  acceptanceRationale?: string;
  acceptanceReviewDate?: string;
}

export type ChangeStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "implemented"
  | "withdrawn";

export interface ChangeDecisionHistoryEntry {
  sequence: number;
  fromStatus: ChangeStatus;
  toStatus: ChangeStatus;
  actor: string;
  authority: string;
  date: string;
  rationale: string;
  evidenceReference: string;
}

export interface ChangeRequest {
  id: string;
  title: string;
  reason?: string;
  requester?: string;
  wbsId: string;
  scopeDescription?: string;
  costImpact: number;
  scheduleImpactDays: number;
  technicalQualityImpact?: string;
  riskImpact?: string;
  benefit?: string;
  assumptions?: string;
  alternatives?: string;
  recommendation?: string;
  decisionDue: string;
  status: ChangeStatus;
  submittedDate?: string;
  decisionAuthority?: string;
  approver?: string;
  decisionDate?: string;
  decisionRationale?: string;
  evidenceReference?: string;
  effectiveDate?: string;
  incorporatedBaselineVersion?: string;
  rebaselineJustification?: string;
  preventionCorrectiveMeasures?: string;
  decisionHistory?: readonly ChangeDecisionHistoryEntry[];
}

export interface DemoSnapshot {
  project: ProjectIdentity;
  trend: TrendPoint[];
  workPackages: WorkPackageSnapshot[];
  activities: Activity[];
  milestones: Milestone[];
  risks: Risk[];
  changes: ChangeRequest[];
}
