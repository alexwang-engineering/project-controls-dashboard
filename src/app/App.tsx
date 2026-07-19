import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ActiveDatasetProvider } from "./ActiveDatasetContext";

const OverviewPage = lazy(() =>
  import("../features/overview/OverviewPage").then((module) => ({
    default: module.OverviewPage,
  })),
);
const ImportPage = lazy(() =>
  import("../features/import/ImportPage").then((module) => ({
    default: module.ImportPage,
  })),
);
const MilestonesPage = lazy(() =>
  import("../features/milestones/MilestonesPage").then((module) => ({
    default: module.MilestonesPage,
  })),
);
const RisksPage = lazy(() =>
  import("../features/risks/RisksPage").then((module) => ({
    default: module.RisksPage,
  })),
);
const ChangesPage = lazy(() =>
  import("../features/changes/ChangesPage").then((module) => ({
    default: module.ChangesPage,
  })),
);
const ScheduleCostPage = lazy(() =>
  import("../features/scheduleCost/ScheduleCostPage").then((module) => ({
    default: module.ScheduleCostPage,
  })),
);
const SettingsPage = lazy(() =>
  import("../features/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const ReportPage = lazy(() =>
  import("../features/report/ReportPage").then((module) => ({
    default: module.ReportPage,
  })),
);

export function App() {
  return (
    <ActiveDatasetProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="route-loading" role="status">
              Loading project controls view…
            </div>
          }
        >
          <Routes>
            <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="schedule-cost" element={<ScheduleCostPage />} />
            <Route path="milestones" element={<MilestonesPage />} />
            <Route path="risks" element={<RisksPage />} />
            <Route path="changes" element={<ChangesPage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ActiveDatasetProvider>
  );
}
