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
import { ManagementRegisterRepository } from "./managementRegisterRepository";
import { RiskAppetiteRepository } from "./riskAppetiteRepository";

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
  expectedRegisterRevision: number;
  expectedRiskAppetiteRevision: number;
  restoreRiskAppetiteHistory: boolean;
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
  publishedReportCount: number;
  managementRegisterRevisionCount: number;
  riskAppetiteRevisionCount: number;
}

export class BackupRepository {
  private readonly datasets: DatasetRepository;
  private readonly imports: ImportRepository;
  private readonly managementRegisters: ManagementRegisterRepository;
  private readonly riskAppetite: RiskAppetiteRepository;

  constructor(
    private readonly db: ProjectControlsDb,
    imports?: ImportRepository,
  ) {
    this.datasets = new DatasetRepository(db);
    this.imports = imports ?? new ImportRepository(db);
    this.managementRegisters = new ManagementRegisterRepository(db);
    this.riskAppetite = new RiskAppetiteRepository(db);
  }

  async createActiveBackup(exportedAt: string): Promise<BackupEnvelope> {
    const dataset = await this.datasets.getActiveDataset();
    if (dataset === undefined) {
      throw new Error("There is no active imported generation to back up.");
    }
    const [managementRegister, riskAppetiteHistory] = await Promise.all([
      this.managementRegisters.loadCurrent(dataset.manifest.projectId),
      this.riskAppetite.loadHistory(dataset.manifest.projectId),
    ]);
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
        managementRegister:
          managementRegister === undefined
            ? null
            : {
                revision: managementRegister.revision,
                snapshot: managementRegister.snapshot,
                recordedAt: managementRegister.recordedAt,
                reason: managementRegister.reason,
              },
        riskAppetiteHistory,
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
    const [
      activeImportId,
      storedConfiguration,
      existingManifest,
      currentRegister,
      currentRiskAppetiteHistory,
    ] =
      await Promise.all([
        this.datasets.getActiveImportId(),
        this.db.projectConfigurations.get(envelope.dataset.manifest.projectId),
        this.db.manifests.get(candidateImportId),
        this.managementRegisters.loadCurrent(envelope.dataset.manifest.projectId),
        this.riskAppetite.loadHistory(envelope.dataset.manifest.projectId),
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
    if (
      envelope.applicationRecords.riskAppetiteHistory.some(
        ({ projectId }) => projectId !== envelope.dataset.manifest.projectId,
      )
    ) {
      throw new BackupValidationError(
        "Backup risk-appetite history does not match the manifest project.",
      );
    }
    const canonicalAppetite = (history: typeof currentRiskAppetiteHistory) =>
      JSON.stringify([...history].sort((left, right) => left.revision - right.revision));
    if (
      currentRiskAppetiteHistory.length > 0 &&
      envelope.applicationRecords.riskAppetiteHistory.length > 0 &&
      canonicalAppetite(currentRiskAppetiteHistory) !==
        canonicalAppetite(envelope.applicationRecords.riskAppetiteHistory)
    ) {
      throw new BackupValidationError(
        "Backup risk-appetite history conflicts with the authorised local history.",
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
      expectedRegisterRevision: currentRegister?.revision ?? 0,
      expectedRiskAppetiteRevision:
        currentRiskAppetiteHistory[0]?.revision ?? 0,
      restoreRiskAppetiteHistory:
        currentRiskAppetiteHistory.length === 0 &&
        envelope.applicationRecords.riskAppetiteHistory.length > 0,
    };
  }

  async restorePreview(preview: BackupRestorePreview) {
    let restoredManifest: Awaited<ReturnType<ImportRepository["commitGeneration"]>> | undefined;
    await this.db.transaction(
      "rw",
      [
        this.db.meta,
        this.db.manifests,
        this.db.activities,
        this.db.performance,
        this.db.projectConfigurations,
        this.db.projectConfigurationHistory,
        this.db.baselineSnapshots,
        this.db.managementRegisterHeads,
        this.db.managementRegisterRevisions,
        this.db.riskAppetiteRevisions,
      ],
      () =>
        this.imports
          .commitGeneration(preview.prepared)
          .then((manifest) => {
            restoredManifest = manifest;
            const managementRegister =
              preview.envelope.applicationRecords.managementRegister;
            if (managementRegister === null) return undefined;
            return this.managementRegisters.commitSnapshot(
              manifest.projectId,
              managementRegister.snapshot,
              {
                expectedRevision: preview.expectedRegisterRevision,
                recordedAt: manifest.importedAt,
                reason: "restore",
              },
            );
          })
          .then(() => {
            if (!preview.restoreRiskAppetiteHistory) return undefined;
            return this.db.riskAppetiteRevisions
              .where("projectId")
              .equals(preview.prepared.manifest.projectId)
              .toArray()
              .then((current) => {
                const currentRevision = current.reduce(
                  (highest, revision) => Math.max(highest, revision.revision),
                  0,
                );
                if (currentRevision !== preview.expectedRiskAppetiteRevision) {
                  throw new BackupValidationError(
                    "Risk appetite changed after restore preview; validate the backup again.",
                  );
                }
                return this.db.riskAppetiteRevisions.bulkAdd(
                  preview.envelope.applicationRecords.riskAppetiteHistory,
                );
              });
          }),
    );
    if (restoredManifest === undefined) {
      throw new Error("Restore transaction completed without a manifest.");
    }
    const manifest = restoredManifest;
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
    const [
      meta,
      active,
      manifestCount,
      varianceAnalysisCount,
      publishedReportCount,
      managementRegisterRevisionCount,
      riskAppetiteRevisionCount,
    ] =
      await Promise.all([
        this.db.meta.toArray(),
        this.datasets.getActiveDataset(),
        this.db.manifests.count(),
        this.db.varianceAnalyses.count(),
        this.db.reportPublications
          .toArray()
          .then(
            (records) =>
              records.filter(({ recordType }) => recordType === "published")
                .length,
          ),
        this.db.managementRegisterRevisions.count(),
        this.db.riskAppetiteRevisions.count(),
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
      publishedReportCount,
      managementRegisterRevisionCount,
      riskAppetiteRevisionCount,
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
        this.db.baselineSnapshots,
        this.db.reportPublications,
        this.db.managementRegisterHeads,
        this.db.managementRegisterRevisions,
        this.db.riskAppetiteRevisions,
      ],
      () =>
        this.db.performance
          .clear()
          .then(() => this.db.activities.clear())
          .then(() => this.db.manifests.clear())
          .then(() => this.db.projectConfigurations.clear())
          .then(() => this.db.projectConfigurationHistory.clear())
          .then(() => this.db.varianceAnalyses.clear())
          .then(() => this.db.baselineSnapshots.clear())
          .then(() => this.db.reportPublications.clear())
          .then(() => this.db.managementRegisterHeads.clear())
          .then(() => this.db.managementRegisterRevisions.clear())
          .then(() => this.db.riskAppetiteRevisions.clear())
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
