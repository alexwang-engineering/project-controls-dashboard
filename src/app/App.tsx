import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ModulePage } from "../features/modules/ModulePage";

const OverviewPage = lazy(() =>
  import("../features/overview/OverviewPage").then((module) => ({
    default: module.OverviewPage,
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

export function App() {
  return (
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
            <Route
              path="import"
              element={
                <ModulePage
                  eyebrow="M1 data foundation"
                  title="Import and data quality"
                  description="Validate schedule and performance files before an atomic commit."
                  items={[
                    "RFC-compatible CSV parsing",
                    "Row and field validation",
                    "Schedule-logic health checks",
                    "Import manifest and checksum",
                  ]}
                />
              }
            />
            <Route
              path="schedule-cost"
              element={
                <ModulePage
                  eyebrow="M2-M3 performance"
                  title="Schedule and cost"
                  description="Trace project and work-package performance from headline variance to source records."
                  items={[
                    "Periodic and cumulative PV, EV and AC",
                    "EAC sensitivity and TCPI",
                    "Structured variance analysis",
                    "Activity and reporting-period trace",
                  ]}
                />
              }
            />
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
                />
              }
            />
            <Route
              path="settings"
              element={
                <ModulePage
                  eyebrow="Data lifecycle"
                  title="Settings and data"
                  description="Inspect local storage, schema versions, backup state and demonstration controls."
                  items={[
                    "Local usage and persistence status",
                    "Versioned backup and restore",
                    "Calculation and schema versions",
                    "Synthetic-data privacy boundary",
                  ]}
                />
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
