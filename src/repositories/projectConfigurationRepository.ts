import type {
  ActivityId,
  CalendarId,
  ProjectConfigurationInput,
  WorkPackageId,
} from "../domain/records";
import type {
  ProjectConfigurationHistoryRecord,
  ProjectConfigurationRecord,
} from "./db";
import { ProjectControlsDb } from "./db";
import { StaleImportPreviewError } from "./importRepository";

export interface ProjectConfigurationAdditions {
  workPackageIds: readonly WorkPackageId[];
  calendarIds: readonly CalendarId[];
  authorisedStartActivityIds: readonly ActivityId[];
  authorisedFinishActivityIds: readonly ActivityId[];
}

export interface ProjectConfigurationUpdatePreview {
  projectId: string;
  expectedActiveImportId: string;
  expectedRevision: number;
  expectedConfiguration: ProjectConfigurationInput;
  proposedConfiguration: ProjectConfigurationInput;
  additions: ProjectConfigurationAdditions;
}

export class ProjectConfigurationUpdateConfirmationRequiredError extends Error {
  constructor() {
    super("Confirm the additive project-registry update before applying it.");
    this.name = "ProjectConfigurationUpdateConfirmationRequiredError";
  }
}

export class StaleProjectConfigurationError extends Error {
  constructor() {
    super("The project registry changed after preview; validate the files again.");
    this.name = "StaleProjectConfigurationError";
  }
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

const additionsFor = <Value extends string>(
  current: readonly Value[],
  inferred: readonly Value[],
) => {
  const known = new Set(current);
  return [...new Set(inferred)].filter((value) => !known.has(value)).sort();
};

const merge = <Value extends string>(
  current: readonly Value[],
  additions: readonly Value[],
) => [...new Set([...current, ...additions])].sort();

const hasAdditions = (additions: ProjectConfigurationAdditions) =>
  additions.workPackageIds.length > 0 ||
  additions.calendarIds.length > 0 ||
  additions.authorisedStartActivityIds.length > 0 ||
  additions.authorisedFinishActivityIds.length > 0;

const assertAdditive = (
  current: ProjectConfigurationInput,
  proposed: ProjectConfigurationInput,
) => {
  if (
    current.projectId !== proposed.projectId ||
    proposed.source !== "active"
  ) {
    throw new Error("A registry update must retain the active project identity.");
  }
  for (const field of [
    "workPackageIds",
    "calendarIds",
    "authorisedStartActivityIds",
    "authorisedFinishActivityIds",
  ] as const) {
    const proposedValues = new Set<string>(
      proposed[field] as readonly string[],
    );
    if (current[field].some((value) => !proposedValues.has(value as string))) {
      throw new Error("M1 registry updates are additive and cannot remove identifiers.");
    }
  }
};

export class ProjectConfigurationRepository {
  constructor(private readonly db: ProjectControlsDb) {}

  async previewAdditiveUpdate(
    inferred: ProjectConfigurationInput,
    expectedActiveImportId: string,
  ): Promise<ProjectConfigurationUpdatePreview | undefined> {
    const [pointer, currentRecord] = await Promise.all([
      this.db.meta.get("activeImportId"),
      this.db.projectConfigurations.get(inferred.projectId),
    ]);
    if (pointer?.value !== expectedActiveImportId) {
      throw new StaleImportPreviewError();
    }
    if (currentRecord === undefined) return undefined;

    const current = currentRecord.configuration;
    const additions: ProjectConfigurationAdditions = {
      workPackageIds: additionsFor(
        current.workPackageIds,
        inferred.workPackageIds,
      ),
      calendarIds: additionsFor(current.calendarIds, inferred.calendarIds),
      authorisedStartActivityIds: additionsFor(
        current.authorisedStartActivityIds,
        inferred.authorisedStartActivityIds,
      ),
      authorisedFinishActivityIds: additionsFor(
        current.authorisedFinishActivityIds,
        inferred.authorisedFinishActivityIds,
      ),
    };
    if (!hasAdditions(additions)) return undefined;

    return {
      projectId: currentRecord.projectId,
      expectedActiveImportId,
      expectedRevision: currentRecord.revision ?? 1,
      expectedConfiguration: current,
      proposedConfiguration: {
        source: "active",
        projectId: current.projectId,
        workPackageIds: merge(current.workPackageIds, additions.workPackageIds),
        calendarIds: merge(current.calendarIds, additions.calendarIds),
        authorisedStartActivityIds: merge(
          current.authorisedStartActivityIds,
          additions.authorisedStartActivityIds,
        ),
        authorisedFinishActivityIds: merge(
          current.authorisedFinishActivityIds,
          additions.authorisedFinishActivityIds,
        ),
      },
      additions,
    };
  }

  commitAdditiveUpdate(
    preview: ProjectConfigurationUpdatePreview,
    options: { confirmed: boolean; updatedAt: string },
  ): Promise<ProjectConfigurationRecord> {
    if (!options.confirmed) {
      return Promise.reject(
        new ProjectConfigurationUpdateConfirmationRequiredError(),
      );
    }
    if (Number.isNaN(Date.parse(options.updatedAt))) {
      return Promise.reject(new Error("Registry update timestamp is invalid."));
    }
    let updated: ProjectConfigurationRecord | undefined;
    return this.db
      .transaction(
        "rw",
        [
          this.db.meta,
          this.db.projectConfigurations,
          this.db.projectConfigurationHistory,
        ],
        () =>
          this.db.meta
            .get("activeImportId")
            .then((pointer) => {
              if (pointer?.value !== preview.expectedActiveImportId) {
                throw new StaleImportPreviewError();
              }
              return this.db.projectConfigurations.get(preview.projectId);
            })
            .then((currentRecord) => {
              if (
                currentRecord === undefined ||
                (currentRecord.revision ?? 1) !== preview.expectedRevision ||
                configurationSignature(currentRecord.configuration) !==
                  configurationSignature(preview.expectedConfiguration)
              ) {
                throw new StaleProjectConfigurationError();
              }
              assertAdditive(
                currentRecord.configuration,
                preview.proposedConfiguration,
              );
              updated = {
                ...currentRecord,
                configuration: preview.proposedConfiguration,
                revision: preview.expectedRevision + 1,
                updatedAt: options.updatedAt,
              };
              const history: ProjectConfigurationHistoryRecord = {
                projectId: updated.projectId,
                revision: updated.revision,
                configuration: updated.configuration,
                recordedAt: options.updatedAt,
                activeImportId: preview.expectedActiveImportId,
                reason: "additive-update",
              };
              return this.db.projectConfigurations
                .put(updated)
                .then(() => this.db.projectConfigurationHistory.add(history));
            }),
      )
      .then(() => {
        if (updated === undefined) {
          throw new Error("Registry update completed without a revision.");
        }
        return updated;
      });
  }
}
