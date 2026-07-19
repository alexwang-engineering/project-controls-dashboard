import Dexie, { type DexieOptions, type Table } from "dexie";
import type {
  NormalisedActivity,
  PerformanceRecord,
  ProjectConfigurationInput,
} from "../domain/records";
import type { ImportManifest } from "../schemas/manifest";
import type { VarianceAnalysisRecord } from "../domain/varianceAnalysis";
import {
  buildStoredBaselineSnapshot,
  type StoredBaselineSnapshot,
} from "../domain/baselineSnapshot";

export const DATABASE_SCHEMA_VERSION = "4" as const;

export interface MetaRecord {
  key:
    | "activeImportId"
    | "schemaVersion"
    | "lastBackupAt"
    | "lastRestoreAt";
  value: string;
}

export interface StoredActivity extends NormalisedActivity {
  importId: string;
}

export interface StoredPerformanceRecord extends PerformanceRecord {
  importId: string;
}

export interface ProjectConfigurationRecord {
  projectId: string;
  configuration: ProjectConfigurationInput;
  createdImportId: string;
  updatedAt: string;
  revision: number;
}

export interface ProjectConfigurationHistoryRecord {
  projectId: string;
  revision: number;
  configuration: ProjectConfigurationInput;
  recordedAt: string;
  activeImportId: string;
  reason: "created" | "additive-update";
}

export class ProjectControlsDb extends Dexie {
  meta!: Table<MetaRecord, string>;
  manifests!: Table<ImportManifest, string>;
  activities!: Table<StoredActivity, [string, string]>;
  performance!: Table<StoredPerformanceRecord, [string, string, string]>;
  projectConfigurations!: Table<ProjectConfigurationRecord, string>;
  projectConfigurationHistory!: Table<
    ProjectConfigurationHistoryRecord,
    [string, number]
  >;
  varianceAnalyses!: Table<VarianceAnalysisRecord, string>;
  baselineSnapshots!: Table<StoredBaselineSnapshot, string>;

  constructor(name = "project-controls-dashboard", options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      meta: "&key",
      manifests: "&importId, projectId, importedAt",
      activities: "[importId+activityId], importId, activityId",
      performance:
        "[importId+activityId+periodEnd], importId, [importId+activityId], periodEnd",
      projectConfigurations: "&projectId",
    });
    this.version(2)
      .stores({
        meta: "&key",
        manifests: "&importId, projectId, importedAt",
        activities: "[importId+activityId], importId, activityId",
        performance:
          "[importId+activityId+periodEnd], importId, [importId+activityId], periodEnd",
        projectConfigurations: "&projectId",
        projectConfigurationHistory:
          "[projectId+revision], projectId, recordedAt",
      })
      .upgrade((transaction) => {
        const configurations = transaction.table("projectConfigurations");
        const history = transaction.table("projectConfigurationHistory");
        return configurations.toArray().then((records) => {
          const revised = records.map((record: ProjectConfigurationRecord) => ({
            ...record,
            revision: record.revision ?? 1,
          }));
          const entries = revised.map(
            (record: ProjectConfigurationRecord): ProjectConfigurationHistoryRecord => ({
              projectId: record.projectId,
              revision: record.revision,
              configuration: record.configuration,
              recordedAt: record.updatedAt,
              activeImportId: record.createdImportId,
              reason: "created",
            }),
          );
          return configurations
            .bulkPut(revised)
            .then(() => history.bulkPut(entries))
            .then(() =>
              transaction.table("meta").put({
                key: "schemaVersion",
                value: DATABASE_SCHEMA_VERSION,
              }),
            );
        });
      });
    this.version(3)
      .stores({
        meta: "&key",
        manifests: "&importId, projectId, importedAt",
        activities: "[importId+activityId], importId, activityId",
        performance:
          "[importId+activityId+periodEnd], importId, [importId+activityId], periodEnd",
        projectConfigurations: "&projectId",
        projectConfigurationHistory:
          "[projectId+revision], projectId, recordedAt",
        varianceAnalyses:
          "&recordId, contextKey, [contextKey+recordType], projectId, sourceImportId, signedAt",
      })
      .upgrade((transaction) =>
        transaction.table("meta").put({
          key: "schemaVersion",
          value: DATABASE_SCHEMA_VERSION,
        }),
      );
    this.version(4)
      .stores({
        meta: "&key",
        manifests: "&importId, projectId, importedAt",
        activities: "[importId+activityId], importId, activityId",
        performance:
          "[importId+activityId+periodEnd], importId, [importId+activityId], periodEnd",
        projectConfigurations: "&projectId",
        projectConfigurationHistory:
          "[projectId+revision], projectId, recordedAt",
        varianceAnalyses:
          "&recordId, contextKey, [contextKey+recordType], projectId, sourceImportId, signedAt",
        baselineSnapshots:
          "&importId, projectId, [projectId+baselineVersion], importedAt",
      })
      .upgrade((transaction) =>
        transaction
          .table("manifests")
          .toArray()
          .then((manifests) =>
            transaction
              .table("activities")
              .toArray()
              .then((activities: StoredActivity[]) =>
                transaction
                  .table("performance")
                  .toArray()
                  .then((performance: StoredPerformanceRecord[]) => {
                    const snapshots = manifests.flatMap((manifest) => {
                      const generationActivities = activities.filter(
                        ({ importId }) => importId === manifest.importId,
                      );
                      const generationPerformance = performance.filter(
                        ({ importId }) => importId === manifest.importId,
                      );
                      if (
                        generationActivities.length === 0 ||
                        generationPerformance.length === 0
                      ) {
                        return [];
                      }
                      return [
                        buildStoredBaselineSnapshot({
                          manifest,
                          activities: generationActivities.map(
                            ({ importId: _importId, ...activity }) => activity,
                          ),
                          performance: generationPerformance.map(
                            ({ importId: _importId, ...record }) => record,
                          ),
                        }),
                      ];
                    });
                    return transaction
                      .table("baselineSnapshots")
                      .bulkPut(snapshots)
                      .then(() =>
                        transaction.table("meta").put({
                          key: "schemaVersion",
                          value: DATABASE_SCHEMA_VERSION,
                        }),
                      );
                  }),
              ),
          ),
      );
    this.on("populate", () =>
      this.meta.add({ key: "schemaVersion", value: DATABASE_SCHEMA_VERSION }),
    );
  }
}
