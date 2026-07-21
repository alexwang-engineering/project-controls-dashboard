import {
  BarChart3,
  CalendarCheck2,
  ClipboardList,
  FileOutput,
  FolderInput,
  Gauge,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Split,
  Target,
  LockKeyhole,
} from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { deliveryProgress } from "../app/deliveryProgress";
import { useProjectStore } from "../app/store";
import { useProjectPerformance } from "../app/useProjectPerformance";
import { resolveWorkPackageScope } from "../domain/viewModels/projectPerformance";
import { formatDate } from "../utils/format";

const navigation = [
  { to: "/", label: "Overview", icon: Gauge, end: true },
  { to: "/import", label: "Import & quality", icon: FolderInput },
  { to: "/schedule-cost", label: "Schedule & cost", icon: BarChart3 },
  { to: "/milestones", label: "Milestones", icon: CalendarCheck2 },
  { to: "/risks", label: "Risks", icon: ShieldAlert },
  { to: "/changes", label: "Changes", icon: Split },
  { to: "/report", label: "Weekly report", icon: FileOutput },
  { to: "/settings", label: "Settings & data", icon: Settings2 },
];

export function AppShell() {
  const {
    announcement,
    selectedWorkPackage,
    setSelectedWorkPackage,
    repairSelectedWorkPackage,
    resetView,
  } = useProjectStore();
  const { snapshot, status, error } = useProjectPerformance();
  const { pathname } = useLocation();
  const hasActiveImport = snapshot?.source === "active-import";
  const effectiveScope = snapshot
    ? resolveWorkPackageScope(snapshot, selectedWorkPackage)
    : "all";
  const selectedPackage = snapshot?.workPackages.find(
    ({ id }) => id === effectiveScope,
  );
  const scopedPage = [
    "/",
    "/schedule-cost",
    "/milestones",
    "/risks",
    "/changes",
  ].includes(pathname);
  const reportPage = pathname === "/report";

  useEffect(() => {
    if (
      snapshot !== undefined &&
      selectedWorkPackage !== "all" &&
      effectiveScope === "all"
    ) {
      repairSelectedWorkPackage();
    }
  }, [
    effectiveScope,
    repairSelectedWorkPackage,
    selectedWorkPackage,
    snapshot,
  ]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">
            <ClipboardList size={22} />
          </div>
          <div>
            <span className="brand__name">Project Controls</span>
            <span className="brand__sub">Management workspace</span>
          </div>
        </div>

        <nav aria-label="Primary navigation" className="primary-nav">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                "nav-link" + (isActive ? " nav-link--active" : "")
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__project">
          <p className="sidebar__label">Current project</p>
          <strong>{snapshot?.project.name ?? "No project loaded"}</strong>
          <dl className="sidebar__meta">
            <div>
              <dt>Data date</dt>
              <dd>{snapshot ? formatDate(snapshot.project.reportingDate) : "Not available"}</dd>
            </div>
            <div>
              <dt>Baseline</dt>
              <dd>{snapshot?.project.baselineVersion ?? "Not available"}</dd>
            </div>
          </dl>
          <button className="button button--sidebar" type="button" onClick={resetView}>
            <RefreshCw size={16} aria-hidden="true" />
            Reset view
          </button>
        </div>
      </aside>

      <div className="workspace">
        <div className="workspace__topbar">
          <div>
            <span className="topbar__project">{snapshot?.project.name ?? "Project setup required"}</span>
            <span className="topbar__separator" aria-hidden="true">
              /
            </span>
            <span className="topbar__baseline">{snapshot ? `Baseline ${snapshot.project.baselineVersion}` : "Import schedule and performance data"}</span>
          </div>
          <div className="topbar__status">
            <div
              className="build-progress"
              aria-label={`Product build: ${deliveryProgress.productBuildPercent} percent. Release evidence: ${deliveryProgress.completionPercent} percent, based on ${deliveryProgress.evidencedPlanHours} of ${deliveryProgress.totalPlannedHours} evidence-weighted plan hours`}
            >
              <div className="build-progress__label">
                <span>Product build</span>
                <strong>{deliveryProgress.productBuildPercent}%</strong>
              </div>
              <progress
                max="100"
                value={deliveryProgress.productBuildPercent}
                aria-label="Product build progress"
              >
                {deliveryProgress.productBuildPercent}%
              </progress>
              <small>
                Release evidence {deliveryProgress.completionPercent}% · {deliveryProgress.evidencedPlanHours} / {deliveryProgress.totalPlannedHours} hours
              </small>
            </div>
            <div
              className={
                "data-quality " +
                (error
                  ? "data-quality--error"
                  : hasActiveImport
                    ? "data-quality--active"
                    : "data-quality--fallback")
              }
              aria-label={
                error
                  ? `Data source error: ${error}`
                  : status === "loading"
                    ? "Loading the active local dataset"
                    : hasActiveImport
                      ? `Active validated import ${snapshot?.importId ?? ""}`
                      : "No active import; project setup is required"
              }
              title={error ?? snapshot?.importId ?? "No active import"}
            >
              <span className="data-quality__dot" aria-hidden="true" />
              {status === "loading"
                ? "Loading data"
                : error
                  ? "Read error"
                  : hasActiveImport
                    ? "Active import"
                    : "Setup required"}
            </div>
          </div>
        </div>

        {snapshot !== undefined && scopedPage ? (
          <section className="global-scope-bar" aria-label="Global scope control">
            <div className="global-scope-bar__icon" aria-hidden="true">
              <Target size={18} />
            </div>
            <label htmlFor="global-work-package-scope">
              Global work package scope
              <select
                id="global-work-package-scope"
                value={effectiveScope}
                onChange={(event) =>
                  setSelectedWorkPackage(event.target.value)
                }
              >
                <option value="all">All work packages</option>
                {snapshot.workPackages.map((workPackage) => (
                  <option key={workPackage.id} value={workPackage.id}>
                    {workPackage.id} — {workPackage.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="global-scope-bar__context">
              <strong>
                {selectedPackage
                  ? `${selectedPackage.id} — ${selectedPackage.name}`
                  : "Full project"}
              </strong>
              <span>
                {pathname === "/changes"
                  ? "Register summaries follow this scope; the baseline control below always uses full-project evidence."
                  : selectedPackage
                    ? `${selectedPackage.owner} owns this control account. The scope follows you across management views.`
                    : "Every accepted work package and matching register record is included."}
              </span>
            </div>
            {effectiveScope !== "all" ? (
              <button
                className="button button--secondary global-scope-bar__clear"
                type="button"
                onClick={() => setSelectedWorkPackage("all")}
              >
                Clear scope
              </button>
            ) : null}
          </section>
        ) : null}

        {snapshot !== undefined && reportPage ? (
          <section
            className="global-scope-bar global-scope-bar--locked"
            aria-label="Publication scope boundary"
          >
            <div className="global-scope-bar__icon" aria-hidden="true">
              <LockKeyhole size={18} />
            </div>
            <div className="global-scope-bar__context">
              <strong>Full project</strong>
              <span>
                Weekly publications always use the complete project evidence.
                {selectedPackage
                  ? ` ${selectedPackage.id} is paused here and resumes when you leave reporting.`
                  : " No work-package view filter is applied."}
              </span>
            </div>
          </section>
        ) : null}

        <main id="main-content" className="main-content" tabIndex={-1}>
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
