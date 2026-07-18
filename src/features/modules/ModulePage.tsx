import { CheckCircle2, Clock3 } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { PageGuide, type PageGuideProps } from "../../components/PageGuide";

interface ModulePageProps {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
  guide: Omit<PageGuideProps, "pageName" | "state">;
}

export function ModulePage({
  eyebrow,
  title,
  description,
  items,
  guide,
}: ModulePageProps) {
  return (
    <div className="page-stack">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <PageGuide
        pageName={title}
        purpose={guide.purpose}
        steps={guide.steps}
        state="Planned workflow"
      />

      <section className="panel module-roadmap" aria-labelledby="module-scope-title">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Defined delivery scope</p>
            <h2 id="module-scope-title">Next implementation target</h2>
          </div>
          <span className="delivery-state">
            <Clock3 size={16} aria-hidden="true" /> Planned
          </span>
        </div>
        <p className="module-roadmap__intro">
          The calculation engine and synthetic demonstration dataset are ready.
          This module is sequenced next so it can reuse the same validated data
          and audit rules.
        </p>
        <ul className="scope-list">
          {items.map((item) => (
            <li key={item}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
