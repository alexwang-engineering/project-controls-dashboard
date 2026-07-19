import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ModulePage } from "../features/modules/ModulePage";
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
            <Route
              path="report"
              element={
                <ModulePage
                  eyebrow="M7 reporting"
                  title="Weekly management report"
                  description="Build a frozen, decision-first HTML snapshot from the same dashboard view model."
                  items={[
                    "Executive position and material movement",
                    "KPI, milestone, risk and change exceptions",
                    "Owned decisions and actions",
                    "Accessible HTML and secondary print output",
                  ]}
                  guide={{
                    purpose: "Use this planned workflow to turn the frozen dashboard snapshot into a concise weekly decision pack.",
                    steps: [
                      {
                        title: "Freeze the snapshot",
                        detail: "Select the reporting date and confirm the data-quality position.",
                      },
                      {
                        title: "Review exceptions",
                        detail: "Check the suggested narrative, decisions, actions, owners and due dates.",
                      },
                      {
                        title: "Publish and verify",
                        detail: "Generate accessible HTML first, then inspect the secondary PDF before sharing.",
                      },
                    ],
                  }}
                />
              }
            />
            <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ActiveDatasetProvider>
  );
}
