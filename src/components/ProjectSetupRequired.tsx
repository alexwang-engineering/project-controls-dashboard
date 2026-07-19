import { ArrowRight, FolderInput } from "lucide-react";
import { Link } from "react-router-dom";

export function ProjectSetupRequired({
  title = "Import project data to continue",
  detail = "Choose matching schedule and periodic-performance CSV files. The dashboard will remain empty until both files pass validation and are committed.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <section className="panel project-setup" aria-labelledby="project-setup-title">
      <div className="project-setup__icon" aria-hidden="true"><FolderInput size={26} /></div>
      <div>
        <p className="eyebrow">No active project</p>
        <h2 id="project-setup-title">{title}</h2>
        <p>{detail}</p>
      </div>
      <Link className="button button--primary" to="/import">Open data input <ArrowRight size={17} aria-hidden="true" /></Link>
    </section>
  );
}
