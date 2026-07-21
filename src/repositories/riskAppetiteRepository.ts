import {
  riskAppetiteRevisionSchema,
  riskAppetiteThresholdsSchema,
  type RiskAppetiteRevision,
  type RiskAppetiteThresholds,
} from "../domain/riskAppetite";
import { ProjectControlsDb } from "./db";

export class RiskAppetiteConfirmationRequiredError extends Error {
  constructor() {
    super("Confirm the authorised appetite change before saving it.");
    this.name = "RiskAppetiteConfirmationRequiredError";
  }
}

export class StaleRiskAppetiteRevisionError extends Error {
  constructor() {
    super("The risk appetite changed after this form was opened; reload before saving.");
    this.name = "StaleRiskAppetiteRevisionError";
  }
}

export interface CommitRiskAppetiteInput {
  projectId: string;
  expectedRevision: number;
  thresholds: RiskAppetiteThresholds;
  changeReason: string;
  authorisedBy: string;
  effectiveFrom: string;
  recordedAt: string;
  confirmed: boolean;
}

export class RiskAppetiteRepository {
  constructor(private readonly db: ProjectControlsDb) {}

  loadHistory(projectId: string): Promise<RiskAppetiteRevision[]> {
    return this.db.riskAppetiteRevisions
      .where("projectId")
      .equals(projectId)
      .toArray()
      .then((history) =>
        history
          .map((record) => riskAppetiteRevisionSchema.parse(record))
          .sort((left, right) => right.revision - left.revision),
      );
  }

  async commitRevision(
    input: CommitRiskAppetiteInput,
  ): Promise<RiskAppetiteRevision> {
    if (!input.confirmed) {
      throw new RiskAppetiteConfirmationRequiredError();
    }
    const thresholds = riskAppetiteThresholdsSchema.parse(input.thresholds);
    let committed: RiskAppetiteRevision | undefined;
    await this.db.transaction("rw", [this.db.riskAppetiteRevisions], () =>
      this.db.riskAppetiteRevisions
        .where("projectId")
        .equals(input.projectId)
        .toArray()
        .then((history) => {
          const currentRevision = history.reduce(
            (highest, revision) => Math.max(highest, revision.revision),
            0,
          );
          if (currentRevision !== input.expectedRevision) {
            throw new StaleRiskAppetiteRevisionError();
          }
          committed = riskAppetiteRevisionSchema.parse({
            projectId: input.projectId,
            revision: currentRevision + 1,
            thresholds,
            changeReason: input.changeReason,
            authorisedBy: input.authorisedBy,
            effectiveFrom: input.effectiveFrom,
            recordedAt: input.recordedAt,
          });
          return this.db.riskAppetiteRevisions.add(committed);
        }),
    );
    if (committed === undefined) {
      throw new Error("Risk-appetite commit completed without a revision.");
    }
    return committed;
  }
}
