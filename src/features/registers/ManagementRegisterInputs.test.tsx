import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "../../app/store";
import { ChangesPage } from "../changes/ChangesPage";
import { MilestonesPage } from "../milestones/MilestonesPage";
import { RisksPage } from "../risks/RisksPage";

describe("input-first management registers", () => {
  beforeEach(() => {
    useProjectStore.setState({ milestones: [], risks: [], changes: [] });
  });

  afterEach(() => cleanup());

  it("starts the milestone register empty and saves user input", async () => {
    const user = userEvent.setup();
    render(<MilestonesPage />);

    expect(screen.getByText("No milestones have been entered.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add milestone" }));

    await user.type(screen.getByLabelText("Milestone ID"), "M-001");
    await user.type(screen.getByLabelText("Milestone name"), "Design approved");
    await user.type(screen.getByLabelText("Work package ID"), "WP100");
    await user.type(screen.getByLabelText("Owner"), "Design Manager");
    await user.type(screen.getByLabelText("Baseline date"), "2026-08-10");
    await user.type(screen.getByLabelText("Previous forecast date"), "2026-08-10");
    await user.type(screen.getByLabelText("Current forecast date"), "2026-08-12");
    await user.selectOptions(screen.getByLabelText("Milestone status"), "forecast-late");
    await user.type(
      screen.getByLabelText("Control commentary"),
      "Approval meeting booked and action owner confirmed.",
    );
    await user.click(screen.getByRole("button", { name: "Save milestone" }));

    const row = screen.getByRole("row", { name: /Design approved/ });
    expect(within(row).getByText("M-001 · WP100")).toBeInTheDocument();
    expect(useProjectStore.getState().milestones).toHaveLength(1);
  });

  it("derives risk score and rating from user-entered probability and impact", async () => {
    const user = userEvent.setup();
    render(<RisksPage />);

    expect(screen.getByText("No risks have been entered.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add risk" }));

    await user.type(screen.getByLabelText("Risk ID"), "R-001");
    await user.type(screen.getByLabelText("Risk title"), "Supplier delivery delay");
    await user.type(screen.getByLabelText("Work package ID"), "WP200");
    await user.type(screen.getByLabelText("Owner"), "Supply Chain Manager");
    await user.type(screen.getByLabelText("Category"), "Delivery");
    await user.clear(screen.getByLabelText("Residual probability"));
    await user.type(screen.getByLabelText("Residual probability"), "4");
    await user.clear(screen.getByLabelText("Residual impact"));
    await user.type(screen.getByLabelText("Residual impact"), "4");
    await user.type(
      screen.getByLabelText("Treatment action"),
      "Expedite the purchase order and track dispatch evidence daily.",
    );
    await user.type(screen.getByLabelText("Treatment due"), "2026-08-01");
    await user.click(screen.getByRole("button", { name: "Save risk" }));

    const row = screen.getByRole("row", { name: /Supplier delivery delay/ });
    expect(within(row).getByText("4 × 4 = 16")).toBeInTheDocument();
    expect(within(row).getByText("Critical")).toBeInTheDocument();
  });

  it("stores an entered change without incorporating it into the baseline", async () => {
    const user = userEvent.setup();
    render(<ChangesPage />);

    expect(screen.getByText("No change requests have been entered.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add change request" }));

    await user.type(screen.getByLabelText("Change ID"), "CR-001");
    await user.type(screen.getByLabelText("Change title"), "Add inspection platform");
    await user.type(screen.getByLabelText("Work package ID"), "WP300");
    await user.selectOptions(screen.getByLabelText("Change status"), "submitted");
    await user.type(screen.getByLabelText("Cost impact (£)"), "25000");
    await user.type(screen.getByLabelText("Schedule impact (days)"), "3");
    await user.type(screen.getByLabelText("Decision due"), "2026-08-05");
    await user.click(screen.getByRole("button", { name: "Save change request" }));

    const row = screen.getByRole("row", { name: /Add inspection platform/ });
    expect(within(row).getByText("£25,000")).toBeInTheDocument();
    expect(within(row).getByText("Not incorporated")).toBeInTheDocument();
    expect(useProjectStore.getState().changes[0]?.status).toBe("submitted");
  });
});
