import {
  Archive,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useActiveDataset } from "../../app/ActiveDatasetContext";
import { PageGuide } from "../../components/PageGuide";
import { PageHeader } from "../../components/PageHeader";
import {
  encodeBackupJson,
  MAX_BACKUP_BYTES,
  type BackupEnvelope,
} from "../../schemas/backup";
import {
  getBrowserRepositories,
} from "../../repositories/browserRepositories";
import type {
  BackupLifecycleStatus,
  BackupRestorePreview,
} from "../../repositories/backupRepository";
import type { ImportManifest } from "../../schemas/manifest";
import { formatDate } from "../../utils/format";
import {
  readStorageHealth,
  requestPersistentStorage,
  type StorageHealth,
} from "./storageHealth";

interface SettingsSnapshot {
  lifecycle: BackupLifecycleStatus;
  storage: StorageHealth;
}

export interface SettingsPageDependencies {
  load: () => Promise<SettingsSnapshot>;
  requestPersistence: () => Promise<StorageHealth>;
  createBackup: () => Promise<BackupEnvelope>;
  previewRestore: (file: File) => Promise<BackupRestorePreview>;
  restore: (preview: BackupRestorePreview) => Promise<ImportManifest>;
  reset: () => Promise<void>;
}

const downloadBackup = (json: string, fileName: string) => {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const defaultDependencies: SettingsPageDependencies = {
  load: async () => {
    const [lifecycle, storage] = await Promise.all([
      getBrowserRepositories().backups.getLifecycleStatus(),
      readStorageHealth(),
    ]);
    return { lifecycle, storage };
  },
  requestPersistence: requestPersistentStorage,
  createBackup: async () => {
    const backups = getBrowserRepositories().backups;
    const exportedAt = new Date().toISOString();
    const envelope = await backups.createActiveBackup(exportedAt);
    const fileName = [
      "project-controls-backup",
      envelope.dataset.manifest.projectId,
      envelope.dataset.manifest.dataDate,
    ].join("-") + ".json";
    downloadBackup(encodeBackupJson(envelope), fileName);
    await backups.recordBackupCompleted(exportedAt).catch(() => undefined);
    return envelope;
  },
  previewRestore: async (file) => {
    if (!file.name.toLowerCase().endsWith(".json")) {
      throw new Error("Choose a .json Project Controls backup.");
    }
    if (file.size > MAX_BACKUP_BYTES) {
      throw new Error("Backup exceeds the 20 MB restore limit.");
    }
    return getBrowserRepositories().backups.previewRestore(await file.text(), {
      restoredAt: new Date().toISOString(),
    });
  },
  restore: (preview) =>
    getBrowserRepositories().backups.restorePreview(preview),
  reset: () => getBrowserRepositories().backups.resetAllLocalData(),
};

const formatBytes = (value?: number) => {
  if (value === undefined) return "Unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatTimestamp = (value?: string) =>
  value === undefined
    ? "Not recorded"
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));

export function SettingsPage({
  dependencies = defaultDependencies,
}: {
  dependencies?: SettingsPageDependencies;
}) {
  const { refresh } = useActiveDataset();
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>();
  const [selectedFile, setSelectedFile] = useState<File>();
  const [preview, setPreview] = useState<BackupRestorePreview>();
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "idle" | "backup" | "preview" | "restore" | "persist" | "reset"
  >("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setSnapshot(await dependencies.load());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Storage status could not be loaded.",
      );
    }
  }, [dependencies]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (
    action: Exclude<typeof busyAction, "idle">,
    operation: () => Promise<void>,
  ) => {
    setBusyAction(action);
    setMessage("");
    setError("");
    try {
      await operation();
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : "The data operation could not complete.",
      );
    } finally {
      setBusyAction("idle");
    }
  };

  const createBackup = () =>
    run("backup", async () => {
      const envelope = await dependencies.createBackup();
      setMessage(
        `Backup downloaded for ${envelope.dataset.manifest.projectId} at data date ${envelope.dataset.manifest.dataDate}.`,
      );
      await load();
    });

  const validateBackup = () => {
    if (selectedFile === undefined) return;
    return run("preview", async () => {
      const nextPreview = await dependencies.previewRestore(selectedFile);
      setPreview(nextPreview);
      setRestoreConfirmed(false);
      setMessage("Backup passed schema and domain validation. Review the preview before restoring.");
    });
  };

  const restoreBackup = () => {
    if (preview === undefined || !restoreConfirmed) return;
    return run("restore", async () => {
      const manifest = await dependencies.restore(preview);
      await refresh();
      await load();
      setPreview(undefined);
      setSelectedFile(undefined);
      setRestoreConfirmed(false);
      setMessage(`Restore committed as active generation ${manifest.importId}.`);
    });
  };

  const requestPersistence = () =>
    run("persist", async () => {
      const storage = await dependencies.requestPersistence();
      setSnapshot((current) =>
        current === undefined ? current : { ...current, storage },
      );
      setMessage(storage.message);
    });

  const reset = () => {
    if (!resetConfirmed) return;
    return run("reset", async () => {
      await dependencies.reset();
      await refresh();
      await load();
      setResetConfirmed(false);
      setPreview(undefined);
      setSelectedFile(undefined);
      setMessage("All local project-control data was removed. The synthetic fallback is active.");
    });
  };

  const lifecycle = snapshot?.lifecycle;
  const storage = snapshot?.storage;
  const isBusy = busyAction !== "idle";

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Data lifecycle"
        title="Settings and data"
        description="Inspect browser-managed storage, protect the active generation, and restore only validated versioned backups."
        actions={
          <div className="local-only-chip">
            <ShieldCheck size={18} aria-hidden="true" />
            <span><small>Privacy boundary</small>Local browser data</span>
          </div>
        }
      />

      <PageGuide
        pageName="Settings and data"
        purpose="Use this page before major imports or browser maintenance: check storage, download a backup, then validate any restore before it can change the active pointer."
        steps={[
          { title: "Check storage", detail: "Review estimated usage, persistence state, schema and the current active generation." },
          { title: "Download a backup", detail: "Save the active generation as versioned JSON before replacement, reset or browser maintenance." },
          { title: "Preview before restore", detail: "Choose a backup, validate it, inspect its identity and counts, then explicitly confirm the atomic restore." },
        ]}
      />

      {error ? <div className="import-error" role="alert"><strong>Data operation could not continue.</strong><span>{error}</span></div> : null}
      {message ? <div className="settings-success" role="status"><CheckCircle2 size={18} aria-hidden="true" /><span>{message}</span></div> : null}

      <section className="settings-health-grid" aria-label="Local storage health">
        <article className="panel settings-health-card">
          <HardDrive size={21} aria-hidden="true" />
          <span>Estimated local usage</span>
          <strong>{formatBytes(storage?.usageBytes)}</strong>
          <small>of {formatBytes(storage?.quotaBytes)} reported quota{storage?.usagePercent === undefined ? "" : ` · ${storage.usagePercent.toFixed(1)}% used`}</small>
        </article>
        <article className="panel settings-health-card">
          <ShieldCheck size={21} aria-hidden="true" />
          <span>Browser persistence</span>
          <strong>{storage?.persisted === true ? "Persistent" : storage?.persisted === false ? "Best effort" : "Unknown"}</strong>
          <small>{storage?.message ?? "Checking browser storage…"}</small>
        </article>
        <article className="panel settings-health-card">
          <Database size={21} aria-hidden="true" />
          <span>Active generation</span>
          <strong>{lifecycle?.activeImportId ?? "No active import"}</strong>
          <small>{lifecycle === undefined ? "Loading…" : `${lifecycle.activityCount} activities · ${lifecycle.performanceCount} performance rows`}</small>
        </article>
        <article className="panel settings-health-card">
          <Archive size={21} aria-hidden="true" />
          <span>Storage schema</span>
          <strong>Version {lifecycle?.schemaVersion ?? "…"}</strong>
          <small>{lifecycle?.manifestCount ?? 0} immutable manifest{lifecycle?.manifestCount === 1 ? "" : "s"} · {lifecycle?.varianceAnalysisCount ?? 0} variance-analysis record{lifecycle?.varianceAnalysisCount === 1 ? "" : "s"}</small>
        </article>
      </section>

      <section className="panel settings-storage" aria-labelledby="storage-control-title">
        <div className="panel__header">
          <div><p className="eyebrow">Browser responsibility</p><h2 id="storage-control-title">Persistence and recovery position</h2><p className="panel__description">Quota is advisory. Atomic transactions protect the active generation, while a downloaded backup protects against browser clearing or eviction.</p></div>
          {storage?.persistenceRequestSupported && storage.persisted !== true ? (
            <button className="button button--secondary" type="button" disabled={isBusy} onClick={requestPersistence}>
              {busyAction === "persist" ? <LoaderCircle aria-hidden="true" className="spin" size={17} /> : <ShieldCheck size={17} aria-hidden="true" />} Request persistence
            </button>
          ) : null}
        </div>
        <dl className="settings-meta-grid">
          <div><dt>Last successful import</dt><dd>{formatTimestamp(lifecycle?.lastImportAt)}</dd></div>
          <div><dt>Last downloaded backup</dt><dd>{formatTimestamp(lifecycle?.lastBackupAt)}</dd></div>
          <div><dt>Last successful restore</dt><dd>{formatTimestamp(lifecycle?.lastRestoreAt)}</dd></div>
          <div><dt>Storage API</dt><dd>{storage?.availability ?? "Checking"}</dd></div>
        </dl>
      </section>

      <section className="settings-action-grid">
        <article className="panel settings-action" aria-labelledby="backup-title">
          <div className="settings-action__icon"><Download size={22} aria-hidden="true" /></div>
          <div><p className="eyebrow">Protect current data</p><h2 id="backup-title">Download versioned backup</h2><p>Exports the active schedule, performance rows, manifest and confirmed registry. Variance-analysis drafts and signed revisions are currently local-only and are not included in this active-generation backup.</p></div>
          <button className="button button--primary" type="button" onClick={createBackup} disabled={isBusy || lifecycle?.activeImportId === undefined}>
            {busyAction === "backup" ? <LoaderCircle aria-hidden="true" className="spin" size={17} /> : <Download size={17} aria-hidden="true" />} Download JSON backup
          </button>
        </article>

        <article className="panel settings-action" aria-labelledby="restore-title">
          <div className="settings-action__icon"><Upload size={22} aria-hidden="true" /></div>
          <div><p className="eyebrow">Validated recovery</p><h2 id="restore-title">Restore from backup</h2><p>The selected JSON is schema-, relationship-, registry- and count-validated before a preview is shown. Restore creates a new generation; it never overwrites the source manifest.</p></div>
          <label className="settings-file" htmlFor="backup-file"><span>Backup JSON</span><input id="backup-file" aria-label="Backup JSON" type="file" accept=".json,application/json" onChange={(event) => { setSelectedFile(event.target.files?.[0]); setPreview(undefined); setRestoreConfirmed(false); setMessage(""); setError(""); }} />{selectedFile ? <strong>{selectedFile.name}</strong> : <small>Maximum 20 MB</small>}</label>
          <button className="button button--secondary" type="button" disabled={isBusy || selectedFile === undefined} onClick={validateBackup}>
            {busyAction === "preview" ? <LoaderCircle aria-hidden="true" className="spin" size={17} /> : <RotateCcw size={17} aria-hidden="true" />} Validate and preview
          </button>
        </article>
      </section>

      {preview ? (
        <section className="panel restore-preview" aria-labelledby="restore-preview-title">
          <div className="panel__header"><div><p className="eyebrow">Restore preview</p><h2 id="restore-preview-title">Validated backup is ready for confirmation</h2><p className="panel__description">Source generation {preview.envelope.dataset.activeImportId}; restore generation {preview.prepared.manifest.importId}.</p></div><span className="delivery-state">{preview.issues.filter((issue) => issue.severity === "warning").length} warnings</span></div>
          <dl className="settings-meta-grid">
            <div><dt>Project</dt><dd>{preview.envelope.dataset.manifest.projectId}</dd></div>
            <div><dt>Baseline</dt><dd>{preview.envelope.dataset.manifest.baselineVersion}</dd></div>
            <div><dt>Data date</dt><dd>{formatDate(preview.envelope.dataset.manifest.dataDate)}</dd></div>
            <div><dt>Accepted rows</dt><dd>{preview.envelope.dataset.manifest.totals.acceptedRows}</dd></div>
          </dl>
          <label className="confirmation-check"><input type="checkbox" checked={restoreConfirmed} onChange={(event) => setRestoreConfirmed(event.target.checked)} /><span>I understand this will create and activate a new immutable generation; the current generation remains in history.</span></label>
          <div className="restore-preview__actions"><span>{preview.createsProjectRegistry ? "This restore will also create the confirmed project registry." : "The backup registry matches the confirmed local registry."}</span><button className="button button--primary" type="button" disabled={isBusy || !restoreConfirmed} onClick={restoreBackup}>{busyAction === "restore" ? <LoaderCircle aria-hidden="true" className="spin" size={17} /> : <Database size={17} aria-hidden="true" />} Commit atomic restore</button></div>
        </section>
      ) : null}

      <section className="panel settings-danger" aria-labelledby="reset-title">
        <div><p className="eyebrow">Destructive control</p><h2 id="reset-title">Reset all local data</h2><p>Removes every local row generation, manifest, registry, variance-analysis revision and lifecycle timestamp from this browser origin. The current backup does not include analysis records.</p></div>
        <label className="confirmation-check"><input type="checkbox" checked={resetConfirmed} onChange={(event) => setResetConfirmed(event.target.checked)} /><span>I understand this action removes all local project-control data.</span></label>
        <button className="button button--danger" type="button" disabled={isBusy || !resetConfirmed} onClick={reset}><Trash2 size={17} aria-hidden="true" /> Reset local data</button>
      </section>
    </div>
  );
}
