import type {
  NormalisedActivity,
  PerformanceRecord,
  ProjectConfigurationInput,
} from "../domain/records";
import type { ImportManifest } from "../schemas/manifest";
import {
  toBaselineGenerationSnapshot,
} from "../domain/baselineSnapshot";
import type { BaselineGenerationSnapshot } from "../domain/baselineReconciliation";
import { ProjectControlsDb } from "./db";

export interface ActiveDataset {
  importId: string;
  manifest: ImportManifest;
  activities: readonly NormalisedActivity[];
  performance: readonly PerformanceRecord[];
  configuration: ProjectConfigurationInput;
  baselineSnapshots?: readonly BaselineGenerationSnapshot[];
}

export class DatasetRepository {
  constructor(private readonly db: ProjectControlsDb) {}

  getActiveImportId(): Promise<string | undefined> {
    return this.db.meta
      .get("activeImportId")
      .then((pointer) => pointer?.value);
  }

  getActiveDataset(): Promise<ActiveDataset | undefined> {
    let importId: string | undefined;
    let manifest: ImportManifest | undefined;
    let activities: readonly NormalisedActivity[] = [];
    let performance: readonly PerformanceRecord[] = [];
    let baselineSnapshots: readonly BaselineGenerationSnapshot[] = [];

    return this.db.transaction(
      "r",
      [
        this.db.meta,
        this.db.manifests,
        this.db.activities,
        this.db.performance,
        this.db.projectConfigurations,
        this.db.baselineSnapshots,
      ],
      () =>
        this.db.meta
          .get("activeImportId")
          .then((pointer) => {
            importId = pointer?.value;
            return importId === undefined
              ? undefined
              : this.db.manifests.get(importId);
          })
          .then((storedManifest) => {
            manifest = storedManifest;
            if (importId === undefined) return [];
            if (manifest === undefined) {
              throw new Error("Active pointer references a missing manifest.");
            }
            return this.db.activities.where("importId").equals(importId).toArray();
          })
          .then((storedActivities) => {
            activities = storedActivities.map(({ importId: _, ...value }) => value);
            if (importId === undefined) return [];
            return this.db.performance.where("importId").equals(importId).toArray();
          })
          .then((storedPerformance) => {
            performance = storedPerformance.map(({ importId: _, ...value }) => value);
            if (manifest === undefined) return [];
            return this.db.baselineSnapshots
              .where("projectId")
              .equals(manifest.projectId)
              .toArray();
          })
          .then((storedBaselineSnapshots) => {
            baselineSnapshots = storedBaselineSnapshots
              .map(toBaselineGenerationSnapshot)
              .sort((left, right) =>
                left.importedAt === right.importedAt
                  ? left.importId.localeCompare(right.importId)
                  : left.importedAt.localeCompare(right.importedAt),
              );
            if (manifest === undefined) return undefined;
            return this.db.projectConfigurations.get(manifest.projectId);
          })
          .then((configurationRecord): ActiveDataset | undefined => {
            if (importId === undefined && manifest === undefined) return undefined;
            if (
              importId === undefined ||
              manifest === undefined ||
              configurationRecord === undefined
            ) {
              throw new Error("Active generation is incomplete.");
            }
            return {
              importId,
              manifest,
              activities,
              performance,
              configuration: configurationRecord.configuration,
              baselineSnapshots,
            };
          }),
    );
  }
}
