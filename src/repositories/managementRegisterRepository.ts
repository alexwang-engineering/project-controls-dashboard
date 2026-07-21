import type { ChangeRequest, Milestone, Risk } from "../domain/types";
import { managementRegisterSnapshotSchema } from "../schemas/managementRegisters";
import { ProjectControlsDb } from "./db";

export interface ManagementRegisterSnapshot {
  milestones: readonly Milestone[];
  risks: readonly Risk[];
  changes: readonly ChangeRequest[];
}

export type ManagementRegisterRevisionReason =
  | "created"
  | "user-update"
  | "schedule-sync"
  | "legacy-migration"
  | "restore";

export interface ManagementRegisterRevision {
  projectId: string;
  revision: number;
  snapshot: ManagementRegisterSnapshot;
  recordedAt: string;
  reason: ManagementRegisterRevisionReason;
}

const stableSnapshot = (
  snapshot: ManagementRegisterSnapshot,
): ManagementRegisterSnapshot => ({
  milestones: [...snapshot.milestones].sort((left, right) =>
    left.id.localeCompare(right.id),
  ),
  risks: [...snapshot.risks].sort((left, right) =>
    left.id.localeCompare(right.id),
  ),
  changes: [...snapshot.changes].sort((left, right) =>
    left.id.localeCompare(right.id),
  ),
});

const snapshotFingerprint = (snapshot: ManagementRegisterSnapshot) =>
  JSON.stringify(stableSnapshot(snapshot));

export class StaleManagementRegisterHeadError extends Error {
  constructor() {
    super("The management register changed in another app window; reload before saving again.");
    this.name = "StaleManagementRegisterHeadError";
  }
}

export interface ManagementRegisterCommitOptions {
  expectedRevision: number;
  recordedAt: string;
  reason: ManagementRegisterRevisionReason;
}

export class ManagementRegisterRepository {
  constructor(private readonly db: ProjectControlsDb) {}

  async loadCurrent(
    projectId: string,
  ): Promise<ManagementRegisterRevision | undefined> {
    const head = await this.db.managementRegisterHeads.get(projectId);
    if (head === undefined) return undefined;
    const revision = await this.db.managementRegisterRevisions.get([
      projectId,
      head.revision,
    ]);
    if (revision === undefined) {
      throw new Error("The management-register head references a missing revision.");
    }
    return {
      ...revision,
      snapshot: managementRegisterSnapshotSchema.parse(revision.snapshot),
    };
  }

  async loadHistory(projectId: string): Promise<ManagementRegisterRevision[]> {
    const history = await this.db.managementRegisterRevisions
      .where("projectId")
      .equals(projectId)
      .toArray();
    return history
      .map((revision) => ({
        ...revision,
        snapshot: managementRegisterSnapshotSchema.parse(revision.snapshot),
      }))
      .sort((left, right) => right.revision - left.revision);
  }

  async commitSnapshot(
    projectId: string,
    candidate: ManagementRegisterSnapshot,
    options: ManagementRegisterCommitOptions,
  ): Promise<ManagementRegisterRevision> {
    const snapshot = stableSnapshot(managementRegisterSnapshotSchema.parse(candidate));
    if (Number.isNaN(Date.parse(options.recordedAt))) {
      throw new Error("Management-register revision timestamp is invalid.");
    }
    let committed: ManagementRegisterRevision | undefined;

    await this.db.transaction(
      "rw",
      [
        this.db.managementRegisterHeads,
        this.db.managementRegisterRevisions,
      ],
      () =>
        this.db.managementRegisterHeads.get(projectId).then((head) => {
          const currentRevision = head?.revision ?? 0;
          if (currentRevision !== options.expectedRevision) {
            throw new StaleManagementRegisterHeadError();
          }
          if (head?.fingerprint === snapshotFingerprint(snapshot)) {
            return this.db.managementRegisterRevisions
              .get([projectId, currentRevision])
              .then((current) => {
                if (current === undefined) {
                  throw new Error(
                    "The management-register head references a missing revision.",
                  );
                }
                committed = current;
              });
          }
          const revision = currentRevision + 1;
          committed = {
            projectId,
            revision,
            snapshot,
            recordedAt: options.recordedAt,
            reason: options.reason,
          };
          return this.db.managementRegisterRevisions
            .add(committed)
            .then(() =>
              this.db.managementRegisterHeads.put({
                projectId,
                revision,
                fingerprint: snapshotFingerprint(snapshot),
                updatedAt: options.recordedAt,
              }).then(() => undefined),
            );
        }),
    );

    if (committed === undefined) {
      throw new Error("Management-register commit completed without a revision.");
    }
    return committed;
  }
}
