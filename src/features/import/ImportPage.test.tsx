import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatasetRepository } from "../../repositories/datasetRepository";
import { ProjectControlsDb } from "../../repositories/db";
import { ImportRepository } from "../../repositories/importRepository";
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
    dependencies = {
      createDemoFiles: createSyntheticImportFiles,
      reviewFiles: (schedule, performance) =>
        reviewImportFiles(schedule, performance, { datasets, imports }),
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
      downloadIssues: vi.fn(),
    };
  });

  afterEach(async () => {
    cleanup();
    await db.delete();
  });

  it("guides a reviewer from the synthetic pair to an explicit atomic commit", async () => {
    const user = userEvent.setup();
    render(<ImportPage dependencies={dependencies} />);

    expect(
      screen.getByRole("heading", { name: "Import and data quality", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Validate both files" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Load synthetic example" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "The data pair is technically valid.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("10")).toHaveLength(2);
    expect(screen.getByText("2026-06-14")).toBeInTheDocument();
    const commitButton = screen.getByRole("button", {
      name: "Commit validated import",
    });
    expect(commitButton).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", {
        name: "I confirm this proposed synthetic project registry.",
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
});
