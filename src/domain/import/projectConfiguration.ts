import type {
  ActivityId,
  NormalisedActivity,
  ProjectConfigurationInput,
  SourcedRecord,
} from "../records";

const distinctSorted = <Value extends string>(values: readonly Value[]) =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

/** Pure preview only. Persistence happens later in the atomic import commit. */
export function proposeProjectConfiguration(
  activities: readonly SourcedRecord<NormalisedActivity>[],
  authorisedStartActivityIds: readonly ActivityId[] = [],
  authorisedFinishActivityIds: readonly ActivityId[] = [],
): ProjectConfigurationInput | undefined {
  const projectId = activities[0]?.value.projectId;
  if (projectId === undefined) return undefined;

  return {
    source: "proposed",
    projectId,
    workPackageIds: distinctSorted(
      activities.map((record) => record.value.wbsId),
    ),
    calendarIds: distinctSorted(
      activities.map((record) => record.value.calendarId),
    ),
    authorisedStartActivityIds,
    authorisedFinishActivityIds,
  };
}

export const confirmFirstImportConfiguration = (
  proposed: ProjectConfigurationInput,
  confirmed: boolean,
) => (confirmed ? proposed : undefined);
