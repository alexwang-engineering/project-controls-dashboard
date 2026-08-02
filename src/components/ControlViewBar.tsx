import { Bookmark } from "lucide-react";
import { Link, useLocation } from "react-router";
import { controlRoute, controlViews } from "../app/controlViews";

export function ControlViewBar({
  scope,
  reportingDate,
}: {
  scope: string;
  reportingDate?: string;
}) {
  const location = useLocation();
  const currentSearch = new URLSearchParams(location.search);
  return (
    <nav className="control-view-bar" aria-label="Saved control views">
      <span className="control-view-bar__label">
        <Bookmark size={15} aria-hidden="true" /> Control views
      </span>
      <div className="control-view-bar__links">
        {controlViews.map((view) => (
          <Link
            key={view.id}
            to={controlRoute({
              pathname: view.pathname,
              parameters: view.parameters,
              scope,
              reportingDate,
            })}
            title={view.description}
            aria-current={
              location.pathname === view.pathname &&
              Object.entries(view.parameters ?? {}).every(
                ([key, value]) => currentSearch.get(key) === value,
              )
                ? "page"
                : undefined
            }
          >
            {view.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
