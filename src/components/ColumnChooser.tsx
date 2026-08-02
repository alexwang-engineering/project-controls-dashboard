import { Columns3 } from "lucide-react";

export interface ConfigurableColumn {
  id: string;
  label: string;
}

export function ColumnChooser({
  columns,
  visible,
  onToggle,
}: {
  columns: readonly ConfigurableColumn[];
  visible: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <details className="column-chooser">
      <summary><Columns3 size={15} aria-hidden="true" /> Columns</summary>
      <fieldset>
        <legend className="sr-only">Visible table columns</legend>
        {columns.map((column) => (
          <label key={column.id}>
            <input
              type="checkbox"
              checked={visible.has(column.id)}
              aria-label={`Show ${column.label} column`}
              onChange={() => onToggle(column.id)}
            />
            {column.label} column
          </label>
        ))}
      </fieldset>
    </details>
  );
}
