import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatasetRepository } from "../../repositories/datasetRepository";
import { ProjectControlsDb } from "../../repositories/db";
import { ImportRepository } from "../../repositories/importRepository";
import { ProjectConfigurationRepository } from "../../repositories/projectConfigurationRepository";
import { createSyntheticImportFiles } from "./demoImportFiles";
import {
  commitImportReview,
  reviewImportFiles,
} from "./importWorkflow";
import { ImportPage, type ImportPageDependencies } from "./ImportPage";

let sequence = 0;

describe("import page", () => {
  let db: ProjectControlsDb;
  let dependencies: ImportPageDependencies;

  beforeEach(() => {
    sequence += 1;
    db = new ProjectControlsDb("import-page-test-" + String(sequence), {
      indexedDB,
      IDBKeyRange,
    });
    const datasets = new DatasetRepository(db);
    const imports = new ImportRepository(db);
    const configurations = new ProjectConfigurationRepository(db);
    dependencies = {
      reviewFiles: (schedule, performance) =>
        reviewImportFiles(schedule, performance, {
          datasets,
          imports,
          configurations,
        }),
      commitReview: (review, options) =>
        commitImportReview(
          review,
          {
            ...options,
            importId: "IMPORT-PAGE-001",
            importedAt: "2026-07-18T19:00:00.000Z",
          },
          imports,
        ),
      updateConfiguration: async (review) => {
        if (review.configurationUpdate === undefined) return;
        await configurations.commitAdditiveUpdate(review.configurationUpdate, {
          confirmed: true,
          updatedAt: "2026-07-18T18:30:00.000Z",
        });
      },
      downloadIssues: vi.fn(),
    };
  });

  afterEach(async () => {
    cleanup();
    await db.delete();
  });

  it("starts without a demo shortcut and commits explicitly selected input files", async () => {
    const user = userEvent.setup();
    render(<ImportPage dependencies={dependencies} />);

    expect(
      screen.getByRole("heading", { name: "Import and data quality", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Validate both files" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /ASTER example/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download blank schedule template" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Download blank performance template" }),
    ).toBeEnabled();

    const inputFiles = createSyntheticImportFiles();
    await user.upload(screen.getByLabelText("Schedule CSV"), inputFiles.schedule);
    await user.upload(
      screen.getByLabelText("Performance CSV"),
      inputFiles.performance,
    );
    await user.click(screen.getByRole("button", { name: "Validate both files" }));

    expect(
      await screen.findByRole("heading", {
        name: "The data pair is technically valid.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("1020")).toHaveLength(2);
    expect(screen.getByText("2026-06-14")).toBeInTheDocument();
    const commitButton = screen.getByRole("button", {
      name: "Commit validated import",
    });
    expect(commitButton).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", {
        name: "I confirm this proposed project registry.",
      }),
    );
    expect(commitButton).toBeEnabled();
    await user.click(commitButton);

    expect(
      await screen.findByRole("heading", {
        name: "The validated generation is now active.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("IMPORT-PAGE-001")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start another import" }),
    ).toBeEnabled();
  });

  it("requires an explicit additive registry update and revalidates the files", async () => {
    const repositories = {
      datasets: new DatasetRepository(db),
      imports: new ImportRepository(db),
      configurations: new ProjectConfigurationRepository(db),
    };
    const initialFiles = createSyntheticImportFiles();
    const initialReview = await reviewImportFiles(
      initialFiles.schedule,
      initialFiles.performance,
      repositories,
    );
    await commitImportReview(
      initialReview,
      {
        configurationConfirmed: true,
        duplicateChecksumConfirmed: false,
        importId: "IMPORT-REGISTRY-SEED",
        importedAt: "2026-07-18T18:00:00.000Z",
      },
      repositories.imports,
    );
    const changedSchedule = new File(
      [(await initialFiles.schedule.text()).replace(",WP100,", ",WP600,")],
      "aster-registry-change.csv",
      { type: "text/csv" },
    );
    const user = userEvent.setup();
    render(<ImportPage dependencies={dependencies} />);

    await user.upload(screen.getByLabelText("Schedule CSV"), changedSchedule);
    await user.upload(
      screen.getByLabelText("Performance CSV"),
      initialFiles.performance,
    );
    await user.click(screen.getByRole("button", { name: "Validate both files" }));

    expect(
      await screen.findByRole("group", { name: "Controlled registry update" }),
    ).toBeInTheDocument();
    expect(screen.getByText("WP600")).toBeInTheDocument();
    const updateButton = screen.getByRole("button", {
      name: "Update registry and revalidate",
    });
    expect(updateButton).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: "I authorise this additive registry revision. Existing identifiers will remain active.",
      }),
    );
    await user.click(updateButton);

    expect(
      await screen.findByRole("heading", {
        name: "The data pair is technically valid.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Controlled registry update" }),
    ).not.toBeInTheDocument();
    expect((await db.projectConfigurations.get("ASTER"))?.revision).toBe(2);
  });
});
