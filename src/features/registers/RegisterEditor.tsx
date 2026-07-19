import type { FormEvent, ReactNode } from "react";

export function RegisterEditor({
  title,
  description,
  submitLabel,
  error,
  onCancel,
  onSubmit,
  children,
}: {
  title: string;
  description: string;
  submitLabel: string;
  error: string;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  const headingId = `register-editor-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="panel register-editor" aria-labelledby={headingId}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Controlled input</p>
          <h2 id={headingId}>{title}</h2>
          <p className="panel__description">{description}</p>
        </div>
      </div>
      <form onSubmit={onSubmit}>
        <div className="register-form-grid">{children}</div>
        {error ? <p className="register-form-error" role="alert">{error}</p> : null}
        <div className="register-form-actions">
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
          <button className="button button--primary" type="submit">{submitLabel}</button>
        </div>
      </form>
    </section>
  );
}
