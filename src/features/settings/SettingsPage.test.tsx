import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupEnvelope } from "../../schemas/backup";
import type { BackupRestorePreview } from "../../repositories/backupRepository";
import type { ImportManifest } from "../../schemas/manifest";
import {
  SettingsPage,
  type SettingsPageDependencies,
} from "./SettingsPage";

const envelope = {
  format: "project-controls-dashboard",
  formatVersion: 1,
  exportedAt: "2026-07-19T10:00:00.000Z",
  scope: "active-generation",
  dataset: {
    activeImportId: "IMPORT-001",
    manifest: {
      projectId: "ASTER",
      baselineVersion: "B0",
      dataDate: "2026-06-14",
      totals: { acceptedRows: 10 },
    },
    configuration: {},
    activities: [],
    performance: [],
  },
  applicationRecords: { risks: [], changes: [], reportDrafts: [] },
} as unknown as BackupEnvelope;

const restoredManifest = {
  importId: "RESTORE-001",
  importedAt: "2026-07-19T11:00:00.000Z",
} as ImportManifest;

const preview = {
  envelope,
  prepared: { manifest: restoredManifest },
  issues: [],
  createsProjectRegistry: false,
} as unknown as BackupRestorePreview;

describe("settings and data page", () => {
  let dependencies: SettingsPageDependencies;

  beforeEach(() => {
    dependencies = {
      load: vi.fn().mockResolvedValue({
        lifecycle: {
          schemaVersion: "1",
          activeImportId: "IMPORT-001",
          lastImportAt: "2026-07-19T09:00:00.000Z",
          manifestCount: 1,
          activityCount: 5,
          performanceCount: 5,
        },
        storage: {
          availability: "supported",
          usageBytes: 1024,
          quotaBytes: 4096,
          usagePercent: 25,
          persisted: false,
          persistenceRequestSupported: true,
          message: "Storage remains browser-managed.",
        },
      }),
      requestPersistence: vi.fn().mockResolvedValue({
        availability: "supported",
        persisted: true,
        persistenceRequestSupported: true,
        message: "The browser currently marks this origin as persistent.",
      }),
      createBackup: vi.fn().mockResolvedValue(envelope),
      previewRestore: vi.fn().mockResolvedValue(preview),
      restore: vi.fn().mockResolvedValue(restoredManifest),
      reset: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => cleanup());

  it("explains storage health and records a backup download", async () => {
    const user = userEvent.setup();
    render(<SettingsPage dependencies={dependencies} />);

    expect(
      await screen.findByRole("heading", { name: "Settings and data", level: 1 }),
    ).toBeInTheDocument();
    const health = screen.getByRole("region", { name: "Local storage health" });
    expect(within(health).getByText("1.0 KB")).toBeInTheDocument();
    expect(within(health).getByText("Best effort")).toBeInTheDocument();
    expect(within(health).getByText("IMPORT-001")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Download JSON backup" }),
    );
    expect(dependencies.createBackup).toHaveBeenCalledOnce();
    expect(
      await screen.findByText(
        "Backup downloaded for ASTER at data date 2026-06-14.",
      ),
    ).toBeInTheDocument();
  });

  it("requires validation, preview and explicit confirmation before restore", async () => {
    const user = userEvent.setup();
    render(<SettingsPage dependencies={dependencies} />);
    await screen.findByRole("heading", { name: "Settings and data", level: 1 });

    const file = new File(["{}"], "aster-backup.json", {
      type: "application/json",
    });
    await user.upload(screen.getByLabelText("Backup JSON"), file);
    await user.click(
      screen.getByRole("button", { name: "Validate and preview" }),
    );
    expect(dependencies.previewRestore).toHaveBeenCalledWith(file);
    expect(
      await screen.findByRole("heading", {
        name: "Validated backup is ready for confirmation",
      }),
    ).toBeInTheDocument();
    const commit = screen.getByRole("button", { name: "Commit atomic restore" });
    expect(commit).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: "I understand this will create and activate a new immutable generation; the current generation remains in history.",
      }),
    );
    expect(commit).toBeEnabled();
    await user.click(commit);
    expect(dependencies.restore).toHaveBeenCalledWith(preview);
    expect(
      await screen.findByText(
        "Restore committed as active generation RESTORE-001.",
      ),
    ).toBeInTheDocument();
  });

  it("gates destructive reset behind a plain-language confirmation", async () => {
    const user = userEvent.setup();
    render(<SettingsPage dependencies={dependencies} />);
    await screen.findByRole("heading", { name: "Settings and data", level: 1 });
    const resetButton = screen.getByRole("button", { name: "Reset local data" });
    expect(resetButton).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: "I understand this action removes all local project-control data.",
      }),
    );
    await user.click(resetButton);
    expect(dependencies.reset).toHaveBeenCalledOnce();
    expect(
      await screen.findByText(
        "All local project-control data was removed. The synthetic fallback is active.",
      ),
    ).toBeInTheDocument();
  });
});
