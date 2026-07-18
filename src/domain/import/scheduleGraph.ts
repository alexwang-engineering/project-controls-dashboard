import type {
  ActivityId,
  NormalisedActivity,
  ProjectConfigurationInput,
  SourcedRecord,
} from "../records";
import type { ValidationIssue } from "../../schemas/validationIssue";

export interface ScheduleGraphValidationInput {
  activities: readonly SourcedRecord<NormalisedActivity>[];
  configuration: ProjectConfigurationInput;
}

export interface ScheduleGraphValidationResult {
  issues: ValidationIssue[];
  blockedActivityIds: ReadonlySet<ActivityId>;
}

const issueAt = (
  record: SourcedRecord<NormalisedActivity>,
  issue: Omit<
    ValidationIssue,
    "fileName" | "recordNumber" | "physicalLineStart"
  >,
): ValidationIssue => ({ ...record.source, ...issue });

const stronglyConnectedComponents = (
  nodes: readonly ActivityId[],
  adjacency: ReadonlyMap<ActivityId, readonly ActivityId[]>,
) => {
  const allowed = new Set(nodes);
  const visited = new Set<ActivityId>();
  const finishOrder: ActivityId[] = [];

  for (const start of nodes) {
    if (visited.has(start)) continue;
    visited.add(start);
    const stack: { node: ActivityId; next: number }[] = [
      { node: start, next: 0 },
    ];
    while (stack.length > 0) {
      const frame = stack.at(-1);
      if (frame === undefined) break;
      const neighbours = adjacency.get(frame.node) ?? [];
      let descended = false;
      while (frame.next < neighbours.length) {
        const neighbour = neighbours[frame.next];
        frame.next += 1;
        if (
          neighbour === undefined ||
          !allowed.has(neighbour) ||
          visited.has(neighbour)
        ) {
          continue;
        }
        visited.add(neighbour);
        stack.push({ node: neighbour, next: 0 });
        descended = true;
        break;
      }
      if (!descended && frame.next >= neighbours.length) {
        finishOrder.push(frame.node);
        stack.pop();
      }
    }
  }

  const reverse = new Map<ActivityId, ActivityId[]>();
  for (const node of nodes) reverse.set(node, []);
  for (const [from, targets] of adjacency) {
    if (!allowed.has(from)) continue;
    for (const target of targets) {
      if (!allowed.has(target)) continue;
      reverse.get(target)?.push(from);
    }
  }

  const assigned = new Set<ActivityId>();
  const components: ActivityId[][] = [];
  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const start = finishOrder[index];
    if (start === undefined || assigned.has(start)) continue;
    const component: ActivityId[] = [];
    const stack = [start];
    assigned.add(start);
    while (stack.length > 0) {
      const node = stack.pop();
      if (node === undefined) continue;
      component.push(node);
      for (const neighbour of reverse.get(node) ?? []) {
        if (assigned.has(neighbour)) continue;
        assigned.add(neighbour);
        stack.push(neighbour);
      }
    }
    components.push(component);
  }
  return components;
};

const exampleCyclePath = (
  component: readonly ActivityId[],
  adjacency: ReadonlyMap<ActivityId, readonly ActivityId[]>,
) => {
  const start = component[0];
  if (start === undefined) return [];
  if ((adjacency.get(start) ?? []).includes(start)) return [start, start];
  const allowed = new Set(component);

  for (const first of adjacency.get(start) ?? []) {
    if (!allowed.has(first)) continue;
    const parent = new Map<ActivityId, ActivityId | undefined>([[first, undefined]]);
    const stack = [first];
    while (stack.length > 0) {
      const node = stack.pop();
      if (node === undefined) continue;
      if (node === start) {
        const reversed: ActivityId[] = [];
        let current: ActivityId | undefined = node;
        while (current !== undefined) {
          reversed.push(current);
          current = parent.get(current);
        }
        return [start, ...reversed.reverse()];
      }
      for (const neighbour of adjacency.get(node) ?? []) {
        if (!allowed.has(neighbour) || parent.has(neighbour)) continue;
        parent.set(neighbour, node);
        stack.push(neighbour);
      }
    }
  }
  return [...component, start];
};

export function analyseScheduleGraph(
  input: ScheduleGraphValidationInput,
): ScheduleGraphValidationResult {
  const issues: ValidationIssue[] = [];
  const blockedActivityIds = new Set<ActivityId>();
  const byId = new Map(
    input.activities.map((record) => [record.value.activityId, record] as const),
  );
  const adjacency = new Map<ActivityId, ActivityId[]>();
  const inDegree = new Map<ActivityId, number>();
  for (const activityId of byId.keys()) {
    adjacency.set(activityId, []);
    inDegree.set(activityId, 0);
  }

  for (const record of input.activities) {
    const activity = record.value;
    if (
      activity.constraintType === "must-start-on" ||
      activity.constraintType === "must-finish-on"
    ) {
      issues.push(
        issueAt(record, {
          severity: "warning",
          code: "hard_constraint",
          column: "constraint_type",
          suppliedValue: activity.constraintType,
          rule: "Hard constraints can conceal schedule flexibility.",
          suggestion: "Confirm the constraint is contractually justified.",
        }),
      );
    }

    for (const link of activity.predecessorLinks) {
      if (link.lagDays < 0) {
        issues.push(
          issueAt(record, {
            severity: "warning",
            code: "negative_lag",
            column: "predecessor_links",
            suppliedValue: String(link.lagDays),
            rule: "Negative predecessor lag can obscure overlapping logic.",
            suggestion: "Confirm and explain the lead or remodel the dependency.",
          }),
        );
      } else if (link.lagDays > 5) {
        issues.push(
          issueAt(record, {
            severity: "warning",
            code: "excessive_lag",
            column: "predecessor_links",
            suppliedValue: String(link.lagDays),
            rule: "Predecessor lag exceeds five working days.",
            suggestion: "Confirm the lag or model the waiting work explicitly.",
          }),
        );
      }

      if (link.activityId === activity.activityId) {
        blockedActivityIds.add(activity.activityId);
        issues.push(
          issueAt(record, {
            severity: "blocking",
            code: "self_link",
            column: "predecessor_links",
            suppliedValue: link.activityId,
            rule: "An activity cannot be its own predecessor.",
            suggestion: "Remove or correct the self-link.",
          }),
        );
        continue;
      }
      if (!byId.has(link.activityId)) {
        blockedActivityIds.add(activity.activityId);
        issues.push(
          issueAt(record, {
            severity: "blocking",
            code: "missing_predecessor",
            column: "predecessor_links",
            suppliedValue: link.activityId,
            rule: "Predecessor does not exist in the candidate schedule.",
            suggestion: "Correct the link or add the predecessor activity.",
          }),
        );
        continue;
      }

      adjacency.get(link.activityId)?.push(activity.activityId);
      inDegree.set(
        activity.activityId,
        (inDegree.get(activity.activityId) ?? 0) + 1,
      );
    }
  }

  const queue: ActivityId[] = [];
  const remainingInDegree = new Map(inDegree);
  for (const [activityId, degree] of remainingInDegree) {
    if (degree === 0) queue.push(activityId);
  }
  for (let index = 0; index < queue.length; index += 1) {
    const activityId = queue[index];
    if (activityId === undefined) continue;
    for (const successor of adjacency.get(activityId) ?? []) {
      const nextDegree = (remainingInDegree.get(successor) ?? 0) - 1;
      remainingInDegree.set(successor, nextDegree);
      if (nextDegree === 0) queue.push(successor);
    }
  }

  const remaining = [...remainingInDegree]
    .filter(([, degree]) => degree > 0)
    .map(([activityId]) => activityId);
  if (remaining.length > 0) {
    const components = stronglyConnectedComponents(remaining, adjacency);
    for (const component of components) {
      const isCycle =
        component.length > 1 ||
        (component[0] !== undefined &&
          (adjacency.get(component[0]) ?? []).includes(component[0]));
      if (!isCycle) continue;
      for (const activityId of component) blockedActivityIds.add(activityId);
      const sortedIds = [...component].sort();
      const source = sortedIds[0] === undefined ? undefined : byId.get(sortedIds[0]);
      if (source === undefined) continue;
      const path = exampleCyclePath(component, adjacency);
      issues.push(
        issueAt(source, {
          severity: "blocking",
          code: "schedule_cycle",
          column: "predecessor_links",
          suppliedValue: sortedIds.join(", "),
          rule:
            "Circular dependency detected: " +
            path.join(" → ") +
            ". Affected activities: " +
            sortedIds.join(", ") +
            ".",
          suggestion: "Break the circular dependency before importing.",
        }),
      );
    }
  }

  const authorisedStarts = new Set(input.configuration.authorisedStartActivityIds);
  const authorisedFinishes = new Set(input.configuration.authorisedFinishActivityIds);
  for (const record of input.activities) {
    const activityId = record.value.activityId;
    if (
      (inDegree.get(activityId) ?? 0) === 0 &&
      !authorisedStarts.has(activityId)
    ) {
      issues.push(
        issueAt(record, {
          severity: "warning",
          code: "open_start",
          column: "predecessor_links",
          suppliedValue: activityId,
          rule: "Activity has no accepted predecessor and is not an authorised start.",
          suggestion: "Add logic or authorise the project start activity.",
        }),
      );
    }
    if (
      (adjacency.get(activityId)?.length ?? 0) === 0 &&
      !authorisedFinishes.has(activityId)
    ) {
      issues.push(
        issueAt(record, {
          severity: "warning",
          code: "open_finish",
          column: "predecessor_links",
          suppliedValue: activityId,
          rule: "Activity has no accepted successor and is not an authorised finish.",
          suggestion: "Add logic or authorise the project finish activity.",
        }),
      );
    }
  }

  return { issues, blockedActivityIds };
}

export const validateScheduleGraph = (input: ScheduleGraphValidationInput) =>
  analyseScheduleGraph(input).issues;
