import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ChangeRequest, Milestone, Risk } from "../domain/types";
import { canDeleteChange } from "../domain/changes";

interface RegisterState {
  milestones: Milestone[];
  risks: Risk[];
  changes: ChangeRequest[];
}

interface ProjectState extends RegisterState {
  selectedWorkPackage: string;
  reportingDate: string;
  announcement: string;
  setSelectedWorkPackage: (workPackageId: string) => void;
  setReportingDate: (reportingDate: string) => void;
  resetView: () => void;
  upsertMilestone: (milestone: Milestone) => void;
  removeMilestone: (id: string) => void;
  upsertRisk: (risk: Risk) => void;
  removeRisk: (id: string) => void;
  upsertChange: (change: ChangeRequest) => void;
  removeChange: (id: string) => void;
  replaceRegisters: (registers: RegisterState) => void;
  clearRegisters: () => void;
}

const upsertById = <RecordType extends { id: string }>(
  records: readonly RecordType[],
  record: RecordType,
) =>
  [...records.filter(({ id }) => id !== record.id), record].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      selectedWorkPackage: "all",
      reportingDate: "",
      announcement: "",
      milestones: [],
      risks: [],
      changes: [],
      setSelectedWorkPackage: (selectedWorkPackage) =>
        set({
          selectedWorkPackage,
          announcement:
            selectedWorkPackage === "all"
              ? "Showing the full project."
              : "Work-package filter applied.",
        }),
      setReportingDate: (reportingDate) =>
        set({ reportingDate, announcement: "Reporting date updated." }),
      resetView: () =>
        set({
          selectedWorkPackage: "all",
          reportingDate: "",
          announcement: "View filters reset.",
        }),
      upsertMilestone: (milestone) =>
        set((state) => ({
          milestones: upsertById(state.milestones, milestone),
          announcement: `Milestone ${milestone.id} saved.`,
        })),
      removeMilestone: (id) =>
        set((state) => ({
          milestones: state.milestones.filter((record) => record.id !== id),
          announcement: `Milestone ${id} removed.`,
        })),
      upsertRisk: (risk) =>
        set((state) => ({
          risks: upsertById(state.risks, risk),
          announcement: `Risk ${risk.id} saved.`,
        })),
      removeRisk: (id) =>
        set((state) => ({
          risks: state.risks.filter((record) => record.id !== id),
          announcement: `Risk ${id} removed.`,
        })),
      upsertChange: (change) =>
        set((state) => ({
          changes: upsertById(state.changes, change),
          announcement: `Change ${change.id} saved.`,
        })),
      removeChange: (id) =>
        set((state) => {
          const change = state.changes.find((record) => record.id === id);
          if (change !== undefined && !canDeleteChange(change)) {
            return {
              announcement: `Change ${id} is controlled and cannot be deleted.`,
            };
          }
          return {
            changes: state.changes.filter((record) => record.id !== id),
            announcement: `Change ${id} removed.`,
          };
        }),
      replaceRegisters: ({ milestones, risks, changes }) =>
        set({ milestones: [...milestones], risks: [...risks], changes: [...changes] }),
      clearRegisters: () =>
        set({
          milestones: [],
          risks: [],
          changes: [],
          announcement: "Management registers cleared.",
        }),
    }),
    {
      name: "project-controls-management-registers-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        milestones: state.milestones,
        risks: state.risks,
        changes: state.changes,
      }),
    },
  ),
);
