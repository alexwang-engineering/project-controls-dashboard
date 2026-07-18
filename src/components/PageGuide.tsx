import { BookOpenCheck } from "lucide-react";

export interface PageGuideStep {
  title: string;
  detail: string;
}

export interface PageGuideProps {
  pageName: string;
  purpose: string;
  steps: readonly [PageGuideStep, PageGuideStep, PageGuideStep];
  state?: "Demo ready" | "Planned workflow";
}

export function PageGuide({
  pageName,
  purpose,
  steps,
  state = "Demo ready",
}: PageGuideProps) {
  return (
    <section className="page-guide" aria-label={`How to use ${pageName}`}>
      <div className="page-guide__intro">
        <div className="page-guide__title-row">
          <BookOpenCheck size={19} aria-hidden="true" />
          <h2>How to use this page</h2>
        </div>
        <p>{purpose}</p>
        <span
          className={
            "page-guide__state" +
            (state === "Planned workflow" ? " page-guide__state--planned" : "")
          }
        >
          {state}
        </span>
      </div>

      <ol className="page-guide__steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="page-guide__number" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
