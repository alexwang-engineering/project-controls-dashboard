import { create } from "zustand";
import type {
  RiskAppetiteRevision,
  RiskAppetiteThresholds,
} from "../domain/riskAppetite";
import { defaultRiskAppetite } from "../domain/riskAppetite";
import type { ChangeRequest, Milestone, Risk } from "../domain/types";
import { canDeleteChange } from "../domain/changes";
import { getBrowserRepositories } from "../repositories/browserRepositories";
import type {
  ManagementRegisterRevisionReason,
  ManagementRegisterSnapshot,
} from "../repositories/managementRegisterRepository";

interface RegisterState {
  milestones: Milestone[];
  risks: Risk[];
  changes: ChangeRequest[];
}

export interface SaveRiskAppetiteInput {
  thresholds: RiskAppetiteThresholds;
  changeReason: string;
  authorisedBy: string;
  effectiveFrom: string;
  confirmed: boolean;
}

type PersistenceStatus = "idle" | "loading" | "saving" | "saved" | "error";

interface ProjectState extends RegisterState {
  selectedWorkPackage: string;
  reportingDate: string;
  announcement: string;
  registerProjectId?: string;
  registerRevision: number;
  registerPersistenceStatus: PersistenceStatus;
  registerPersistenceError?: string;
  riskAppetite: RiskAppetiteThresholds;
  riskAppetiteRevision: number;
  riskAppetiteHistory: readonly RiskAppetiteRevision[];
  setSelectedWorkPackage: (workPackageId: string) => void;
  repairSelectedWorkPackage: () => void;
  setReportingDate: (reportingDate: string) => void;
  resetView: () => void;
  upsertMilestone: (milestone: Milestone) => void;
  mergeMilestones: (milestones: readonly Milestone[]) => void;
  removeMilestone: (id: string) => void;
  upsertRisk: (risk: Risk) => void;
  removeRisk: (id: string) => void;
  upsertChange: (change: ChangeRequest) => void;
  removeChange: (id: string) => void;
  replaceRegisters: (registers: RegisterState) => void;
  clearRegisters: () => void;
  saveRiskAppetite: (input: SaveRiskAppetiteInput) => Promise<void>;
}

const emptyRegisters = (): RegisterState => ({
  milestones: [],
  risks: [],
  changes: [],
});

const upsertById = <RecordType extends { id: string }>(
  records: readonly RecordType[],
  record: RecordType,
) =>
  [...records.filter(({ id }) => id !== record.id), record].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

export const migrateProjectStoreState = (
  persistedState: unknown,
  _persistedVersion: number,
) => {
  if (persistedState !== null && typeof persistedState === "object") {
    return persistedState;
  }
  return emptyRegisters();
};

const persistenceEnabled = import.meta.env.MODE !== "test";
let registerWriteQueue: Promise<void> = Promise.resolve();
let registerPersistenceEpoch = 0;

const snapshotFromState = (state: ProjectState): ManagementRegisterSnapshot => ({
  milestones: state.milestones,
  risks: state.risks,
  changes: state.changes,
});

const scheduleRegisterPersistence = (
  reason: ManagementRegisterRevisionReason,
) => {
  if (!persistenceEnabled) return;
  const projectId = useProjectStore.getState().registerProjectId;
  if (projectId === undefined) return;
  const candidate = snapshotFromState(useProjectStore.getState());
  const persistenceEpoch = registerPersistenceEpoch;
  useProjectStore.setState({
    registerPersistenceStatus: "saving",
    registerPersistenceError: undefined,
  });
  registerWriteQueue = registerWriteQueue
    .then(async () => {
      if (persistenceEpoch !== registerPersistenceEpoch) return;
      const expectedRevision = useProjectStore.getState().registerRevision;
      const committed = await getBrowserRepositories().managementRegisters.commitSnapshot(
        projectId,
        candidate,
        {
          expectedRevision,
          recordedAt: new Date().toISOString(),
          reason,
        },
      );
      if (useProjectStore.getState().registerProjectId !== projectId) return;
      useProjectStore.setState({
        registerRevision: committed.revision,
        registerPersistenceStatus: "saved",
        registerPersistenceError: undefined,
      });
    })
    .catch((error: unknown) => {
      useProjectStore.setState({
        registerPersistenceStatus: "error",
        registerPersistenceError:
          error instanceof Error
            ? error.message
            : "The management-register revision could not be saved.",
      });
    });
};

const legacyRegisters = (): RegisterState | undefined => {
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem("project-controls-management-registers-v1");
  if (raw === null) return undefined;
  try {
    const envelope = JSON.parse(raw) as { state?: unknown; version?: number };
    const migrated = migrateProjectStoreState(
      envelope.state,
      envelope.version ?? 0,
    ) as Partial<RegisterState>;
    if (
      !Array.isArray(migrated.milestones) ||
      !Array.isArray(migrated.risks) ||
      !Array.isArray(migrated.changes)
    ) {
      return undefined;
    }
    return {
      milestones: migrated.milestones,
      risks: migrated.risks,
      changes: migrated.changes,
    };
  } catch {
    return undefined;
  }
};

export const useProjectStore = create<ProjectState>()((set) => ({
  selectedWorkPackage: "all",
  reportingDate: "",
  announcement: "",
  ...emptyRegisters(),
  registerRevision: 0,
  registerPersistenceStatus: "idle",
  riskAppetite: defaultRiskAppetite,
  riskAppetiteRevision: 0,
  riskAppetiteHistory: [],
  setSelectedWorkPackage: (selectedWorkPackage) =>
    set({
      selectedWorkPackage,
      announcement:
        selectedWorkPackage === "all"
          ? "Global scope reset to the full project."
          : `Global scope changed to ${selectedWorkPackage}.`,
    }),
  repairSelectedWorkPackage: () =>
    set({
      selectedWorkPackage: "all",
      announcement:
        "Global scope reset because the selected work package is not in the active project.",
    }),
  setReportingDate: (reportingDate) =>
    set({ reportingDate, announcement: "Reporting date updated." }),
  resetView: () =>
    set({
      selectedWorkPackage: "all",
      reportingDate: "",
      announcement: "View filters reset.",
    }),
  upsertMilestone: (milestone) => {
    set((state) => ({
      milestones: upsertById(state.milestones, milestone),
      announcement: `Milestone ${milestone.id} saved.`,
    }));
    scheduleRegisterPersistence("user-update");
  },
  mergeMilestones: (milestones) => {
    set((state) => ({
      milestones: milestones.reduce(
        (records, milestone) => upsertById(records, milestone),
        state.milestones,
      ),
      announcement: `${String(milestones.length)} schedule-linked milestone record${milestones.length === 1 ? "" : "s"} synchronised.`,
    }));
    scheduleRegisterPersistence("schedule-sync");
  },
  removeMilestone: (id) => {
    set((state) => ({
      milestones: state.milestones.filter((record) => record.id !== id),
      announcement: `Milestone ${id} removed.`,
    }));
    scheduleRegisterPersistence("user-update");
  },
  upsertRisk: (risk) => {
    set((state) => ({
      risks: upsertById(state.risks, risk),
      announcement: `Risk ${risk.id} saved.`,
    }));
    scheduleRegisterPersistence("user-update");
  },
  removeRisk: (id) => {
    set((state) => ({
      risks: state.risks.filter((record) => record.id !== id),
      announcement: `Risk ${id} removed.`,
    }));
    scheduleRegisterPersistence("user-update");
  },
  upsertChange: (change) => {
    set((state) => ({
      changes: upsertById(state.changes, change),
      announcement: `Change ${change.id} saved.`,
    }));
    scheduleRegisterPersistence("user-update");
  },
  removeChange: (id) => {
    let removed = false;
    set((state) => {
      const change = state.changes.find((record) => record.id === id);
      if (change !== undefined && !canDeleteChange(change)) {
        return {
          announcement: `Change ${id} is controlled and cannot be deleted.`,
        };
      }
      removed = true;
      return {
        changes: state.changes.filter((record) => record.id !== id),
        announcement: `Change ${id} removed.`,
      };
    });
    if (removed) scheduleRegisterPersistence("user-update");
  },
  replaceRegisters: ({ milestones, risks, changes }) => {
    set({
      milestones: [...milestones],
      risks: [...risks],
      changes: [...changes],
    });
    scheduleRegisterPersistence("restore");
  },
  clearRegisters: () => {
    set({
      ...emptyRegisters(),
      announcement: "Management registers cleared.",
    });
    scheduleRegisterPersistence("user-update");
  },
  saveRiskAppetite: async (input) => {
    const state = useProjectStore.getState();
    if (state.registerProjectId === undefined) {
      throw new Error("Import project data before setting project risk appetite.");
    }
    const committed = await getBrowserRepositories().riskAppetite.commitRevision({
      projectId: state.registerProjectId,
      expectedRevision: state.riskAppetiteRevision,
      thresholds: input.thresholds,
      changeReason: input.changeReason,
      authorisedBy: input.authorisedBy,
      effectiveFrom: input.effectiveFrom,
      recordedAt: new Date().toISOString(),
      confirmed: input.confirmed,
    });
    const history = await getBrowserRepositories().riskAppetite.loadHistory(
      state.registerProjectId,
    );
    set({
      riskAppetite: committed.thresholds,
      riskAppetiteRevision: committed.revision,
      riskAppetiteHistory: history,
      announcement: `Risk appetite revision ${String(committed.revision)} saved.`,
    });
  },
}));

export async function loadProjectManagementControls(
  projectId: string | undefined,
): Promise<void> {
  if (!persistenceEnabled) return;
  await registerWriteQueue;
  if (projectId === undefined) {
    useProjectStore.setState({
      ...emptyRegisters(),
      registerProjectId: undefined,
      registerRevision: 0,
      registerPersistenceStatus: "idle",
      registerPersistenceError: undefined,
      riskAppetite: defaultRiskAppetite,
      riskAppetiteRevision: 0,
      riskAppetiteHistory: [],
    });
    return;
  }

  useProjectStore.setState({
    registerProjectId: projectId,
    registerPersistenceStatus: "loading",
    registerPersistenceError: undefined,
  });
  try {
    const repositories = getBrowserRepositories();
    let current = await repositories.managementRegisters.loadCurrent(projectId);
    if (current === undefined) {
      const legacy = legacyRegisters();
      if (
        legacy !== undefined &&
        (legacy.milestones.length > 0 ||
          legacy.risks.length > 0 ||
          legacy.changes.length > 0)
      ) {
        current = await repositories.managementRegisters.commitSnapshot(
          projectId,
          legacy,
          {
            expectedRevision: 0,
            recordedAt: new Date().toISOString(),
            reason: "legacy-migration",
          },
        );
        localStorage.removeItem("project-controls-management-registers-v1");
      }
    }
    const appetiteHistory = await repositories.riskAppetite.loadHistory(projectId);
    const appetite = appetiteHistory[0];
    const snapshot = current?.snapshot;
    useProjectStore.setState({
      milestones: snapshot === undefined ? [] : [...snapshot.milestones],
      risks: snapshot === undefined ? [] : [...snapshot.risks],
      changes: snapshot === undefined ? [] : [...snapshot.changes],
      registerProjectId: projectId,
      registerRevision: current?.revision ?? 0,
      registerPersistenceStatus: "saved",
      registerPersistenceError: undefined,
      riskAppetite: appetite?.thresholds ?? defaultRiskAppetite,
      riskAppetiteRevision: appetite?.revision ?? 0,
      riskAppetiteHistory: appetiteHistory,
    });
  } catch (error) {
    useProjectStore.setState({
      ...emptyRegisters(),
      registerProjectId: projectId,
      registerRevision: 0,
      registerPersistenceStatus: "error",
      registerPersistenceError:
        error instanceof Error
          ? error.message
          : "The project management controls could not be loaded.",
      riskAppetite: defaultRiskAppetite,
      riskAppetiteRevision: 0,
      riskAppetiteHistory: [],
    });
  }
}

export function resetProjectManagementControlsRuntime(): void {
  registerPersistenceEpoch += 1;
  registerWriteQueue = Promise.resolve();
  useProjectStore.setState({
    ...emptyRegisters(),
    registerProjectId: undefined,
    registerRevision: 0,
    registerPersistenceStatus: "idle",
    registerPersistenceError: undefined,
    riskAppetite: defaultRiskAppetite,
    riskAppetiteRevision: 0,
    riskAppetiteHistory: [],
    announcement: "Management registers and risk appetite cleared.",
  });
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("project-controls-management-registers-v1");
  }
}
