import { Pencil, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export interface InspectionFact {
  label: string;
  value: ReactNode;
}

export function RecordInspectionPanel({
  kind,
  title,
  description,
  facts,
  onClose,
  onEdit,
}: {
  kind: string;
  title: string;
  description: string;
  facts: readonly InspectionFact[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const headingId = `inspection-${kind.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [title]);

  const closeAndRestoreFocus = () => {
    onClose();
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("#main-content")?.focus();
    });
  };

  return (
    <aside
      ref={panelRef}
      className="record-inspection"
      role="region"
      aria-labelledby={headingId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") closeAndRestoreFocus();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">Governed record inspection</p>
          <span>{kind}</span>
          <h2 id={headingId}>{title}</h2>
        </div>
        <button type="button" aria-label={`Close ${kind} inspection`} onClick={closeAndRestoreFocus}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <p className="record-inspection__description">{description}</p>
      <dl className="record-inspection__facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <footer>
        <p>Inspection is read-only. Enter edit mode deliberately to change the governed record.</p>
        <button className="button button--primary" type="button" onClick={onEdit}>
          <Pencil size={16} aria-hidden="true" /> Edit record
        </button>
      </footer>
    </aside>
  );
}
