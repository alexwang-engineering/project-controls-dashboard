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
import { NavLink, Outlet, useLocation, useSearchParams } from "react-router";
import { useProjectStore } from "../app/store";
import { useProjectPerformance } from "../app/useProjectPerformance";
import { resolveWorkPackageScope } from "../domain/viewModels/projectPerformance";
import { formatDate } from "../utils/format";
import { CommandSearch } from "./CommandSearch";
import { ControlViewBar } from "./ControlViewBar";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const searchState = searchParams.toString();
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
  const controlViewPage = scopedPage || pathname === "/import";

  useEffect(() => {
    if (snapshot === undefined) return;
    const nextParams = new URLSearchParams(searchState);
    const requestedScope = nextParams.get("scope");
    const scopeIsValid =
      requestedScope === null ||
      requestedScope === "all" ||
      snapshot.workPackages.some(({ id }) => id === requestedScope);
    let changed = false;

    if (!scopeIsValid) {
      nextParams.delete("scope");
      repairSelectedWorkPackage();
      changed = true;
    } else if (requestedScope !== null && requestedScope !== selectedWorkPackage) {
      setSelectedWorkPackage(requestedScope);
    } else if (requestedScope === null && selectedWorkPackage !== "all") {
      nextParams.set("scope", selectedWorkPackage);
      changed = true;
    }

    if (nextParams.get("date") !== snapshot.project.reportingDate) {
      nextParams.set("date", snapshot.project.reportingDate);
      changed = true;
    }

    if (changed) setSearchParams(nextParams, { replace: true });
  }, [
    repairSelectedWorkPackage,
    searchState,
    selectedWorkPackage,
    setSearchParams,
    setSelectedWorkPackage,
    snapshot,
  ]);

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

  const contextSearch = (() => {
    if (snapshot === undefined) return "";
    const context = new URLSearchParams();
    context.set("date", snapshot.project.reportingDate);
    if (effectiveScope !== "all") context.set("scope", effectiveScope);
    return `?${context.toString()}`;
  })();

  const updateScope = (scope: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (scope === "all") nextParams.delete("scope");
    else nextParams.set("scope", scope);
    if (snapshot !== undefined) {
      nextParams.set("date", snapshot.project.reportingDate);
    }
    setSearchParams(nextParams);
    setSelectedWorkPackage(scope);
  };

  const clearView = () => {
    const nextParams = new URLSearchParams();
    if (snapshot !== undefined) {
      nextParams.set("date", snapshot.project.reportingDate);
    }
    setSearchParams(nextParams);
    resetView();
  };

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
              to={{ pathname: to, search: contextSearch }}
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
          <button className="button button--sidebar" type="button" onClick={clearView}>
            <RefreshCw size={16} aria-hidden="true" />
            Clear filters &amp; scope
          </button>
        </div>
      </aside>

      <div className="workspace">
        <div className="workspace__topbar">
          <div>
            <span className="topbar__project">{snapshot?.project.name ?? "Project setup required"}</span>
            <span className="topbar__separator" aria-hidden="true">·</span>
            {snapshot ? (
              <span className="topbar__baseline">
                Baseline {snapshot.project.baselineVersion} · Data date {formatDate(snapshot.project.reportingDate)}
              </span>
            ) : (
              <span className="topbar__baseline">Import schedule and performance data</span>
            )}
          </div>
          <div className="topbar__status">
            <CommandSearch
              scope={effectiveScope}
              reportingDate={snapshot?.project.reportingDate}
            />
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
                onChange={(event) => updateScope(event.target.value)}
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
                onClick={() => updateScope("all")}
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

        {snapshot !== undefined && controlViewPage ? (
          <ControlViewBar
            scope={effectiveScope}
            reportingDate={snapshot.project.reportingDate}
          />
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
