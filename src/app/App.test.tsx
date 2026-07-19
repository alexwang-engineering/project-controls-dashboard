import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { getBrowserRepositories } from "../repositories/browserRepositories";
import { useProjectStore } from "./store";
import { App } from "./App";

describe("project controls application", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    useProjectStore.getState().reloadDemo();
  });

  afterEach(() => cleanup());

  afterAll(async () => {
    await getBrowserRepositories().db.delete();
  });

  it("presents the reconciled Week 10 management position", async () => {
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Project overview", level: 1 }),
    ).toBeInTheDocument();
    const indicators = screen.getByRole("region", {
      name: "Headline performance indicators",
    });
    expect(within(indicators).getByText("0.900")).toBeInTheDocument();
    expect(within(indicators).getByText("0.938")).toBeInTheDocument();

    const projectTotal = screen.getByRole("row", { name: /Project total/ });
    expect(within(projectTotal).getByText("-£150,000")).toBeInTheDocument();
    expect(within(projectTotal).getByText("-£90,000")).toBeInTheDocument();

    expect(
      screen.getByRole("progressbar", { name: "MVP build progress" }),
    ).toHaveAttribute("value", "52");
    expect(screen.getByText("48.7 / 94 weighted hours")).toBeInTheDocument();
  });

  it.each([
    ["/", "Project overview"],
    ["/import", "Import and data quality"],
    ["/schedule-cost", "Schedule and cost"],
    ["/milestones", "Milestone control"],
    ["/risks", "Risk exposure"],
    ["/changes", "Change control"],
    ["/report", "Weekly management report"],
    ["/settings", "Settings and data"],
  ])("provides a three-step page guide on %s", async (path, pageName) => {
    window.history.replaceState({}, "", path);
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: pageName, level: 1 }),
    ).toBeInTheDocument();

    const guide = screen.getByRole("region", {
      name: `How to use ${pageName}`,
    });
    expect(
      within(guide).getByRole("heading", {
        name: "How to use this page",
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(within(guide).getAllByRole("listitem")).toHaveLength(3);
  });

  it("applies a work-package highlight with an accessible announcement", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Project overview", level: 1 });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Work package" }),
      "WP300",
    );

    expect(
      screen.getByText("Highlighting WP300 in the work-package table."),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Work-package filter applied.",
    );
    expect(screen.getByRole("row", { name: /WP300/ })).toHaveClass(
      "table-row--selected",
    );
  });

  it("navigates to the risk register and exposes the heatmap as a table", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Project overview", level: 1 });

    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    await user.click(within(navigation).getByRole("link", { name: "Risks" }));

    expect(
      await screen.findByRole("heading", { name: "Risk exposure", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: /Residual risk heatmap/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Probability 4, impact 4: 1 risks/),
    ).toHaveTextContent("R-001");
  });

  it("refreshes Overview and Schedule & Cost from the generation committed in the same session", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/import");
    render(<App />);

    await screen.findByRole("heading", {
      name: "Import and data quality",
      level: 1,
    });
    await user.click(
      screen.getByRole("button", { name: "Load synthetic example" }),
    );
    await screen.findByRole("heading", {
      name: "The data pair is technically valid.",
    });
    await user.click(
      await screen.findByRole("checkbox", {
        name: "I confirm this proposed synthetic project registry.",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Commit validated import" }),
    );
    await screen.findByRole("heading", {
      name: "The validated generation is now active.",
    });

    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    await user.click(
      within(navigation).getByRole("link", { name: "Overview" }),
    );
    expect(
      await screen.findByRole("region", { name: "Dashboard data source" }),
    ).toHaveTextContent("Validated active generation");
    expect(screen.getByText("Active import")).toBeInTheDocument();

    await user.click(
      within(navigation).getByRole("link", { name: "Schedule & cost" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Schedule and cost", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Performance data source" }),
    ).toHaveTextContent("Calculated from the active import");
    expect(
      screen.getByRole("table", {
        name: "Activity-level schedule and cost evidence",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /A-003/ })).toHaveTextContent(
      "-£70,000",
    );

    await user.click(
      within(navigation).getByRole("link", { name: "Settings & data" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Settings and data", level: 1 }),
    ).toBeInTheDocument();
    const storageHealth = screen.getByRole("region", {
      name: "Local storage health",
    });
    expect(within(storageHealth).getByText(/^IMPORT-/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download JSON backup" }),
    ).toBeEnabled();
  });
});
