import {
  buildReportSourceFingerprint,
  reportContextKey,
  reportNarrativeDraftSchema,
  validateReportNarrativeForPublication,
  type WeeklyReportNarrative,
  type WeeklyReportPublicationRecord,
  type WeeklyReportSourceEvidence,
} from "../domain/reports/reportPublication";
import { z } from "zod";
import type { WeeklyReportSnapshot } from "../domain/reports/weeklyReport";
import { ProjectControlsDb } from "./db";

export class StaleReportSourceError extends Error {
  constructor() {
    super("The active generation changed after this report was prepared; refresh before saving or publishing.");
    this.name = "StaleReportSourceError";
  }
}

export class ReportDraftNotCurrentError extends Error {
  constructor() {
    super("Save the current report facts and narrative as a draft before publication.");
    this.name = "ReportDraftNotCurrentError";
  }
}

export class ReportPublicationBlockedError extends Error {
  constructor(message = "The report controls or management narrative are incomplete.") {
    super(message);
    this.name = "ReportPublicationBlockedError";
  }
}

export interface ReportPublicationInput {
  report: WeeklyReportSnapshot;
  evidence: WeeklyReportSourceEvidence;
  sourceFingerprint: string;
  narrative: WeeklyReportNarrative;
}

export interface SaveReportDraftInput extends ReportPublicationInput {
  savedAt: string;
}

export interface PublishReportInput extends ReportPublicationInput {
  publishedAt: string;
}

export interface ReportPublicationQuery {
  projectId: string;
  baselineVersion: string;
  reportingPeriod: string;
  sourceImportId: string;
}

export interface ReportPublicationContextState {
  currentDraft?: WeeklyReportPublicationRecord;
  publishedRevisions: readonly WeeklyReportPublicationRecord[];
  retainedDraftCount: number;
}

const draftRecordId = (contextKey: string, sourceImportId: string) =>
  `REPORT-DRAFT::${contextKey}::${sourceImportId}`;

const publishedRecordId = (contextKey: string, revision: number) =>
  `REPORT-PUBLISHED::${contextKey}::${String(revision)}`;

const assertActivePointer = (
  actual: string | undefined,
  expected: string,
) => {
  if ((actual ?? null) !== expected) throw new StaleReportSourceError();
};

const assertFingerprint = (input: ReportPublicationInput) => {
  const recomputed = buildReportSourceFingerprint(input.report, input.evidence);
  if (recomputed !== input.sourceFingerprint) throw new ReportDraftNotCurrentError();
};

const parseTimestamp = (value: string) =>
  z.iso.datetime({ offset: true }).parse(value);

const assertStoredRecord = (record: WeeklyReportPublicationRecord) => {
  reportNarrativeDraftSchema.parse(record.narrative);
  if (
    record.contextKey !== reportContextKey(record.report.identity) ||
    record.projectId !== record.report.identity.projectId ||
    record.baselineVersion !== record.report.identity.baselineVersion ||
    record.reportingPeriod !== record.report.identity.reportingPeriod ||
    record.sourceImportId !== record.report.identity.sourceImportId ||
    record.sourceFingerprint !==
      buildReportSourceFingerprint(record.report, record.sourceEvidence)
  ) {
    throw new Error("A stored report record failed its source-integrity check.");
  }
  parseTimestamp(record.createdAt);
  parseTimestamp(record.updatedAt);
  if (record.recordType === "draft") {
    if (record.revision !== undefined || record.publishedAt !== undefined) {
      throw new Error("A stored report draft carries publication metadata.");
    }
    return record;
  }
  if (
    record.revision === undefined ||
    record.revision < 1 ||
    record.publishedAt === undefined ||
    !record.report.canPublish ||
    !validateReportNarrativeForPublication(record.narrative).success
  ) {
    throw new Error("A stored published report failed its publication-integrity check.");
  }
  parseTimestamp(record.publishedAt);
  return record;
};

const commonRecord = (
  input: ReportPublicationInput,
  narrative: WeeklyReportNarrative,
) => {
  const { identity } = input.report;
  return {
    contextKey: reportContextKey(identity),
    projectId: identity.projectId,
    baselineVersion: identity.baselineVersion,
    reportingPeriod: identity.reportingPeriod,
    sourceImportId: identity.sourceImportId,
    sourceFingerprint: input.sourceFingerprint,
    report: input.report,
    sourceEvidence: input.evidence,
    narrative,
  };
};

export class ReportPublicationRepository {
  constructor(private readonly db: ProjectControlsDb) {}

  loadContext(
    query: ReportPublicationQuery,
  ): Promise<ReportPublicationContextState> {
    const contextKey = reportContextKey(query);
    return this.db.reportPublications
      .where("contextKey")
      .equals(contextKey)
      .toArray()
      .then((records) => {
        records.forEach(assertStoredRecord);
        const publishedRevisions = records
          .filter(({ recordType }) => recordType === "published")
          .sort((left, right) => (right.revision ?? 0) - (left.revision ?? 0));
        const drafts = records.filter(({ recordType }) => recordType === "draft");
        return {
          currentDraft: drafts.find(
            ({ sourceImportId }) => sourceImportId === query.sourceImportId,
          ),
          publishedRevisions,
          retainedDraftCount: drafts.filter(
            ({ sourceImportId }) => sourceImportId !== query.sourceImportId,
          ).length,
        };
      });
  }

  async saveDraft(
    input: SaveReportDraftInput,
  ): Promise<WeeklyReportPublicationRecord> {
    assertFingerprint(input);
    parseTimestamp(input.savedAt);
    const narrative = reportNarrativeDraftSchema.parse(input.narrative);
    const contextKey = reportContextKey(input.report.identity);
    const recordId = draftRecordId(contextKey, input.report.identity.sourceImportId);
    let savedRecord: WeeklyReportPublicationRecord | undefined;

    return this.db
      .transaction("rw", [this.db.meta, this.db.reportPublications], () =>
        this.db.meta
          .get("activeImportId")
          .then((pointer) => {
            assertActivePointer(pointer?.value, input.evidence.activeImportId);
            return this.db.reportPublications.get(recordId);
          })
          .then((existing) => {
            savedRecord = {
              recordId,
              recordType: "draft",
              ...commonRecord(input, narrative),
              createdAt: existing?.createdAt ?? input.savedAt,
              updatedAt: input.savedAt,
            };
            return this.db.reportPublications.put(savedRecord);
          }),
      )
      .then(() => {
        if (savedRecord === undefined) {
          throw new Error("Report draft transaction completed without a record.");
        }
        return savedRecord;
      });
  }

  async publish(
    input: PublishReportInput,
  ): Promise<WeeklyReportPublicationRecord> {
    if (!input.report.canPublish) throw new ReportPublicationBlockedError();
    assertFingerprint(input);
    parseTimestamp(input.publishedAt);
    const completeNarrative = validateReportNarrativeForPublication(input.narrative);
    if (!completeNarrative.success) throw new ReportPublicationBlockedError();
    const contextKey = reportContextKey(input.report.identity);
    const currentDraftId = draftRecordId(
      contextKey,
      input.report.identity.sourceImportId,
    );
    let publishedRecord: WeeklyReportPublicationRecord | undefined;
    let draftCreatedAt = input.publishedAt;

    return this.db
      .transaction("rw", [this.db.meta, this.db.reportPublications], () =>
        this.db.meta
          .get("activeImportId")
          .then((pointer) => {
            assertActivePointer(pointer?.value, input.evidence.activeImportId);
            return this.db.reportPublications.get(currentDraftId);
          })
          .then((draft) => {
            if (
              draft === undefined ||
              draft.sourceFingerprint !== input.sourceFingerprint ||
              JSON.stringify(draft.narrative) !==
                JSON.stringify(completeNarrative.data)
            ) {
              throw new ReportDraftNotCurrentError();
            }
            draftCreatedAt = draft.createdAt;
            return this.db.reportPublications
              .where("[contextKey+recordType]")
              .equals([contextKey, "published"])
              .toArray();
          })
          .then((history) => {
            const revision =
              history.reduce(
                (highest, record) => Math.max(highest, record.revision ?? 0),
                0,
              ) + 1;
            publishedRecord = {
              recordId: publishedRecordId(contextKey, revision),
              recordType: "published",
              ...commonRecord(input, completeNarrative.data),
              revision,
              createdAt: draftCreatedAt,
              updatedAt: input.publishedAt,
              publishedAt: input.publishedAt,
            };
            return this.db.reportPublications
              .add(publishedRecord)
              .then(() => this.db.reportPublications.delete(currentDraftId));
          }),
      )
      .then(() => {
        if (publishedRecord === undefined) {
          throw new Error("Report publication transaction completed without a revision.");
        }
        return publishedRecord;
      });
  }
}
