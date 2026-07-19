import type {
  NormalisedActivity,
  PerformanceRecord,
  ProjectConfigurationInput,
  SourcedRecord,
} from "../domain/records";
import { validateCrossFile } from "../domain/import/crossFile";
import { analyseScheduleGraph } from "../domain/import/scheduleGraph";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BackupValidationError,
  backupEnvelopeSchema,
  parseBackupJson,
  type BackupEnvelope,
} from "../schemas/backup";
import { importManifestDraftSchema } from "../schemas/manifest";
import type { ValidationIssue } from "../schemas/validationIssue";
import { DatasetRepository } from "./datasetRepository";
import { DATABASE_SCHEMA_VERSION, ProjectControlsDb } from "./db";
import {
  ImportRepository,
  type PreparedImportGeneration,
} from "./importRepository";

const backupSource = <Value>(
  values: readonly Value[],
  offset: number,
): SourcedRecord<Value>[] =>
  values.map((value, index) => ({
    value,
    source: {
      fileName: "backup.json",
      recordNumber: index + offset,
    },
  }));

const configurationSignature = (configuration: ProjectConfigurationInput) =>
  JSON.stringify({
    projectId: configuration.projectId,
    workPackageIds: [...configuration.workPackageIds].sort(),
    calendarIds: [...configuration.calendarIds].sort(),
    authorisedStartActivityIds: [
      ...configuration.authorisedStartActivityIds,
    ].sort(),
    authorisedFinishActivityIds: [
      ...configuration.authorisedFinishActivityIds,
    ].sort(),
  });

const validateBackupDomain = (backup: BackupEnvelope) => {
  const activities = backupSource<NormalisedActivity>(
    backup.dataset.activities,
    2,
  );
  const performance = backupSource<PerformanceRecord>(
    backup.dataset.performance,
    activities.length + 2,
  );
  const configuration = backup.dataset.configuration;
  const crossFile = validateCrossFile({
    activities,
    performance,
    configuration,
  });
  const graph = analyseScheduleGraph({ activities, configuration });
  const issues = [...crossFile.issues, ...graph.issues];
  const blocking = issues.filter((issue) => issue.severity === "blocking");
  if (blocking.length > 0) {
    const codes = [...new Set(blocking.map((issue) => issue.code))].join(", ");
    throw new BackupValidationError(
      `Backup contains ${blocking.length} blocking domain issue${blocking.length === 1 ? "" : "s"}: ${codes}.`,
    );
  }
  if (crossFile.dataDate !== backup.dataset.manifest.dataDate) {
    throw new BackupValidationError(
      "Backup performance periods do not reproduce the manifest data date.",
    );
  }
  return { activities, performance, issues };
};

const restoreId = (restoredAt: string) => {
  const timestamp = restoredAt.replace(/\D/g, "").slice(0, 14);
  const suffix = globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `RESTORE-${timestamp}-${suffix}`;
};

export interface BackupRestorePreview {
  envelope: BackupEnvelope;
  prepared: PreparedImportGeneration;
  issues: readonly ValidationIssue[];
  createsProjectRegistry: boolean;
}

export interface BackupLifecycleStatus {
  schemaVersion: string;
  activeImportId?: string;
  lastImportAt?: string;
  lastBackupAt?: string;
  lastRestoreAt?: string;
  manifestCount: number;
  activityCount: number;
  performanceCount: number;
  varianceAnalysisCount: number;
}

export class BackupRepository {
  private readonly datasets: DatasetRepository;
  private readonly imports: ImportRepository;

  constructor(
    private readonly db: ProjectControlsDb,
    imports?: ImportRepository,
  ) {
    this.datasets = new DatasetRepository(db);
    this.imports = imports ?? new ImportRepository(db);
  }

  async createActiveBackup(exportedAt: string): Promise<BackupEnvelope> {
    const dataset = await this.datasets.getActiveDataset();
    if (dataset === undefined) {
      throw new Error("There is no active imported generation to back up.");
    }
    return backupEnvelopeSchema.parse({
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt,
      scope: "active-generation",
      dataset: {
        activeImportId: dataset.importId,
        manifest: dataset.manifest,
        configuration: dataset.configuration,
        activities: dataset.activities,
        performance: dataset.performance,
      },
      applicationRecords: {
        risks: [],
        changes: [],
        reportDrafts: [],
      },
    });
  }

  recordBackupCompleted(exportedAt: string): Promise<string> {
    return this.db.meta
      .put({ key: "lastBackupAt", value: exportedAt })
      .then(() => exportedAt);
  }

  async previewRestore(
    text: string,
    options: { restoredAt: string; restoreImportId?: string },
  ): Promise<BackupRestorePreview> {
    const envelope = parseBackupJson(text);
    const validated = validateBackupDomain(envelope);
    const candidateImportId =
      options.restoreImportId ?? restoreId(options.restoredAt);
    const [activeImportId, storedConfiguration, existingManifest] =
      await Promise.all([
        this.datasets.getActiveImportId(),
        this.db.projectConfigurations.get(envelope.dataset.manifest.projectId),
        this.db.manifests.get(candidateImportId),
      ]);
    if (existingManifest !== undefined) {
      throw new BackupValidationError("Restore generation ID already exists.");
    }
    if (
      storedConfiguration !== undefined &&
      configurationSignature(storedConfiguration.configuration) !==
        configurationSignature(envelope.dataset.configuration)
    ) {
      throw new BackupValidationError(
        "Backup registry does not match the confirmed local project registry.",
      );
    }

    const {
      previousImportId: _previousImportId,
      duplicateChecksumMatches: _duplicateChecksumMatches,
      ...sourceManifest
    } = envelope.dataset.manifest;
    const manifest = importManifestDraftSchema.parse({
      ...sourceManifest,
      importId: candidateImportId,
      importedAt: options.restoredAt,
      projectConfigurationConfirmed: true,
      duplicateChecksumConfirmed: true,
    });
    const configuration: ProjectConfigurationInput =
      storedConfiguration?.configuration ?? {
        ...envelope.dataset.configuration,
        source: "proposed",
      };

    return {
      envelope,
      prepared: {
        manifest,
        activities: validated.activities,
        performance: validated.performance,
        configuration,
        expectedActiveImportId: activeImportId ?? null,
      },
      issues: validated.issues,
      createsProjectRegistry: storedConfiguration === undefined,
    };
  }

  async restorePreview(preview: BackupRestorePreview) {
    const manifest = await this.imports.commitGeneration(preview.prepared);
    // The dataset is already committed at this point. A cosmetic lifecycle
    // timestamp must not make a successful atomic restore appear to have failed.
    await this.db.meta
      .put({
        key: "lastRestoreAt",
        value: manifest.importedAt,
      })
      .catch(() => undefined);
    return manifest;
  }

  async getLifecycleStatus(): Promise<BackupLifecycleStatus> {
    const [meta, active, manifestCount, varianceAnalysisCount] =
      await Promise.all([
        this.db.meta.toArray(),
        this.datasets.getActiveDataset(),
        this.db.manifests.count(),
        this.db.varianceAnalyses.count(),
      ]);
    const metaValue = (key: string) =>
      meta.find((record) => record.key === key)?.value;
    return {
      schemaVersion: metaValue("schemaVersion") ?? DATABASE_SCHEMA_VERSION,
      activeImportId: active?.importId,
      lastImportAt: active?.manifest.importedAt,
      lastBackupAt: metaValue("lastBackupAt"),
      lastRestoreAt: metaValue("lastRestoreAt"),
      manifestCount,
      activityCount: active?.activities.length ?? 0,
      performanceCount: active?.performance.length ?? 0,
      varianceAnalysisCount,
    };
  }

  resetAllLocalData(): Promise<void> {
    return this.db.transaction(
      "rw",
      [
        this.db.meta,
        this.db.manifests,
        this.db.activities,
        this.db.performance,
        this.db.projectConfigurations,
        this.db.projectConfigurationHistory,
        this.db.varianceAnalyses,
      ],
      () =>
        this.db.performance
          .clear()
          .then(() => this.db.activities.clear())
          .then(() => this.db.manifests.clear())
          .then(() => this.db.projectConfigurations.clear())
          .then(() => this.db.projectConfigurationHistory.clear())
          .then(() => this.db.varianceAnalyses.clear())
          .then(() => this.db.meta.clear())
          .then(() =>
            this.db.meta.add({
              key: "schemaVersion",
              value: DATABASE_SCHEMA_VERSION,
            }),
          )
          .then(() => undefined),
    );
  }
}
