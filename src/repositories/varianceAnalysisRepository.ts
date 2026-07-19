import {
  varianceAnalysisDetailsDraftSchema,
  varianceAnalysisRecordSchema,
  validateVarianceAnalysisForSignOff,
  type VarianceAnalysisContext,
  type VarianceAnalysisDetails,
  type VarianceAnalysisRecord,
} from "../domain/varianceAnalysis";
import { ProjectControlsDb } from "./db";

export class StaleVarianceAnalysisError extends Error {
  constructor() {
    super(
      "The active generation changed after the analysis was opened; refresh before saving.",
    );
    this.name = "StaleVarianceAnalysisError";
  }
}

export class VarianceAnalysisIncompleteError extends Error {
  constructor() {
    super("Variance analysis is incomplete and cannot be signed off.");
    this.name = "VarianceAnalysisIncompleteError";
  }
}

export class VarianceDraftNotCurrentError extends Error {
  constructor() {
    super("Save the complete draft against the current forecast before sign-off.");
    this.name = "VarianceDraftNotCurrentError";
  }
}

export interface SaveVarianceDraftInput {
  context: VarianceAnalysisContext;
  details: VarianceAnalysisDetails;
  savedAt: string;
}

export interface SignOffVarianceAnalysisInput {
  context: VarianceAnalysisContext;
  details: VarianceAnalysisDetails;
  signedAt: string;
}

export interface VarianceAnalysisContextState {
  currentDraft?: VarianceAnalysisRecord;
  signedRevisions: readonly VarianceAnalysisRecord[];
  retainedDraftCount: number;
}

const draftRecordId = (contextKey: string, sourceImportId: string) =>
  `DRAFT::${contextKey}::${sourceImportId}`;

const signedRecordId = (contextKey: string, revision: number) =>
  `SIGNED::${contextKey}::${String(revision)}`;

const activePointer = (value?: string) => value ?? null;

const assertActivePointer = (
  actual: string | undefined,
  expected: string | null,
) => {
  if (activePointer(actual) !== expected) {
    throw new StaleVarianceAnalysisError();
  }
};

const commonRecord = (
  context: VarianceAnalysisContext,
  details: VarianceAnalysisDetails,
) => ({
  contextKey: context.contextKey,
  projectId: context.projectId,
  baselineVersion: context.baselineVersion,
  scopeType: context.scopeType,
  scopeId: context.scopeId,
  reportingPeriod: context.reportingPeriod,
  sourceImportId: context.sourceImportId,
  managementScenario: context.managementScenario,
  breachedMetrics: [...context.breachedMetrics],
  facts: context.facts,
  factFingerprint: context.factFingerprint,
  details,
});

export class VarianceAnalysisRepository {
  constructor(private readonly db: ProjectControlsDb) {}

  loadContext(
    contextKey: string,
    sourceImportId: string,
  ): Promise<VarianceAnalysisContextState> {
    return this.db.varianceAnalyses
      .where("contextKey")
      .equals(contextKey)
      .toArray()
      .then((records) => {
        const signedRevisions = records
          .filter((record) => record.recordType === "signed")
          .sort((left, right) => (right.revision ?? 0) - (left.revision ?? 0));
        const drafts = records.filter((record) => record.recordType === "draft");
        return {
          currentDraft: drafts.find(
            (record) => record.sourceImportId === sourceImportId,
          ),
          signedRevisions,
          retainedDraftCount: drafts.filter(
            (record) => record.sourceImportId !== sourceImportId,
          ).length,
        };
      });
  }

  async saveDraft(input: SaveVarianceDraftInput): Promise<VarianceAnalysisRecord> {
    const details = varianceAnalysisDetailsDraftSchema.parse(input.details);
    const recordId = draftRecordId(
      input.context.contextKey,
      input.context.sourceImportId,
    );
    let savedRecord: VarianceAnalysisRecord | undefined;

    return this.db
      .transaction("rw", [this.db.meta, this.db.varianceAnalyses], () =>
        this.db.meta
          .get("activeImportId")
          .then((pointer) => {
            assertActivePointer(pointer?.value, input.context.expectedActiveImportId);
            return this.db.varianceAnalyses.get(recordId);
          })
          .then((existing) => {
            savedRecord = varianceAnalysisRecordSchema.parse({
              recordId,
              recordType: "draft",
              ...commonRecord(input.context, details),
              createdAt: existing?.createdAt ?? input.savedAt,
              updatedAt: input.savedAt,
            });
            return this.db.varianceAnalyses.put(savedRecord);
          }),
      )
      .then(() => {
        if (savedRecord === undefined) {
          throw new Error("Draft transaction completed without a record.");
        }
        return savedRecord;
      });
  }

  async signOff(
    input: SignOffVarianceAnalysisInput,
  ): Promise<VarianceAnalysisRecord> {
    if (input.context.breachedMetrics.length === 0) {
      throw new VarianceAnalysisIncompleteError();
    }
    const complete = validateVarianceAnalysisForSignOff(
      input.details,
      input.context.reportingPeriod,
    );
    if (!complete.success) {
      throw new VarianceAnalysisIncompleteError();
    }
    const currentDraftId = draftRecordId(
      input.context.contextKey,
      input.context.sourceImportId,
    );
    let signedRecord: VarianceAnalysisRecord | undefined;
    let draftCreatedAt = input.signedAt;

    return this.db
      .transaction("rw", [this.db.meta, this.db.varianceAnalyses], () =>
        this.db.meta
          .get("activeImportId")
          .then((pointer) => {
            assertActivePointer(pointer?.value, input.context.expectedActiveImportId);
            return this.db.varianceAnalyses.get(currentDraftId);
          })
          .then((draft) => {
            if (
              draft === undefined ||
              draft.factFingerprint !== input.context.factFingerprint ||
              JSON.stringify(draft.details) !== JSON.stringify(complete.data)
            ) {
              throw new VarianceDraftNotCurrentError();
            }
            draftCreatedAt = draft.createdAt;
            return this.db.varianceAnalyses
              .where("[contextKey+recordType]")
              .equals([input.context.contextKey, "signed"])
              .toArray();
          })
          .then((history) => {
            const revision =
              history.reduce(
                (highest, record) => Math.max(highest, record.revision ?? 0),
                0,
              ) + 1;
            signedRecord = varianceAnalysisRecordSchema.parse({
              recordId: signedRecordId(input.context.contextKey, revision),
              recordType: "signed",
              ...commonRecord(input.context, complete.data),
              revision,
              createdAt: draftCreatedAt,
              updatedAt: input.signedAt,
              signedAt: input.signedAt,
            });
            return this.db.varianceAnalyses
              .add(signedRecord)
              .then(() => this.db.varianceAnalyses.delete(currentDraftId));
          }),
      )
      .then(() => {
        if (signedRecord === undefined) {
          throw new Error("Sign-off transaction completed without a revision.");
        }
        return signedRecord;
      });
  }
}
