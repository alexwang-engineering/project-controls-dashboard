import type {
  NormalisedActivity,
  PerformanceRecord,
  ProjectConfigurationInput,
  SourcedRecord,
} from "../domain/records";
import {
  importManifestDraftSchema,
  importManifestSchema,
  type ImportManifest,
  type ImportManifestDraft,
} from "../schemas/manifest";
import type {
  ProjectConfigurationRecord,
  StoredActivity,
  StoredPerformanceRecord,
} from "./db";
import { ProjectControlsDb } from "./db";

export class StaleImportPreviewError extends Error {
  constructor() {
    super("The active import changed after preview; refresh before committing.");
    this.name = "StaleImportPreviewError";
  }
}

export class ProjectConfigurationConfirmationRequiredError extends Error {
  constructor() {
    super("First import requires explicit project-configuration confirmation.");
    this.name = "ProjectConfigurationConfirmationRequiredError";
  }
}

export class ProjectConfigurationMismatchError extends Error {
  constructor() {
    super("Candidate configuration does not match the active project registry.");
    this.name = "ProjectConfigurationMismatchError";
  }
}

export class DuplicateChecksumConfirmationRequiredError extends Error {
  readonly matches: readonly DuplicateChecksumMatch[];

  constructor(matches: readonly DuplicateChecksumMatch[]) {
    super("A file checksum already exists in successful project history.");
    this.name = "DuplicateChecksumConfirmationRequiredError";
    this.matches = matches;
  }
}

export interface DuplicateChecksumMatch {
  checksumSha256: string;
  previousImportId: string;
}

export interface PreparedImportGeneration {
  manifest: ImportManifestDraft;
  activities: readonly SourcedRecord<NormalisedActivity>[];
  performance: readonly SourcedRecord<PerformanceRecord>[];
  configuration: ProjectConfigurationInput;
  expectedActiveImportId: string | null;
}

export interface CommitFaultHooks {
  afterActivityHalf?: () => undefined;
  afterPerformanceHalf?: () => undefined;
  beforeManifestWrite?: () => undefined;
  beforePointerFlip?: () => undefined;
}

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

const duplicateMatches = (
  history: readonly ImportManifest[],
  checksums: ReadonlySet<string>,
) => {
  const matches = new Map<string, DuplicateChecksumMatch>();
  for (const manifest of history) {
    for (const file of manifest.files) {
      if (!checksums.has(file.checksumSha256)) continue;
      const key = file.checksumSha256 + "\u0000" + manifest.importId;
      matches.set(key, {
        checksumSha256: file.checksumSha256,
        previousImportId: manifest.importId,
      });
    }
  }
  return [...matches.values()].sort((left, right) =>
    (left.checksumSha256 + left.previousImportId).localeCompare(
      right.checksumSha256 + right.previousImportId,
    ),
  );
};

const assertPreparedGeneration = (prepared: PreparedImportGeneration) => {
  const manifest = importManifestDraftSchema.parse(prepared.manifest);
  if (
    manifest.totals.acceptedRows !==
      prepared.activities.length + prepared.performance.length ||
    manifest.files[0].counts.acceptedRows !== prepared.activities.length ||
    manifest.files[1].counts.acceptedRows !== prepared.performance.length
  ) {
    throw new Error("Prepared rows do not reconcile with manifest accepted counts.");
  }
  if (prepared.activities.length === 0 || prepared.performance.length === 0) {
    throw new Error("A committed generation requires both schedule and performance rows.");
  }
  if (manifest.totals.blockedRows !== manifest.totals.quarantinedRows) {
    throw new Error("A committable manifest may contain quarantined blocks only.");
  }
  if (prepared.configuration.projectId !== manifest.projectId) {
    throw new ProjectConfigurationMismatchError();
  }
  for (const record of prepared.activities) {
    if (
      record.value.projectId !== manifest.projectId ||
      record.value.baselineVersion !== manifest.baselineVersion
    ) {
      throw new Error("Prepared schedule rows disagree with the manifest identity.");
    }
  }
  for (const record of prepared.performance) {
    if (
      record.value.projectId !== manifest.projectId ||
      record.value.baselineVersion !== manifest.baselineVersion
    ) {
      throw new Error("Prepared performance rows disagree with the manifest identity.");
    }
  }
  return manifest;
};

const activeConfiguration = (
  configuration: ProjectConfigurationInput,
): ProjectConfigurationInput => ({ ...configuration, source: "active" });

export class ImportRepository {
  constructor(
    private readonly db: ProjectControlsDb,
    private readonly faultHooks: CommitFaultHooks = {},
  ) {}

  findDuplicateChecksums(
    projectId: string,
    checksums: readonly string[],
  ): Promise<readonly DuplicateChecksumMatch[]> {
    const checksumSet = new Set(checksums);
    return this.db.manifests
      .where("projectId")
      .equals(projectId)
      .toArray()
      .then((history) => duplicateMatches(history, checksumSet));
  }

  commitGeneration(prepared: PreparedImportGeneration): Promise<ImportManifest> {
    const draft = assertPreparedGeneration(prepared);
    const storedActivities: StoredActivity[] = prepared.activities.map(
      ({ value }) => ({ ...value, importId: draft.importId }),
    );
    const storedPerformance: StoredPerformanceRecord[] = prepared.performance.map(
      ({ value }) => ({ ...value, importId: draft.importId }),
    );
    const activityMiddle = Math.ceil(storedActivities.length / 2);
    const performanceMiddle = Math.ceil(storedPerformance.length / 2);
    const activityHalves = [
      storedActivities.slice(0, activityMiddle),
      storedActivities.slice(activityMiddle),
    ] as const;
    const performanceHalves = [
      storedPerformance.slice(0, performanceMiddle),
      storedPerformance.slice(performanceMiddle),
    ] as const;
    const checksums = new Set(draft.files.map((file) => file.checksumSha256));
    let committedManifest: ImportManifest | undefined;

    // This transaction intentionally uses only Dexie-returned promises and
    // synchronous fault hooks. Checksums, worker results, timestamps, schemas,
    // and every browser API operation have completed before it opens (I6).
    return this.db
      .transaction(
        "rw",
        [
          this.db.meta,
          this.db.manifests,
          this.db.activities,
          this.db.performance,
          this.db.projectConfigurations,
        ],
        () =>
          this.db.meta
            .get("activeImportId")
            .then((activePointer) => {
              const activeImportId = activePointer?.value ?? null;
              if (activeImportId !== prepared.expectedActiveImportId) {
                throw new StaleImportPreviewError();
              }
              return this.db.manifests
                .where("projectId")
                .equals(draft.projectId)
                .toArray()
                .then((history) => ({ activeImportId, history }));
            })
            .then(({ activeImportId, history }) => {
              const matches = duplicateMatches(history, checksums);
              if (matches.length > 0 && !draft.duplicateChecksumConfirmed) {
                throw new DuplicateChecksumConfirmationRequiredError(matches);
              }
              return this.db.projectConfigurations
                .get(draft.projectId)
                .then((configuration) => ({
                  activeImportId,
                  matches,
                  configuration,
                }));
            })
            .then(({ activeImportId, matches, configuration }) => {
              if (configuration === undefined) {
                if (
                  prepared.configuration.source !== "proposed" ||
                  !draft.projectConfigurationConfirmed
                ) {
                  throw new ProjectConfigurationConfirmationRequiredError();
                }
                const record: ProjectConfigurationRecord = {
                  projectId: draft.projectId,
                  configuration: activeConfiguration(prepared.configuration),
                  createdImportId: draft.importId,
                  updatedAt: draft.importedAt,
                };
                return this.db.projectConfigurations
                  .add(record)
                  .then(() => ({ activeImportId, matches }));
              }
              if (
                prepared.configuration.source !== "active" ||
                configurationSignature(configuration.configuration) !==
                  configurationSignature(prepared.configuration)
              ) {
                throw new ProjectConfigurationMismatchError();
              }
              return { activeImportId, matches };
            })
            .then((context) =>
              this.db.activities.bulkAdd(activityHalves[0]).then(() => context),
            )
            .then((context) => {
              this.faultHooks.afterActivityHalf?.();
              return activityHalves[1].length === 0
                ? context
                : this.db.activities
                    .bulkAdd(activityHalves[1])
                    .then(() => context);
            })
            .then((context) =>
              this.db.performance
                .bulkAdd(performanceHalves[0])
                .then(() => context),
            )
            .then((context) => {
              this.faultHooks.afterPerformanceHalf?.();
              return performanceHalves[1].length === 0
                ? context
                : this.db.performance
                    .bulkAdd(performanceHalves[1])
                    .then(() => context);
            })
            .then(({ activeImportId, matches }) => {
              this.faultHooks.beforeManifestWrite?.();
              committedManifest = importManifestSchema.parse({
                ...draft,
                previousImportId: activeImportId ?? undefined,
                duplicateChecksumMatches: matches,
              });
              return this.db.manifests.add(committedManifest);
            })
            .then(() => {
              this.faultHooks.beforePointerFlip?.();
              return this.db.meta.put({
                key: "activeImportId",
                value: draft.importId,
              });
            }),
      )
      .then(() => {
        if (committedManifest === undefined) {
          throw new Error("Transaction completed without a manifest.");
        }
        return committedManifest;
      });
  }

  revertToPreviousImport(expectedActiveImportId: string): Promise<string> {
    let restoredImportId: string | undefined;
    return this.db
      .transaction(
        "rw",
        [this.db.meta, this.db.manifests, this.db.activities, this.db.performance],
        () =>
          this.db.meta
            .get("activeImportId")
            .then((pointer) => {
              if (pointer?.value !== expectedActiveImportId) {
                throw new StaleImportPreviewError();
              }
              return this.db.manifests.get(expectedActiveImportId);
            })
            .then((manifest) => {
              const previousImportId = manifest?.previousImportId;
              if (previousImportId === undefined) {
                throw new Error("The active generation has no previous import.");
              }
              return this.db.activities
                .where("importId")
                .equals(previousImportId)
                .count()
                .then((activityCount) => ({ previousImportId, activityCount }));
            })
            .then(({ previousImportId, activityCount }) => {
              if (activityCount === 0) {
                throw new Error("Previous generation rows are no longer available.");
              }
              return this.db.performance
                .where("importId")
                .equals(previousImportId)
                .count()
                .then((performanceCount) => ({
                  previousImportId,
                  performanceCount,
                }));
            })
            .then(({ previousImportId, performanceCount }) => {
              if (performanceCount === 0) {
                throw new Error("Previous generation rows are no longer available.");
              }
              restoredImportId = previousImportId;
              return this.db.meta.put({
                key: "activeImportId",
                value: previousImportId,
              });
            }),
      )
      .then(() => {
        if (restoredImportId === undefined) {
          throw new Error("Revert completed without an active generation.");
        }
        return restoredImportId;
      });
  }

  garbageCollectGenerations(retainAtLeast = 2): Promise<readonly string[]> {
    if (!Number.isInteger(retainAtLeast) || retainAtLeast < 2) {
      throw new Error("Garbage collection must retain at least two generations.");
    }
    let removedImportIds: string[] = [];

    return this.db
      .transaction(
        "rw",
        [this.db.meta, this.db.manifests, this.db.activities, this.db.performance],
        () =>
          this.db.meta
            .get("activeImportId")
            .then((pointer) =>
              this.db.manifests.toArray().then((manifests) => ({
                activeImportId: pointer?.value,
                manifests,
              })),
            )
            .then(({ activeImportId, manifests }) => {
              const retained = new Set<string>();
              if (activeImportId !== undefined) retained.add(activeImportId);
              const activeManifest = manifests.find(
                (manifest) => manifest.importId === activeImportId,
              );
              if (activeManifest?.previousImportId !== undefined) {
                retained.add(activeManifest.previousImportId);
              }
              const newestFirst = [...manifests].sort((left, right) =>
                right.importedAt.localeCompare(left.importedAt),
              );
              for (const manifest of newestFirst) {
                if (retained.size >= retainAtLeast) break;
                retained.add(manifest.importId);
              }
              removedImportIds = manifests
                .map((manifest) => manifest.importId)
                .filter((importId) => !retained.has(importId));

              const removeAt = (index: number): PromiseLike<unknown> | undefined => {
                const importId = removedImportIds[index];
                if (importId === undefined) return undefined;
                return this.db.activities
                  .where("importId")
                  .equals(importId)
                  .delete()
                  .then(() =>
                    this.db.performance
                      .where("importId")
                      .equals(importId)
                      .delete(),
                  )
                  .then(() => removeAt(index + 1));
              };
              return removeAt(0);
            }),
      )
      .then(() => removedImportIds);
  }
}
