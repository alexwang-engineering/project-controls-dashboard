declare const domainBrand: unique symbol;

export type BrandedString<Name extends string> = string & {
  readonly [domainBrand]: Name;
};

export type ProjectId = BrandedString<"ProjectId">;
export type BaselineVersion = BrandedString<"BaselineVersion">;
export type ActivityId = BrandedString<"ActivityId">;
export type WorkPackageId = BrandedString<"WorkPackageId">;
export type CalendarId = BrandedString<"CalendarId">;
export type IsoDate = BrandedString<"IsoDate">;
export type Pence = number & { readonly [domainBrand]: "Pence" };

export type LinkType = "FS" | "SS" | "FF" | "SF";
export type ConstraintType =
  | "none"
  | "start-no-earlier-than"
  | "finish-no-later-than"
  | "must-start-on"
  | "must-finish-on";

export interface PredecessorLink {
  activityId: ActivityId;
  type: LinkType;
  lagDays: number;
}

export interface NormalisedActivity {
  projectId: ProjectId;
  baselineVersion: BaselineVersion;
  activityId: ActivityId;
  wbsId: WorkPackageId;
  activityName: string;
  owner: string;
  baselineStart: IsoDate;
  baselineFinish: IsoDate;
  forecastStart: IsoDate;
  forecastFinish: IsoDate;
  actualStart?: IsoDate;
  actualFinish?: IsoDate;
  predecessorLinks: readonly PredecessorLink[];
  calendarId: CalendarId;
  constraintType: ConstraintType;
  constraintDate?: IsoDate;
  isMilestone: boolean;
  baselineBudget: Pence;
  progressMethod: "percent_complete";
  commentary: string;
}

export interface PerformanceRecord {
  projectId: ProjectId;
  baselineVersion: BaselineVersion;
  periodEnd: IsoDate;
  activityId: ActivityId;
  pvPeriod: Pence;
  evPeriod: Pence;
  acPeriod: Pence;
  physicalPercentComplete: number;
  remainingCostForecast?: Pence;
  progressCommentary: string;
}

export interface RecordSource {
  fileName: string;
  recordNumber: number;
  physicalLineStart?: number;
}

export interface SourcedRecord<Value> {
  value: Value;
  source: RecordSource;
}

export type ProjectConfigurationSource = "proposed" | "active";

export interface ProjectConfigurationInput {
  source: ProjectConfigurationSource;
  projectId: ProjectId;
  workPackageIds: readonly WorkPackageId[];
  calendarIds: readonly CalendarId[];
  authorisedStartActivityIds: readonly ActivityId[];
  authorisedFinishActivityIds: readonly ActivityId[];
}
