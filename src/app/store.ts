import { create } from "zustand";
import { demoSnapshot } from "../data/demo";

interface ProjectState {
  selectedWorkPackage: string;
  reportingDate: string;
  announcement: string;
  setSelectedWorkPackage: (workPackageId: string) => void;
  setReportingDate: (reportingDate: string) => void;
  reloadDemo: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  selectedWorkPackage: "all",
  reportingDate: demoSnapshot.project.reportingDate,
  announcement: "",
  setSelectedWorkPackage: (selectedWorkPackage) =>
    set({
      selectedWorkPackage,
      announcement:
        selectedWorkPackage === "all"
          ? "Showing the full project."
          : "Work-package filter applied.",
    }),
  setReportingDate: (reportingDate) =>
    set({
      reportingDate,
      announcement: "Reporting date updated.",
    }),
  reloadDemo: () =>
    set({
      selectedWorkPackage: "all",
      reportingDate: demoSnapshot.project.reportingDate,
      announcement: "Synthetic Aster demonstration data reloaded.",
    }),
}));
