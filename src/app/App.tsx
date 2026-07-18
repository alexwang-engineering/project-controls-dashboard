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
                  guide={{
                    purpose: "Use this planned workflow to prove data quality before anything replaces the active dataset.",
                    steps: [
                      {
                        title: "Prepare files",
                        detail: "Choose synthetic schedule and performance CSV files for the same reporting period.",
                      },
                      {
                        title: "Resolve validation",
                        detail: "Review blocking errors, warnings and quarantined rows before continuing.",
                      },
                      {
                        title: "Commit deliberately",
                        detail: "Confirm registries and duplicates; a failed commit must preserve the active dataset.",
                      },
                    ],
                  }}
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
                  guide={{
                    purpose: "Use this planned view to move from project-level variance to the work package and source record that needs action.",
                    steps: [
                      {
                        title: "Set the scope",
                        detail: "Choose the reporting date and work package you want to investigate.",
                      },
                      {
                        title: "Compare performance",
                        detail: "Read PV, EV and AC together; SPI or CPI below 1.00 is adverse.",
                      },
                      {
                        title: "Trace the cause",
                        detail: "Open the affected period and activity, then assign a corrective action and owner.",
                      },
                    ],
                  }}
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
                  guide={{
                    purpose: "Use this planned page to keep local data recoverable, versioned and clearly separated from real project information.",
                    steps: [
                      {
                        title: "Check storage",
                        detail: "Review local usage, persistence, schema and calculation versions.",
                      },
                      {
                        title: "Create a backup",
                        detail: "Export a versioned backup before imports or structural changes.",
                      },
                      {
                        title: "Restore safely",
                        detail: "Validate and preview a backup before it is allowed to replace active data.",
                      },
                    ],
                  }}
                />
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
