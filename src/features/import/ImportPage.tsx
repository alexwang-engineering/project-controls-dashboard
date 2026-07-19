import {
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { useActiveDataset } from "../../app/ActiveDatasetContext";
import { PageGuide } from "../../components/PageGuide";
import { PageHeader } from "../../components/PageHeader";
import { getBrowserRepositories } from "../../repositories/browserRepositories";
import { PERFORMANCE_CSV_HEADERS } from "../../schemas/performanceCsv";
import { SCHEDULE_CSV_HEADERS } from "../../schemas/scheduleCsv";
import type { ImportManifest } from "../../schemas/manifest";
import type { ValidationIssue } from "../../schemas/validationIssue";
import { encodeCsv } from "../../utils/safeCsvExport";
import {
  buildValidationReportCsv,
  commitImportReview,
  reviewImportFiles,
  type ImportReview,
} from "./importWorkflow";

export interface ImportPageDependencies {
  reviewFiles: (schedule: File, performance: File) => Promise<ImportReview>;
  commitReview: (
    review: ImportReview,
    options: {
      configurationConfirmed: boolean;
      duplicateChecksumConfirmed: boolean;
    },
  ) => Promise<ImportManifest>;
  updateConfiguration: (review: ImportReview) => Promise<void>;
  downloadIssues: (issues: readonly ValidationIssue[]) => void;
}

const downloadIssues = (issues: readonly ValidationIssue[]) => {
  const blob = new Blob([buildValidationReportCsv(issues)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "project-controls-validation-report.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const downloadBlankTemplate = (
  headers: readonly string[],
  fileName: string,
) => {
  const csv = encodeCsv([headers], {
    columnTrust: headers.map(() => "trusted-scalar" as const),
  });
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const defaultDependencies: ImportPageDependencies = {
  reviewFiles: (schedule, performance) => {
    const repositories = getBrowserRepositories();
    return reviewImportFiles(schedule, performance, repositories);
  },
  commitReview: (review, options) =>
    commitImportReview(review, options, getBrowserRepositories().imports),
  updateConfiguration: async (review) => {
    if (review.configurationUpdate === undefined) {
      throw new Error("There is no project-registry update to apply.");
    }
    await getBrowserRepositories().configurations.commitAdditiveUpdate(
      review.configurationUpdate,
      { confirmed: true, updatedAt: new Date().toISOString() },
    );
  },
  downloadIssues,
};

const fileSize = (bytes: number) => {
  if (bytes < 1024) return String(bytes) + " B";
  return (bytes / 1024).toFixed(1) + " KB";
};

interface ImportFileFieldProps {
  id: string;
  label: string;
  description: string;
  file?: File;
  onChange: (file?: File) => void;
}

function ImportFileField({
  id,
  label,
  description,
  file,
  onChange,
}: ImportFileFieldProps) {
  return (
    <div className={"import-file" + (file ? " import-file--selected" : "")}>
      <div className="import-file__icon" aria-hidden="true">
        {file ? <FileCheck2 size={23} /> : <FileSpreadsheet size={23} />}
      </div>
      <div className="import-file__body">
        <label htmlFor={id}>{label}</label>
        <p>{description}</p>
        {file ? (
          <div className="import-file__selection">
            <strong>{file.name}</strong>
            <span>{fileSize(file.size)}</span>
          </div>
        ) : null}
        <input
          id={id}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => onChange(event.target.files?.[0])}
        />
      </div>
    </div>
  );
}

const severityOrder: Record<ValidationIssue["severity"], number> = {
  blocking: 0,
  warning: 1,
  information: 2,
};

const locationFor = (issue: ValidationIssue) =>
  [
    issue.fileName,
    issue.recordNumber === undefined
      ? undefined
      : "record " + String(issue.recordNumber),
    issue.physicalLineStart === undefined
      ? undefined
      : "line " + String(issue.physicalLineStart),
  ]
    .filter((item): item is string => item !== undefined)
    .join(" · ");

export function ImportPage({
  dependencies = defaultDependencies,
}: {
  dependencies?: ImportPageDependencies;
}) {
  const { refresh } = useActiveDataset();
  const [scheduleFile, setScheduleFile] = useState<File>();
  const [performanceFile, setPerformanceFile] = useState<File>();
  const [review, setReview] = useState<ImportReview>();
  const [committed, setCommitted] = useState<ImportManifest>();
  const [isReviewing, setIsReviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isUpdatingRegistry, setIsUpdatingRegistry] = useState(false);
  const [configurationConfirmed, setConfigurationConfirmed] = useState(false);
  const [registryUpdateConfirmed, setRegistryUpdateConfirmed] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const resetReview = () => {
    setReview(undefined);
    setCommitted(undefined);
    setConfigurationConfirmed(false);
    setRegistryUpdateConfirmed(false);
    setDuplicateConfirmed(false);
    setErrorMessage("");
  };

  const updateSchedule = (file?: File) => {
    setScheduleFile(file);
    resetReview();
  };

  const updatePerformance = (file?: File) => {
    setPerformanceFile(file);
    resetReview();
  };

  const runReview = async (schedule: File, performance: File) => {
    setIsReviewing(true);
    setErrorMessage("");
    setCommitted(undefined);
    setConfigurationConfirmed(false);
    setRegistryUpdateConfirmed(false);
    setDuplicateConfirmed(false);
    try {
      setReview(await dependencies.reviewFiles(schedule, performance));
    } catch (error) {
      setReview(undefined);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The files could not be reviewed.",
      );
    } finally {
      setIsReviewing(false);
    }
  };

  const validateSelected = async () => {
    if (scheduleFile === undefined || performanceFile === undefined) return;
    await runReview(scheduleFile, performanceFile);
  };

  const commit = async () => {
    if (review === undefined) return;
    setIsCommitting(true);
    setErrorMessage("");
    try {
      const manifest = await dependencies.commitReview(review, {
        configurationConfirmed,
        duplicateChecksumConfirmed: duplicateConfirmed,
      });
      setCommitted(manifest);
      await refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The atomic import did not complete.",
      );
    } finally {
      setIsCommitting(false);
    }
  };

  const updateRegistry = async () => {
    if (
      review === undefined ||
      review.configurationUpdate === undefined ||
      scheduleFile === undefined ||
      performanceFile === undefined ||
      !registryUpdateConfirmed
    ) {
      return;
    }
    setIsUpdatingRegistry(true);
    setErrorMessage("");
    try {
      await dependencies.updateConfiguration(review);
      await runReview(scheduleFile, performanceFile);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The project registry could not be updated.",
      );
    } finally {
      setIsUpdatingRegistry(false);
    }
  };

  const startAgain = () => {
    setScheduleFile(undefined);
    setPerformanceFile(undefined);
    resetReview();
  };

  const blockingIssues =
    review?.issues.filter((issue) => issue.severity === "blocking") ?? [];
  const warningIssues =
    review?.issues.filter((issue) => issue.severity === "warning") ?? [];
  const sortedIssues = [...(review?.issues ?? [])].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.fileName.localeCompare(right.fileName) ||
      (left.recordNumber ?? 0) - (right.recordNumber ?? 0),
  );
  const configurationReady =
    review === undefined ||
    !review.configurationRequiresConfirmation ||
    configurationConfirmed;
  const duplicateReady =
    review === undefined ||
    review.duplicateChecksumMatches.length === 0 ||
    duplicateConfirmed;
  const canCommit = Boolean(
    review?.preview?.canCommit &&
      configurationReady &&
      duplicateReady &&
      !isCommitting &&
      !isUpdatingRegistry &&
      !isReviewing,
  );

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="M1 data foundation"
        title="Import and data quality"
        description="Validate your schedule and performance CSV files before an atomic local commit."
        actions={
          <div className="local-only-chip">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              <small>Privacy boundary</small>
              Local data only
            </span>
          </div>
        }
      />

      <PageGuide
        pageName="Import and data quality"
        purpose="Use this workflow to prove file quality and confirm project boundaries before active data can change."
        steps={[
          {
            title: "Choose both files",
            detail: "Select matching schedule and periodic-performance CSV files for one project and baseline.",
          },
          {
            title: "Resolve validation",
            detail: "Review blocking rows, warnings and exact correction guidance before continuing.",
          },
          {
            title: "Confirm and commit",
            detail: "Approve first-project or additive registry revisions and repeated checksums, then make one atomic local commit.",
          },
        ]}
      />

      <ol className="import-steps" aria-label="Import progress">
        {[
          ["1", "Select files"],
          ["2", "Validate"],
          ["3", "Confirm"],
          ["4", "Commit"],
        ].map(([number, label], index) => {
          const current = committed
            ? 3
            : review
              ? 2
              : scheduleFile && performanceFile
                ? 1
                : 0;
          return (
            <li
              key={number}
              className={
                index < current
                  ? "import-step import-step--complete"
                  : index === current
                    ? "import-step import-step--current"
                    : "import-step"
              }
              aria-current={index === current ? "step" : undefined}
            >
              <span>{index < current ? <CheckCircle2 size={17} /> : number}</span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>

      {committed ? (
        <section className="import-receipt" aria-labelledby="import-success-title">
          <div className="import-receipt__icon" aria-hidden="true">
            <Database size={28} />
          </div>
          <div>
            <p className="eyebrow">Atomic commit complete</p>
            <h2 id="import-success-title">The validated generation is now active.</h2>
            <p>
              {committed.totals.acceptedRows} records were stored locally for data
              date {committed.dataDate}. {committed.previousImportId
                ? "The previous active generation was preserved for recovery."
                : "This is the first controlled active generation."}
            </p>
            <dl className="import-receipt__meta">
              <div><dt>Import ID</dt><dd>{committed.importId}</dd></div>
              <div><dt>Project</dt><dd>{committed.projectId}</dd></div>
              <div><dt>Baseline</dt><dd>{committed.baselineVersion}</dd></div>
            </dl>
          </div>
          <button className="button button--secondary" type="button" onClick={startAgain}>
            <RefreshCw size={17} aria-hidden="true" /> Start another import
          </button>
        </section>
      ) : (
        <>
          <section className="panel import-selection" aria-labelledby="import-files-title">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Input pair</p>
                <h2 id="import-files-title">Choose the reporting files</h2>
                <p className="panel__description">
                  Files are read in this local app only. The allowlist accepts UTF-8 .csv files.
                </p>
              </div>
              <div className="import-template-actions" aria-label="Blank CSV templates">
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => downloadBlankTemplate(SCHEDULE_CSV_HEADERS, "project-schedule-template.csv")}
                >
                  <Download size={16} aria-hidden="true" /> Download blank schedule template
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => downloadBlankTemplate(PERFORMANCE_CSV_HEADERS, "project-performance-template.csv")}
                >
                  <Download size={16} aria-hidden="true" /> Download blank performance template
                </button>
              </div>
            </div>

            <div className="import-file-grid">
              <ImportFileField
                id="schedule-file"
                label="Schedule CSV"
                description="Activities, dates, logic, ownership, calendars and baseline budget."
                file={scheduleFile}
                onChange={updateSchedule}
              />
              <ImportFileField
                id="performance-file"
                label="Performance CSV"
                description="Periodic planned value, earned value, actual cost and progress."
                file={performanceFile}
                onChange={updatePerformance}
              />
            </div>

            <div className="import-selection__actions">
              <p>Both files are required and must describe one project and baseline.</p>
              <button
                className="button button--primary"
                type="button"
                disabled={
                  scheduleFile === undefined ||
                  performanceFile === undefined ||
                  isReviewing
                }
                onClick={validateSelected}
              >
                {isReviewing ? (
                  <LoaderCircle className="spin" size={17} aria-hidden="true" />
                ) : (
                  <Upload size={17} aria-hidden="true" />
                )}
                {isReviewing ? "Validating…" : "Validate both files"}
              </button>
            </div>
          </section>

          {errorMessage ? (
            <div className="import-error" role="alert">
              <strong>Import could not continue.</strong>
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {review ? (
            <section className="import-review" aria-labelledby="validation-result-title">
              <div
                className={
                  "validation-banner " +
                  (review.preview?.canCommit
                    ? "validation-banner--ready"
                    : "validation-banner--blocked")
                }
              >
                <div>
                  <p className="eyebrow">Validation result</p>
                  <h2 id="validation-result-title">
                    {review.preview?.canCommit
                      ? "The data pair is technically valid."
                      : "Blocking issues must be corrected."}
                  </h2>
                  <p>
                    {review.preview?.canCommit
                      ? "Review the inferred controls below before the active pointer can change."
                      : "No data has been written. Correct the listed rows and validate again."}
                  </p>
                </div>
                <span className="validation-banner__status">
                  {review.preview?.canCommit ? "Ready to confirm" : "Commit blocked"}
                </span>
              </div>

              <div className="validation-summary" aria-label="Validation summary">
                <div><span>Source rows</span><strong>{
                  (review.preview?.scheduleCounts.sourceRows ?? review.schedule.parseResult.records.length) +
                  (review.preview?.performanceCounts.sourceRows ?? review.performance.parseResult.records.length)
                }</strong></div>
                <div><span>Accepted rows</span><strong>{
                  (review.preview?.scheduleCounts.acceptedRows ?? 0) +
                  (review.preview?.performanceCounts.acceptedRows ?? 0)
                }</strong></div>
                <div><span>Blocking issues</span><strong>{blockingIssues.length}</strong></div>
                <div><span>Warnings</span><strong>{warningIssues.length}</strong></div>
                <div><span>Data date</span><strong>{review.preview?.dataDate ?? "Unavailable"}</strong></div>
              </div>

              <div className={"import-runtime import-runtime--" + review.runtime.mode}>
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>
                    {review.runtime.mode === "worker"
                      ? "Validated in the isolated module worker"
                      : "Validated with the deterministic fallback"}
                  </strong>
                  <span>
                    Processing completed in {Math.round(review.runtime.durationMs)} ms.
                    {review.runtime.warning ? ` ${review.runtime.warning}` : " The main interface remained available during processing."}
                  </span>
                </div>
              </div>

              {review.configuration ? (
                <fieldset className="confirmation-panel">
                  <legend>Project registry control</legend>
                  <div className="confirmation-panel__header">
                    <div>
                      <strong>
                        {review.configurationRequiresConfirmation
                          ? "Confirm the first-project registry"
                          : "Active project registry applied"}
                      </strong>
                      <p>
                        {review.configurationRequiresConfirmation
                          ? "These values were inferred from accepted schedule rows. Confirm they are the authorised boundaries for this project."
                          : "The candidate was checked against the active revision-controlled registry."}
                      </p>
                    </div>
                    <span>{review.configuration.projectId}</span>
                  </div>
                  <dl className="registry-grid">
                    <div><dt>Work packages</dt><dd>{review.configuration.workPackageIds.join(", ")}</dd></div>
                    <div><dt>Calendars</dt><dd>{review.configuration.calendarIds.join(", ")}</dd></div>
                    <div><dt>Authorised starts</dt><dd>{review.configuration.authorisedStartActivityIds.join(", ") || "None"}</dd></div>
                    <div><dt>Authorised finishes</dt><dd>{review.configuration.authorisedFinishActivityIds.join(", ") || "None"}</dd></div>
                  </dl>
                  {review.configurationRequiresConfirmation ? (
                    <label className="confirmation-check">
                      <input
                        type="checkbox"
                        checked={configurationConfirmed}
                        onChange={(event) => setConfigurationConfirmed(event.target.checked)}
                      />
                      <span>I confirm this proposed project registry.</span>
                    </label>
                  ) : null}
                </fieldset>
              ) : null}

              {review.duplicateChecksumMatches.length > 0 ? (
                <fieldset className="confirmation-panel confirmation-panel--attention">
                  <legend>Repeated file control</legend>
                  <p>
                    {review.duplicateChecksumMatches.length} checksum matches were found in successful import history. The same bytes may be imported only after explicit confirmation.
                  </p>
                  <label className="confirmation-check">
                    <input
                      type="checkbox"
                      checked={duplicateConfirmed}
                      onChange={(event) => setDuplicateConfirmed(event.target.checked)}
                    />
                    <span>I intend to import these repeated file bytes.</span>
                  </label>
                </fieldset>
              ) : null}

              {review.configurationUpdate ? (
                <fieldset className="confirmation-panel confirmation-panel--attention">
                  <legend>Controlled registry update</legend>
                  <div className="confirmation-panel__header">
                    <div>
                      <strong>
                        Review additive revision {review.configurationUpdate.expectedRevision + 1}
                      </strong>
                      <p>
                        This action updates the confirmed registry only. It does not import either file; both files are automatically revalidated afterwards.
                      </p>
                    </div>
                    <span>{review.configurationUpdate.projectId}</span>
                  </div>
                  <dl className="registry-grid">
                    <div><dt>New work packages</dt><dd>{review.configurationUpdate.additions.workPackageIds.join(", ") || "None"}</dd></div>
                    <div><dt>New calendars</dt><dd>{review.configurationUpdate.additions.calendarIds.join(", ") || "None"}</dd></div>
                    <div><dt>New authorised starts</dt><dd>{review.configurationUpdate.additions.authorisedStartActivityIds.join(", ") || "None"}</dd></div>
                    <div><dt>New authorised finishes</dt><dd>{review.configurationUpdate.additions.authorisedFinishActivityIds.join(", ") || "None"}</dd></div>
                  </dl>
                  <label className="confirmation-check">
                    <input
                      type="checkbox"
                      checked={registryUpdateConfirmed}
                      onChange={(event) => setRegistryUpdateConfirmed(event.target.checked)}
                    />
                    <span>I authorise this additive registry revision. Existing identifiers will remain active.</span>
                  </label>
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={!registryUpdateConfirmed || isUpdatingRegistry || isReviewing}
                    onClick={updateRegistry}
                  >
                    {isUpdatingRegistry ? (
                      <LoaderCircle className="spin" size={17} aria-hidden="true" />
                    ) : (
                      <RefreshCw size={17} aria-hidden="true" />
                    )}
                    Update registry and revalidate
                  </button>
                </fieldset>
              ) : null}

              <section className="panel issue-panel" aria-labelledby="issue-list-title">
                <div className="panel__header">
                  <div>
                    <p className="eyebrow">Row-level evidence</p>
                    <h2 id="issue-list-title">Validation issues</h2>
                    <p className="panel__description">
                      Record numbers are one-based CSV records; the header is record 1.
                    </p>
                  </div>
                  {sortedIssues.length > 0 ? (
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => dependencies.downloadIssues(sortedIssues)}
                    >
                      <Download size={17} aria-hidden="true" /> Download report
                    </button>
                  ) : null}
                </div>
                {sortedIssues.length === 0 ? (
                  <div className="empty-validation">
                    <CheckCircle2 size={22} aria-hidden="true" />
                    <div><strong>No validation issues found.</strong><span>Both files passed all current import rules.</span></div>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <caption className="sr-only">CSV validation issues</caption>
                      <thead><tr><th scope="col">Severity</th><th scope="col">Location</th><th scope="col">Field / code</th><th scope="col">Rule and correction</th></tr></thead>
                      <tbody>
                        {sortedIssues.slice(0, 50).map((issue, index) => (
                          <tr key={issue.fileName + String(issue.recordNumber) + issue.code + String(index)}>
                            <td><span className={"issue-severity issue-severity--" + issue.severity}>{issue.severity}</span></td>
                            <td><span className="table-primary">{locationFor(issue)}</span>{issue.suppliedValue ? <span className="table-secondary">Value: {issue.suppliedValue}</span> : null}</td>
                            <td><span className="table-primary">{issue.column ?? "File"}</span><span className="table-secondary">{issue.code}</span></td>
                            <td className="issue-rule"><strong>{issue.rule}</strong><span>{issue.suggestion}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {sortedIssues.length > 50 ? <p className="issue-limit">Showing the first 50 issues. Download the report for all {sortedIssues.length}.</p> : null}
              </section>

              <div className="commit-bar">
                <div>
                  <strong>Atomic safety boundary</strong>
                  <p>Rows, manifest and project registry commit together; the active pointer changes last.</p>
                </div>
                <button
                  className="button button--primary"
                  type="button"
                  disabled={!canCommit}
                  onClick={commit}
                >
                  {isCommitting ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Database size={17} aria-hidden="true" />}
                  {isCommitting ? "Committing…" : "Commit validated import"}
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
