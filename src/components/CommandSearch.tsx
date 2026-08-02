import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { controlRoute, controlViews } from "../app/controlViews";
import { useProjectStore } from "../app/store";

interface CommandEntry {
  id: string;
  label: string;
  context: string;
  keywords: string;
  route: string;
}

const pageEntries = [
  ["page:overview", "Overview", "Page", "/"],
  ["page:import", "Import and data quality", "Page", "/import"],
  ["page:schedule", "Schedule and cost", "Page", "/schedule-cost"],
  ["page:milestones", "Milestones", "Page", "/milestones"],
  ["page:risks", "Risks", "Page", "/risks"],
  ["page:changes", "Changes", "Page", "/changes"],
  ["page:report", "Weekly report", "Page", "/report"],
  ["page:settings", "Settings and data", "Page", "/settings"],
] as const;

export function CommandSearch({
  scope,
  reportingDate,
}: {
  scope: string;
  reportingDate?: string;
}) {
  const navigate = useNavigate();
  const { milestones, risks, changes } = useProjectStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      return;
    }
    setQuery("");
    setActiveIndex(0);
  }, [open]);

  const entries = useMemo<CommandEntry[]>(() => {
    const context = (pathname: string, parameters?: Record<string, string>) =>
      controlRoute({ pathname, parameters, scope, reportingDate });
    const scopeMatches = (wbsId: string) => scope === "all" || wbsId === scope;

    return [
      ...pageEntries.map(([id, label, entryContext, pathname]) => ({
        id,
        label,
        context: entryContext,
        keywords: `${label} navigation page`,
        route: context(pathname),
      })),
      ...controlViews.map((view) => ({
        id: `view:${view.id}`,
        label: view.label,
        context: "Control view",
        keywords: `${view.label} ${view.description}`,
        route: context(view.pathname, view.parameters ? { ...view.parameters } : undefined),
      })),
      ...milestones.filter(({ wbsId }) => scopeMatches(wbsId)).map((record) => ({
        id: `milestone:${record.id}`,
        label: `${record.id} — ${record.name}`,
        context: "Milestone",
        keywords: `${record.id} ${record.name} ${record.owner} ${record.wbsId}`,
        route: context("/milestones", { record: record.id }),
      })),
      ...risks.filter(({ wbsId }) => scopeMatches(wbsId)).map((record) => ({
        id: `risk:${record.id}`,
        label: `${record.id} — ${record.title}`,
        context: "Risk",
        keywords: `${record.id} ${record.title} ${record.owner} ${record.wbsId} ${record.category}`,
        route: context("/risks", { record: record.id }),
      })),
      ...changes.filter(({ wbsId }) => scopeMatches(wbsId)).map((record) => ({
        id: `change:${record.id}`,
        label: `${record.id} — ${record.title}`,
        context: "Change",
        keywords: `${record.id} ${record.title} ${record.requester ?? ""} ${record.wbsId}`,
        route: context("/changes", { record: record.id }),
      })),
    ];
  }, [changes, milestones, reportingDate, risks, scope]);

  const filteredEntries = useMemo(() => {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = terms.length === 0
      ? entries
      : entries.filter((entry) => {
          const haystack = `${entry.label} ${entry.context} ${entry.keywords}`.toLocaleLowerCase();
          return terms.every((term) => haystack.includes(term));
        });
    return matches.slice(0, 9);
  }, [entries, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const choose = (entry: CommandEntry) => {
    setOpen(false);
    void navigate(entry.route);
  };

  const keepFocusInDialog = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusable === undefined || focusable.length === 0) return;
    const first = focusable.item(0);
    const last = focusable.item(focusable.length - 1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        className="command-trigger"
        type="button"
        aria-label="Find pages, control views and records"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        title="Find pages, control views and records (⌘K)"
        onClick={() => setOpen(true)}
      >
        <Search size={16} aria-hidden="true" />
        <span>Find</span>
        <kbd>⌘K</kbd>
      </button>
      {open ? createPortal(
        <div className="command-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <section
            ref={dialogRef}
            className="command-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-title"
            onKeyDown={keepFocusInDialog}
          >
            <header>
              <div>
                <p className="eyebrow">Keyboard navigation</p>
                <h2 id="command-title">Find a page, control view or record</h2>
              </div>
              <button type="button" aria-label="Close quick navigation" onClick={close}><X size={18} aria-hidden="true" /></button>
            </header>
            <label className="command-input">
              <span className="sr-only">Search pages, views and records</span>
              <Search size={18} aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                placeholder="Search by name, ID, owner or category"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.min(index + 1, filteredEntries.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((index) => Math.max(index - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    const selected = filteredEntries[activeIndex];
                    if (selected !== undefined) choose(selected);
                  } else if (event.key === "Escape") {
                    close();
                  }
                }}
              />
            </label>
            <div className="command-results" aria-live="polite">
              {filteredEntries.length === 0 ? (
                <p className="command-empty">No page, view or scoped record matches that search.</p>
              ) : (
                <ul>
                  {filteredEntries.map((entry, index) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className={index === activeIndex ? "is-active" : ""}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => choose(entry)}
                      >
                        <span><strong>{entry.label}</strong><small>{entry.context}</small></span>
                        <kbd>↵</kbd>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <footer>↑↓ move · Enter open · Esc close</footer>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
